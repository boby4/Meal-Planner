import type { RecipeSource, RecipeDetail, RecipeIngredient } from "./types";
import { getEnv } from "./cloudflare";
import { kvCache, generateCacheKey } from "./cache";

// ===== 常量 =====
const CHUNK_COUNT = 21; // chunk_000.json ~ chunk_020.json
const ESTIMATED_CHUNK_SIZE = 55 * 1024 * 1024; // 约 55MB
const READ_SIZE = 512 * 1024; // 每次读取 512KB（足够解析 ~800 条菜谱）
const MEMORY_CACHE_TTL = 10 * 60 * 1000; // 10 分钟
const SEARCH_CACHE_TTL = 30 * 60 * 1000; // 搜索缓存 30 分钟
const INDEX_READ_SIZE = 2 * 1024 * 1024; // 索引每次读 2MB

interface CacheEntry {
  data: RecipeSource[];
  expiresAt: number;
}

// 内存缓存
let memoryCache: CacheEntry | null = null;
let loadingPromise: Promise<RecipeSource[]> | null = null;

// 搜索结果缓存（内存 L1）
const searchCache = new Map<string, CacheEntry>();

// ===== R2 范围读取 =====

/**
 * 从 R2 JSON 数组文件的随机位置读取一段，提取完整的 JSON 对象
 * 避免加载整个 55MB 文件到内存
 */
async function readRandomRecipesFromChunk(
  chunkIndex: number
): Promise<RecipeSource[]> {
  const env = await getEnv();
  if (!env?.RECIPE_DATA) {
    console.warn("[Recipe] R2 不可用");
    return [];
  }

  const filename = `chunk_${String(chunkIndex).padStart(3, "0")}.json`;

  // 先 head 获取文件大小
  const head = await env.RECIPE_DATA.head(filename);
  if (!head) {
    console.error(`[Recipe] R2 文件不存在: ${filename}`);
    return [];
  }

  const fileSize = head.size;
  console.log(`[Recipe] ${filename} 大小: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

  // 随机偏移（跳过开头的 [ ，从第 2 字节之后开始）
  const maxOffset = Math.max(2, fileSize - READ_SIZE);
  const offset = Math.floor(Math.random() * maxOffset);
  const end = Math.min(offset + READ_SIZE, fileSize - 1);

  console.log(`[Recipe] 读取 ${filename} 字节范围: ${offset}-${end} (${((end - offset) / 1024).toFixed(0)}KB)`);

  const obj = await env.RECIPE_DATA.get(filename, {
    range: { offset, length: end - offset + 1 },
  });
  if (!obj) return [];

  const text = await obj.text();

  // 从文本中提取完整的 JSON 对象
  return extractRecipesFromSlice(text);
}

/** 从 JSON 数组的片段中提取完整的菜谱对象 */
function extractRecipesFromSlice(text: string): RecipeSource[] {
  const recipes: RecipeSource[] = [];

  // 找到第一个 { 和最后一个 } 之间的内容
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return [];
  }

  // 从 firstBrace 开始，逐个提取完整的 JSON 对象
  let pos = firstBrace;
  while (pos < lastBrace) {
    const objStart = text.indexOf("{", pos);
    if (objStart === -1 || objStart > lastBrace) break;

    // 找到匹配的 } （简单计数法，处理嵌套）
    const objEnd = findMatchingBrace(text, objStart);
    if (objEnd === -1 || objEnd > lastBrace) break;

    const jsonStr = text.slice(objStart, objEnd + 1);
    try {
      const raw = JSON.parse(jsonStr) as {
        name?: string;
        description?: string;
        ingredients?: string[];
        steps?: string[];
      };
      if (raw.name) {
        recipes.push({
          name: raw.name,
          description: (raw.description || "").slice(0, 200),
          ingredients: Array.isArray(raw.ingredients)
            ? raw.ingredients.slice(0, 20)
            : [],
          steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 15) : [],
        });
      }
    } catch {
      // 跳过解析失败的片段
    }

    pos = objEnd + 1;
  }

  return recipes;
}

/** 找到与位置 start 处的 { 匹配的 } 的位置 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

// ===== 搜索相关 =====

/** 清理过期的搜索缓存（惰性清理） */
function cleanSearchCache() {
  const now = Date.now();
  for (const [key, entry] of searchCache.entries()) {
    if (now > entry.expiresAt) {
      searchCache.delete(key);
    }
  }
}

/** 从 R2 索引文件的特定范围读取条目 */
async function readIndexRange(
  offset: number,
  length: number
): Promise<{ name: string; chunk: number }[]> {
  const env = await getEnv();
  if (!env?.RECIPE_DATA) return [];

  const obj = await env.RECIPE_DATA.get("index.json", {
    range: { offset, length },
  });
  if (!obj) return [];

  const text = await obj.text();
  const entries: { name: string; chunk: number }[] = [];

  // 提取完整的 {"name":...,"chunk":N} 对象
  let pos = text.indexOf("{");
  while (pos !== -1) {
    const end = text.indexOf("}", pos);
    if (end === -1) break;
    try {
      const entry = JSON.parse(text.slice(pos, end + 1)) as {
        name: string;
        chunk: number;
      };
      if (entry.name !== undefined && entry.chunk !== undefined) {
        entries.push(entry);
      }
    } catch {
      // skip
    }
    pos = text.indexOf("{", end + 1);
  }

  return entries;
}

/** 搜索菜谱（通过索引范围读取，带缓存） */
export async function searchRecipes(
  query: string
): Promise<RecipeSource[]> {
  const lowerQuery = query.toLowerCase();
  const cacheKey = `search:${lowerQuery}`;
  const kvKey = generateCacheKey("search", lowerQuery);

  // 惰性清理过期缓存
  cleanSearchCache();

  // L1: 检查内存缓存
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[Recipe] 搜索内存缓存命中: "${query}"，${cached.data.length} 条`);
    return cached.data;
  }

  // L2: 检查 KV 缓存
  const kvCached = await kvCache.get<RecipeSource[]>(kvKey);
  if (kvCached) {
    console.log(`[Recipe] 搜索 KV 缓存命中: "${query}"，${kvCached.length} 条`);
    // 回填到内存缓存
    searchCache.set(cacheKey, {
      data: kvCached,
      expiresAt: Date.now() + SEARCH_CACHE_TTL,
    });
    return kvCached;
  }

  const env = await getEnv();

  // 获取索引文件大小
  const head = await env?.RECIPE_DATA?.head("index.json");
  if (!head) {
    console.warn("[Recipe] 索引不可用，降级到缓存搜索");
    return (memoryCache?.data || []).filter((r) =>
      r.name.toLowerCase().includes(lowerQuery)
    );
  }

  const fileSize = head.size;
  console.log(`[Recipe] 搜索 "${query}"，索引大小: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

  // 分段读取索引，查找匹配项
  const matchNames = new Set<string>();
  const matchChunks = new Set<number>();
  const stride = INDEX_READ_SIZE;

  for (let offset = 0; offset < fileSize; offset += stride) {
    const length = Math.min(stride, fileSize - offset);
    const entries = await readIndexRange(offset, length);

    for (const entry of entries) {
      if (entry.name.toLowerCase().includes(lowerQuery)) {
        matchNames.add(entry.name);
        matchChunks.add(entry.chunk);
      }
    }

    // 限制最大搜索量（避免读太多）
    if (offset > 20 * 1024 * 1024) {
      console.warn("[Recipe] 搜索已扫描 20MB 索引，停止");
      break;
    }
  }

  if (matchNames.size === 0) {
    console.log(`[Recipe] 搜索 "${query}": 无匹配`);
    return [];
  }

  console.log(
    `[Recipe] 搜索 "${query}": 匹配 ${matchNames.size} 条，涉及 ${matchChunks.size} 个分片`
  );

  // 读取匹配的分片，提取对应菜谱
  const results: RecipeSource[] = [];
  const chunkArr = [...matchChunks];

  // 并行读取分片（限制并发）
  for (let i = 0; i < chunkArr.length && results.length < 50; i += 3) {
    const batch = chunkArr.slice(i, i + 3);
    const chunkResults = await Promise.allSettled(
      batch.map((ci) => readFullChunk(ci))
    );

    for (const result of chunkResults) {
      if (result.status === "fulfilled") {
        for (const recipe of result.value) {
          if (matchNames.has(recipe.name)) {
            results.push(recipe);
          }
        }
      }
    }
  }

  console.log(`[Recipe] 搜索 "${query}": 返回 ${results.length} 条`);

  // 缓存搜索结果（内存 L1 + KV L2）
  if (results.length > 0) {
    // 写入内存缓存
    searchCache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + SEARCH_CACHE_TTL,
    });

    // 异步写入 KV 缓存（不阻塞返回）
    kvCache.set(kvKey, results, SEARCH_CACHE_TTL / 1000).catch((err) => {
      console.error("[Recipe] KV 缓存写入失败:", err);
    });
  }

  return results;
}

/** 读取整个分片（仅用于搜索时获取匹配的菜谱） */
async function readFullChunk(chunkIndex: number): Promise<RecipeSource[]> {
  const env = await getEnv();
  if (!env?.RECIPE_DATA) return [];

  const filename = `chunk_${String(chunkIndex).padStart(3, "0")}.json`;
  const obj = await env.RECIPE_DATA.get(filename);
  if (!obj) return [];

  const text = await obj.text();
  const rawArr = JSON.parse(text) as Array<{
    name: string;
    description?: string;
    ingredients?: string[];
    steps?: string[];
  }>;

  return rawArr
    .filter((r) => r.name)
    .map((r) => ({
      name: r.name,
      description: (r.description || "").slice(0, 200),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.slice(0, 20) : [],
      steps: Array.isArray(r.steps) ? r.steps.slice(0, 15) : [],
    }));
}

// ===== 核心 API =====

/** 加载菜谱数据（缓存 → R2 范围读取） */
async function loadRecipes(): Promise<RecipeSource[]> {
  // 内存缓存
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    console.log(`[Recipe] 内存缓存命中: ${memoryCache.data.length} 条`);
    return memoryCache.data;
  }

  // 避免并发
  if (loadingPromise) {
    console.log("[Recipe] 复用加载中请求");
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // 随机选分片，范围读取
      const chunkIndex = Math.floor(Math.random() * CHUNK_COUNT);
      console.log(`[Recipe] 随机选择分片: ${chunkIndex}`);

      const data = await readRandomRecipesFromChunk(chunkIndex);
      console.log(`[Recipe] 从 R2 获取: ${data.length} 条`);

      if (data.length > 0) {
        memoryCache = { data, expiresAt: Date.now() + MEMORY_CACHE_TTL };
      }
      return data;
    } catch (err) {
      console.error("[Recipe] 加载失败:", err);
      if (memoryCache) {
        console.log(`[Recipe] 降级使用缓存: ${memoryCache.data.length} 条`);
        return memoryCache.data;
      }
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/** 获取所有菜谱 */
export async function getAllRecipes(): Promise<RecipeSource[]> {
  return loadRecipes();
}

/** 根据菜名精确查找 */
export async function findRecipeByName(
  name: string
): Promise<RecipeSource | null> {
  try {
    // 先查缓存
    if (memoryCache) {
      const found = memoryCache.data.find(
        (r) =>
          r.name === name ||
          r.name.includes(name) ||
          name.includes(r.name)
      );
      if (found) return found;
    }

    // 通过搜索获取（带超时保护）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("搜索超时")), 15000);
    });

    const searchPromise = searchRecipes(name);
    const results = await Promise.race([searchPromise, timeoutPromise]);

    if (results.length > 0) {
      const exact = results.find((r) => r.name === name);
      return exact || results[0];
    }
    return null;
  } catch (error) {
    console.error("[Recipe] findRecipeByName 失败:", error);
    // 搜索失败时返回 null，让调用者决定是否使用 AI 生成
    return null;
  }
}

/** 随机获取一道菜 */
export async function getRandomRecipe(
  excludeNames: string[] = []
): Promise<RecipeSource | null> {
  const recipes = await loadRecipes();
  const filtered = recipes.filter((r) => !excludeNames.includes(r.name));
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/** 随机获取多道菜 */
export async function getRandomRecipes(
  count: number,
  excludeNames: string[] = []
): Promise<RecipeSource[]> {
  const recipes = await loadRecipes();
  const filtered = recipes.filter((r) => !excludeNames.includes(r.name));
  if (filtered.length === 0) return [];

  const shuffled = [...filtered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** 解析食材字符串 */
function parseIngredient(raw: string): RecipeIngredient {
  const match = raw.match(/^(.+?)\s+(\d.+)$/);
  if (match) {
    return { name: match[1].trim(), amount: match[2].trim() };
  }
  return { name: raw };
}

/** 转换为 RecipeDetail */
export function toRecipeDetail(source: RecipeSource): RecipeDetail {
  const ingredients: RecipeIngredient[] = source.ingredients.map(
    parseIngredient
  );

  return {
    name: source.name,
    description: source.description || "",
    time: "约30分钟",
    difficulty: "中等",
    ingredients,
    steps: source.steps,
    tips: [],
  };
}
