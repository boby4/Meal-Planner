import type { RecipeSource, RecipeDetail, RecipeIngredient } from "./types";

const HF_API =
  "https://datasets-server.huggingface.co/rows?dataset=xzm1999/XiaChuFang_Recipe_Corpus&config=default&split=train";

const TOTAL_RECIPES = 1550151;
const BATCH_SIZE = 100; // HF API 每次最多 100 条
const BATCH_COUNT = 10; // 并行获取 10 批
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface CacheEntry {
  data: RecipeSource[];
  expiresAt: number;
}

let cache: CacheEntry | null = null;
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
    throw new Error(`HuggingFace API 错误: ${res.status}`);
  }

  const json = (await res.json()) as { rows: { row: HFRawRecipe }[] };

  if (!Array.isArray(json.rows)) {
    return [];
  }

  const recipes: RecipeSource[] = [];
  for (const { row } of json.rows) {
    const recipe = transformRecipe(row);
    if (recipe) recipes.push(recipe);
  }

  return recipes;
}

/** 加载菜谱数据（异步，带缓存） */
async function loadRecipes(): Promise<RecipeSource[]> {
  // 缓存有效直接返回
  if (cache && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  // 避免并发重复请求
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // 生成多个随机偏移，并行获取
      const offsets = Array.from({ length: BATCH_COUNT }, () =>
        Math.floor(Math.random() * (TOTAL_RECIPES - BATCH_SIZE))
      );
      const batches = await Promise.all(
        offsets.map((offset) => fetchBatchFromHF(offset))
      );
      const data = batches.flat();
      cache = { data, expiresAt: Date.now() + CACHE_TTL };
      console.log(`菜谱数据已从 HuggingFace 加载: ${data.length} 条`);
      return data;
    } catch (err) {
      console.error("HuggingFace 加载失败:", err);
      // 如果有旧缓存，降级使用
      if (cache) return cache.data;
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
