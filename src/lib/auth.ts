/**
 * 认证工具函数
 * 使用 Web Crypto API（兼容 Cloudflare Workers + Node.js）
 */

import { getEnv } from "./cloudflare";

interface AuthUser {
  id: number;
  email: string;
  username: string;
}

/** 生成随机 token */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 生成随机 salt */
function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PBKDF2 密码哈希 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 注册用户 */
export async function registerUser(
  email: string,
  password: string,
  username?: string
): Promise<{ token: string; user: AuthUser }> {
  const env = await getEnv();
  if (!env?.DB) throw new Error("数据库不可用");

  // 检查邮箱是否已注册
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) throw new Error("该邮箱已注册");

  // 检查用户名是否已存在（如果提供了用户名）
  if (username) {
    const usernameExists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (usernameExists) throw new Error("该用户名已被使用");
  }

  // 创建用户
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const finalUsername = username || email.split('@')[0];

  const result = await env.DB.prepare(
    "INSERT INTO users (email, username, password_hash, salt) VALUES (?, ?, ?, ?) RETURNING id"
  ).bind(email, finalUsername, passwordHash, salt).first() as { id: number };

  // 创建 session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 天

  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(token, result.id, expiresAt).run();

  return { token, user: { id: result.id, email, username: finalUsername } };
}

/** 登录 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const env = await getEnv();
  if (!env?.DB) throw new Error("数据库不可用");

  const user = await env.DB.prepare(
    "SELECT id, email, username, password_hash, salt FROM users WHERE email = ?"
  ).bind(email).first() as { id: number; email: string; username: string; password_hash: string; salt: string } | null;

  if (!user) throw new Error("邮箱或密码错误");

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) throw new Error("邮箱或密码错误");

  // 清理过期 session
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();

  // 创建新 session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(token, user.id, expiresAt).run();

  return { token, user: { id: user.id, email: user.email, username: user.username || user.email.split('@')[0] } };
}

/** 验证 token，返回用户信息 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  const env = await getEnv();
  if (!env?.DB) return null;

  const session = await env.DB.prepare(
    "SELECT s.user_id, u.email, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
  ).bind(token).first() as { user_id: number; email: string; username: string } | null;

  return session ? { id: session.user_id, email: session.email, username: session.username || session.email.split('@')[0] } : null;
}

/** 退出登录 */
export async function logoutUser(token: string): Promise<void> {
  const env = await getEnv();
  if (!env?.DB) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

/** 更新用户名 */
export async function updateUsername(userId: number, username: string): Promise<{ success: boolean; error?: string }> {
  const env = await getEnv();
  if (!env?.DB) throw new Error("数据库不可用");

  if (!username || username.trim().length < 2) {
    return { success: false, error: "用户名至少2个字符" };
  }

  if (username.trim().length > 20) {
    return { success: false, error: "用户名不能超过20个字符" };
  }

  // 检查用户名是否已存在
  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?").bind(username.trim(), userId).first();
  if (existing) {
    return { success: false, error: "该用户名已被使用" };
  }

  await env.DB.prepare("UPDATE users SET username = ? WHERE id = ?").bind(username.trim(), userId).run();
  return { success: true };
}

/** 合并设备数据到用户账号 */
export async function mergeDeviceData(userId: number, deviceId: string): Promise<void> {
  const env = await getEnv();
  if (!env?.DB || !deviceId) return;

  const tables = ["favorites", "history", "weekly_menu", "shopping_list", "user_preferences"];
  for (const table of tables) {
    await env.DB.prepare(
      `UPDATE ${table} SET user_id = ?, device_id = '' WHERE device_id = ? AND user_id IS NULL`
    ).bind(userId, deviceId).run();
  }
}

/** 从请求中提取认证信息 */
export async function getAuthFromRequest(request: Request): Promise<{ userId: number | null; deviceId: string }> {
  const authHeader = request.headers.get("Authorization");
  const deviceId = request.headers.get("x-device-id") || "";

  let userId: number | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const user = await verifyToken(token);
    if (user) userId = user.id;
  }

  return { userId, deviceId };
}

/** 要求登录：未登录返回 401 */
export async function requireAuth(request: Request): Promise<{ userId: number }> {
  const { userId } = await getAuthFromRequest(request);
  if (!userId) {
    throw new AuthRequiredError();
  }
  return { userId };
}

export class AuthRequiredError extends Error {
  constructor() {
    super("请先登录");
    this.name = "AuthRequiredError";
  }
}
