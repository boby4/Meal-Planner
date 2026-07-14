import type { RecipeSource, RecipeDetail, RecipeIngredient } from "./types";
import { getEnv } from "./cloudflare";

const HF_API =
  "https://datasets-server.huggingface.co/rows?dataset=xzm1999/XiaChuFang_Recipe_Corpus&config=default&split=train";

const TOTAL_RECIPES = 1550151;
const BATCH_SIZE = 100;
const BATCH_COUNT = 10;
const KV_CACHE_KEY = "recipe_cache_v1";
const KV_CACHE_TTL = 600; // 10 分钟（秒）
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 分钟（毫秒）

interface CacheEntry {
  data: RecipeSource[];
  expiresAt: number;
}

// 内存缓存（fallback / 本地开发）
let memoryCache: CacheEntry | null = null;
let loadingPromise: Promise<RecipeSource[]> | null = null;

/** HF 原始数据字段 */
interface HFRawRecipe {
  name?: string;
  dish?: string;
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?: string[];
}

/** 将 HF 原始数据转换为 RecipeSource */
function transformRecipe(raw: HFRawRecipe): RecipeSource | null {
  const name = raw.name || raw.dish || "";
  if (!name) return null;

  return {
    name,
    description: (raw.description || "").slice(0, 200),
    ingredients: Array.isArray(raw.recipeIngredient)
      ? raw.recipeIngredient
          .map((i) => (typeof i === "string" ? i : String(i)))
          .filter(Boolean)
          .slice(0, 20)
      : [],
    steps: Array.isArray(raw.recipeInstructions)
      ? raw.recipeInstructions
          .map((s) => (typeof s === "string" ? s : String(s)))
          .filter(Boolean)
          .slice(0, 15)
      : [],
  };
}

/** 从 HuggingFace 获取一批菜谱 */
async function fetchBatchFromHF(offset: number): Promise<RecipeSource[]> {
  const url = `${HF_API}&offset=${offset}&length=${BATCH_SIZE}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`[Recipe] HF 批次 offset=${offset} 失败: HTTP ${res.status}`);
    throw new Error(`HuggingFace API 错误: ${res.status}`);
  }

  const json = (await res.json()) as { rows: { row: HFRawRecipe }[] };

  if (!Array.isArray(json.rows)) {
    console.warn(`[Recipe] HF 批次 offset=${offset} 返回格式异常: rows 不是数组`);
    return [];
  }

  const recipes: RecipeSource[] = [];
  for (const { row } of json.rows) {
    const recipe = transformRecipe(row);
    if (recipe) recipes.push(recipe);
  }

  console.log(`[Recipe] HF 批次 offset=${offset} 成功: ${recipes.length}/${json.rows.length} 条有效`);
  return recipes;
}

/** 从 KV 读取缓存 */
async function getFromKV(): Promise<RecipeSource[] | null> {
  try {
    const env = await getEnv();
    if (!env?.RECIPE_CACHE) {
      console.log("[Recipe] KV 不可用（无 RECIPE_CACHE binding）");
      return null;
    }
    const raw = await env.RECIPE_CACHE.get(KV_CACHE_KEY, "text");
    if (!raw) {
      console.log("[Recipe] KV 缓存为空");
      return null;
    }
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() < parsed.expiresAt) {
      console.log(`[Recipe] KV 缓存命中: ${parsed.data.length} 条，剩余 ${(parsed.expiresAt - Date.now()) / 1000 | 0}s`);
      return parsed.data;
    }
    console.log(`[Recipe] KV 缓存已过期: 过期 ${((Date.now() - parsed.expiresAt) / 1000 | 0)}s`);
    return null;
  } catch (err) {
    console.warn("[Recipe] KV 读取失败:", err);
    return null;
  }
}

/** 写入 KV 缓存 */
async function setToKV(data: RecipeSource[]): Promise<void> {
  try {
    const env = await getEnv();
    if (!env?.RECIPE_CACHE) return;
    const entry: CacheEntry = { data, expiresAt: Date.now() + KV_CACHE_TTL * 1000 };
    await env.RECIPE_CACHE.put(KV_CACHE_KEY, JSON.stringify(entry), {
      expirationTtl: KV_CACHE_TTL,
    });
  } catch (err) {
    console.warn("KV 写入失败:", err);
  }
}

/** 从 HuggingFace 拉取新鲜数据 */
async function fetchFromHF(): Promise<RecipeSource[]> {
  const offsets = Array.from({ length: BATCH_COUNT }, () =>
    Math.floor(Math.random() * (TOTAL_RECIPES - BATCH_SIZE))
  );
  // 使用 allSettled：单批失败不影响其他批次
  const results = await Promise.allSettled(
    offsets.map((offset) => fetchBatchFromHF(offset))
  );
  const recipes: RecipeSource[] = [];
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      recipes.push(...result.value);
    } else {
      failed++;
      console.error(`[Recipe] HF 批次失败:`, result.reason);
    }
  }
  console.log(`[Recipe] HF 拉取完成: ${BATCH_COUNT - failed}/${BATCH_COUNT} 批成功, 共 ${recipes.length} 条`);
  if (recipes.length === 0) {
    throw new Error("HuggingFace 所有批次均失败");
  }
  return recipes;
}

/** 加载菜谱数据（KV 优先 → HuggingFace → 内存缓存降级） */
async function loadRecipes(): Promise<RecipeSource[]> {
  // 1. 内存缓存检查
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    console.log(`[Recipe] 内存缓存命中: ${memoryCache.data.length} 条，剩余 ${(memoryCache.expiresAt - Date.now()) / 1000 | 0}s`);
    return memoryCache.data;
  }

  // 2. 避免并发重复请求
  if (loadingPromise) {
    console.log("[Recipe] 已有加载中请求，复用");
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // 3. 尝试 KV 缓存
      const kvData = await getFromKV();
      if (kvData && kvData.length > 0) {
        memoryCache = { data: kvData, expiresAt: Date.now() + MEMORY_CACHE_TTL };
        return kvData;
      }

      // 4. KV 未命中，从 HuggingFace 拉取
      const data = await fetchFromHF();
      memoryCache = { data, expiresAt: Date.now() + MEMORY_CACHE_TTL };
      console.log(`菜谱数据已从 HuggingFace 加载: ${data.length} 条`);

      // 5. 写入 KV 缓存
      await setToKV(data);

      return data;
    } catch (err) {
      console.error("[Recipe] 加载失败:", err);
      // 降级：即使缓存过期也返回，总比空数组好
      if (memoryCache) {
        console.log(`[Recipe] 降级使用过期内存缓存: ${memoryCache.data.length} 条，已过期 ${((Date.now() - memoryCache.expiresAt) / 1000 | 0)}s`);
        return memoryCache.data;
      }
      console.error("[Recipe] 无任何缓存可用，返回空数组");
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

/** 根据菜名搜索（模糊匹配） */
export async function searchRecipes(query: string): Promise<RecipeSource[]> {
  const recipes = await loadRecipes();
  const lowerQuery = query.toLowerCase();
  return recipes.filter((r) => r.name.toLowerCase().includes(lowerQuery));
}

/** 根据菜名精确查找 */
export async function findRecipeByName(
  name: string
): Promise<RecipeSource | null> {
  const recipes = await loadRecipes();
  const exact = recipes.find((r) => r.name === name);
  if (exact) return exact;
  const fuzzy = recipes.find(
    (r) => r.name.includes(name) || name.includes(r.name)
  );
  return fuzzy ?? null;
}

/** 随机获取一道菜（排除指定菜名） */
export async function getRandomRecipe(
  excludeNames: string[] = []
): Promise<RecipeSource | null> {
  const recipes = await loadRecipes();
  const filtered = recipes.filter((r) => !excludeNames.includes(r.name));
  if (filtered.length === 0) return null;
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
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
