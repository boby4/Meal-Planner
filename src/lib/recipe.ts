import type { RecipeSource, RecipeDetail, RecipeIngredient } from "./types";
import { getEnv } from "./cloudflare";

// ===== 常量 =====
const CHUNK_COUNT = 21; // chunk_000.json ~ chunk_020.json
const CHUNKS_PER_RECIPE = 80000; // 每个分片约 80000 条
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface CacheEntry {
  chunkIndex: number;
  data: RecipeSource[];
  expiresAt: number;
}

// 内存缓存（缓存当前已加载的分片）
let memoryCache: CacheEntry | null = null;
let indexCache: { name: string; chunk: number }[] | null = null;
let indexCacheExpiresAt = 0;

// ===== R2 读取 =====

/** 从 R2 读取一个分片文件 */
async function readChunkFromR2(chunkIndex: number): Promise<RecipeSource[]> {
  const env = await getEnv();
  if (!env?.RECIPE_DATA) {
    console.warn("[Recipe] R2 不可用（无 RECIPE_DATA binding）");
    return [];
  }

  const filename = `chunk_${String(chunkIndex).padStart(3, "0")}.json`;
  console.log(`[Recipe] 从 R2 读取 ${filename}`);

  const obj = await env.RECIPE_DATA.get(filename);
  if (!obj) {
    console.error(`[Recipe] R2 文件不存在: ${filename}`);
    return [];
  }

  const text = await obj.text();
  console.log(`[Recipe] R2 读取 ${filename}: ${(text.length / 1024 / 1024).toFixed(1)}MB`);

  const rawArr = JSON.parse(text) as Array<{
    name: string;
    description?: string;
    ingredients?: string[];
    steps?: string[];
  }>;

  const recipes: RecipeSource[] = [];
  for (const raw of rawArr) {
    if (!raw.name) continue;
    recipes.push({
      name: raw.name,
      description: (raw.description || "").slice(0, 200),
      ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.slice(0, 20) : [],
      steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 15) : [],
    });
  }

  console.log(`[Recipe] 解析 ${filename}: ${recipes.length} 条有效菜谱`);
  return recipes;
}

/** 从 R2 读取搜索索引 */
async function readIndexFromR2(): Promise<{ name: string; chunk: number }[]> {
  // 缓存检查
  if (indexCache && Date.now() < indexCacheExpiresAt) {
    return indexCache;
  }

  const env = await getEnv();
  if (!env?.RECIPE_DATA) {
    console.warn("[Recipe] R2 不可用");
    return [];
  }

  console.log("[Recipe] 从 R2 读取搜索索引 index.json");
  const obj = await env.RECIPE_DATA.get("index.json");
  if (!obj) {
    console.error("[Recipe] R2 索引文件不存在");
    return [];
  }

  const text = await obj.text();
  indexCache = JSON.parse(text) as { name: string; chunk: number }[];
  indexCacheExpiresAt = Date.now() + MEMORY_CACHE_TTL;
  console.log(`[Recipe] 索引加载完成: ${indexCache.length} 条`);
  return indexCache;
}

// ===== 核心 API =====

/** 加载菜谱数据（内存缓存 → R2 随机分片） */
async function loadRecipes(): Promise<RecipeSource[]> {
  // 1. 内存缓存检查
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    console.log(`[Recipe] 内存缓存命中: 分片 ${memoryCache.chunkIndex}, ${memoryCache.data.length} 条`);
    return memoryCache.data;
  }

  // 2. 随机选一个分片
  const chunkIndex = Math.floor(Math.random() * CHUNK_COUNT);
  console.log(`[Recipe] 随机选择分片: ${chunkIndex}`);

  try {
    const data = await readChunkFromR2(chunkIndex);
    if (data.length > 0) {
      memoryCache = { chunkIndex, data, expiresAt: Date.now() + MEMORY_CACHE_TTL };
    }
    return data;
  } catch (err) {
    console.error(`[Recipe] 读取分片 ${chunkIndex} 失败:`, err);
    // 降级：返回过期缓存
    if (memoryCache) {
      console.log(`[Recipe] 降级使用过期内存缓存: ${memoryCache.data.length} 条`);
      return memoryCache.data;
    }
    return [];
  }
}

/** 获取所有菜谱（当前分片） */
export async function getAllRecipes(): Promise<RecipeSource[]> {
  return loadRecipes();
}

/** 根据菜名搜索（通过索引 → 定位分片 → 读取数据） */
export async function searchRecipes(query: string): Promise<RecipeSource[]> {
  const lowerQuery = query.toLowerCase();

  // 1. 读取索引，找到匹配的菜名和分片
  const index = await readIndexFromR2();
  if (index.length === 0) {
    // 索引不可用，降级到当前分片搜索
    const recipes = await loadRecipes();
    return recipes.filter((r) => r.name.toLowerCase().includes(lowerQuery));
  }

  const matches = index.filter((item) => item.name.toLowerCase().includes(lowerQuery));
  if (matches.length === 0) return [];

  console.log(`[Recipe] 搜索 "${query}": 索引匹配 ${matches.length} 条`);

  // 2. 获取需要读取的分片（去重）
  const neededChunks = [...new Set(matches.map((m) => m.chunk))];
  const matchNames = new Set(matches.map((m) => m.name));

  // 3. 并行读取分片
  const chunkResults = await Promise.allSettled(
    neededChunks.map((ci) => {
      // 如果刚好是缓存的分片，直接用
      if (memoryCache && memoryCache.chunkIndex === ci) {
        return Promise.resolve(memoryCache.data);
      }
      return readChunkFromR2(ci);
    })
  );

  // 4. 合并结果
  const results: RecipeSource[] = [];
  for (const result of chunkResults) {
    if (result.status === "fulfilled") {
      for (const recipe of result.value) {
        if (matchNames.has(recipe.name)) {
          results.push(recipe);
        }
      }
    }
  }

  console.log(`[Recipe] 搜索 "${query}": 返回 ${results.length} 条结果`);
  return results;
}

/** 根据菜名精确查找 */
export async function findRecipeByName(
  name: string
): Promise<RecipeSource | null> {
  // 1. 通过索引定位分片
  const index = await readIndexFromR2();
  if (index.length > 0) {
    // 精确匹配
    const exact = index.find((item) => item.name === name);
    // 模糊匹配
    const fuzzy = !exact
      ? index.find((item) => item.name.includes(name) || name.includes(item.name))
      : null;
    const match = exact || fuzzy;

    if (match) {
      let data: RecipeSource[];
      if (memoryCache && memoryCache.chunkIndex === match.chunk) {
        data = memoryCache.data;
      } else {
        data = await readChunkFromR2(match.chunk);
      }
      const recipe = data.find((r) => r.name === match.name);
      if (recipe) return recipe;
    }
    return null;
  }

  // 2. 索引不可用，降级到当前分片
  const recipes = await loadRecipes();
  const exactMatch = recipes.find((r) => r.name === name);
  if (exactMatch) return exactMatch;
  return recipes.find((r) => r.name.includes(name) || name.includes(r.name)) ?? null;
}

/** 随机获取一道菜（排除指定菜名） */
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

/** 解析食材字符串为 RecipeIngredient */
function parseIngredient(raw: string): RecipeIngredient {
  const match = raw.match(/^(.+?)\s+(\d.+)$/);
  if (match) {
    return { name: match[1].trim(), amount: match[2].trim() };
  }
  return { name: raw };
}

/** 将数据源格式转换为 RecipeDetail */
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
