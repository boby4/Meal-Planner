/**
 * Cloudflare Bindings 访问工具
 * 在 Next.js API 路由中访问 KV / D1 等 Cloudflare 资源
 * 本地开发时自动使用 sql.js 内存数据库 mock
 */

interface CloudflareEnv {
  RECIPE_CACHE: import("@cloudflare/workers-types").KVNamespace;
  DB: import("@cloudflare/workers-types").D1Database;
}

// ============================================================
// 本地 D1 Mock（基于 sql.js，纯 JS 无需编译）
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

let _sqlJsDB: any = null;
let _sqlJsReady = false;

async function initSqlJs() {
  if (_sqlJsReady) return _sqlJsDB;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJsModule = require("sql.js/dist/sql-asm.js");
  const SQL = await initSqlJsModule();
  const db = new SQL.Database();

  // 初始化表结构
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      device_id TEXT DEFAULT '',
      recipe_name TEXT NOT NULL,
      recipe_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      device_id TEXT DEFAULT '',
      recipe_name TEXT NOT NULL,
      recipe_data TEXT,
      source TEXT DEFAULT '',
      viewed_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      device_id TEXT DEFAULT '',
      day_of_week INTEGER NOT NULL,
      meal_type TEXT NOT NULL,
      recipe_name TEXT NOT NULL,
      recipe_data TEXT,
      week_start TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS shopping_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      device_id TEXT DEFAULT '',
      item_name TEXT NOT NULL,
      amount TEXT DEFAULT '',
      checked INTEGER DEFAULT 0,
      related_recipe TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _sqlJsDB = db;
  _sqlJsReady = true;
  console.log("[LocalD1] sql.js 内存数据库已初始化");
  return db;
}

class LocalD1PreparedStatement {
  private _sql: string;
  private _binds: any[] = [];
  private _db: any;

  constructor(db: any, sql: string) {
    this._db = db;
    this._sql = sql;
  }

  bind(...values: any[]) {
    this._binds = values;
    return this;
  }

  async run() {
    let sql = this._sql;

    // 处理 RETURNING 子句（sql.js 不支持）
    const returningMatch = sql.match(/([\s\S]+)\s+RETURNING\s+([\s\S]+)/i);
    if (returningMatch) {
      const insertSql = returningMatch[1].trim();
      this._db.run(insertSql, this._binds);
      const lastId = this._db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0];
      return { success: true, results: [{ id: lastId }], meta: {} };
    }

    try {
      this._db.run(sql, this._binds.length ? this._binds : undefined);
    } catch (e: any) {
      console.error("[LocalD1] run error:", e.message, "\nSQL:", sql);
    }
    return { success: true, results: [], meta: {} };
  }

  async all() {
    try {
      const stmt = this._db.prepare(this._sql);
      if (this._binds.length) stmt.bind(this._binds);
      const results: any[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return { results, success: true, meta: {} };
    } catch (e: any) {
      console.error("[LocalD1] all error:", e.message, "\nSQL:", this._sql);
      return { results: [], success: true, meta: {} };
    }
  }

  async first(...columns: string[]) {
    try {
      const stmt = this._db.prepare(this._sql);
      if (this._binds.length) stmt.bind(this._binds);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        if (columns.length === 1) return (row as any)[columns[0]] ?? null;
        return row ?? null;
      }
      stmt.free();
      return null;
    } catch (e: any) {
      console.error("[LocalD1] first error:", e.message, "\nSQL:", this._sql);
      return null;
    }
  }

  async raw(): Promise<any[][]> {
    try {
      const stmt = this._db.prepare(this._sql);
      if (this._binds.length) stmt.bind(this._binds);
      const results: any[][] = [];
      while (stmt.step()) {
        results.push(stmt.get() as any[]);
      }
      stmt.free();
      return results;
    } catch (e: any) {
      console.error("[LocalD1] raw error:", e.message, "\nSQL:", this._sql);
      return [];
    }
  }
}

class LocalD1Database {
  private _db: any;

  constructor(db: any) {
    this._db = db;
  }

  prepare(sql: string) {
    return new LocalD1PreparedStatement(this._db, sql);
  }

  async exec(sql: string) {
    this._db.exec(sql);
    return { count: 0, duration: 0 };
  }

  async batch(statements: LocalD1PreparedStatement[]) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }
}

class LocalKVStore {
  private _store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string, type?: string) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() / 1000 > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return type === "json" ? JSON.parse(entry.value) : entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this._store.set(key, {
      value,
      expiresAt: options?.expirationTtl
        ? Date.now() / 1000 + options.expirationTtl
        : undefined,
    });
  }

  async delete(key: string) {
    this._store.delete(key);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================
// 初始化本地 mock 实例
// ============================================================

let localEnv: CloudflareEnv | null = null;
let localEnvPromise: Promise<CloudflareEnv> | null = null;

async function initLocalEnv(): Promise<CloudflareEnv> {
  if (localEnv) return localEnv;
  const db = await initSqlJs();
  localEnv = {
    DB: new LocalD1Database(db) as any,
    RECIPE_CACHE: new LocalKVStore() as any,
  };
  return localEnv;
}

// ============================================================
// 公开 API
// ============================================================

/** 获取 Cloudflare 环境变量和 bindings（异步） */
export async function getEnv(): Promise<CloudflareEnv> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    return env as CloudflareEnv;
  } catch {
    // 本地开发：使用 sql.js mock
    if (!localEnvPromise) {
      localEnvPromise = initLocalEnv();
    }
    return localEnvPromise;
  }
}

/** 检查 KV 是否可用 */
export function hasKV(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    return !!env?.RECIPE_CACHE;
  } catch {
    return false;
  }
}

/** 检查 D1 是否可用 */
export function hasD1(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    return !!env?.DB;
  } catch {
    return false;
  }
}
