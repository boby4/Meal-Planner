import { getEnv } from "./cloudflare";

// ===== 缓存配置 =====
const CACHE_PREFIX = "meal-planner:";
const DEFAULT_TTL = 30 * 60; // 30 分钟（秒）

/** KV 缓存工具 */
export const kvCache = {
  /** 获取缓存 */
  async get<T>(key: string): Promise<T | null> {
    try {
      const env = await getEnv();
      if (!env?.RECIPE_CACHE) {
        return null;
      }

      const fullKey = `${CACHE_PREFIX}${key}`;
      const cached = await env.RECIPE_CACHE.get(fullKey, { type: "json" });

      if (cached && typeof cached === "object" && "data" in cached) {
        const entry = cached as { data: T; expiresAt: number };
        if (Date.now() < entry.expiresAt) {
          console.log(`[Cache] KV 命中: ${key}`);
          return entry.data;
        }
        // 过期，删除
        await env.RECIPE_CACHE.delete(fullKey);
      }

      return null;
    } catch (error) {
      console.error("[Cache] KV 读取失败:", error);
      return null;
    }
  },

  /** 设置缓存 */
  async set<T>(key: string, data: T, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      const env = await getEnv();
      if (!env?.RECIPE_CACHE) {
        return;
      }

      const fullKey = `${CACHE_PREFIX}${key}`;
      const entry = {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000,
      };

      await env.RECIPE_CACHE.put(fullKey, JSON.stringify(entry), {
        expirationTtl: ttlSeconds,
      });

      console.log(`[Cache] KV 写入: ${key}，TTL: ${ttlSeconds}s`);
    } catch (error) {
      console.error("[Cache] KV 写入失败:", error);
    }
  },

  /** 删除缓存 */
  async delete(key: string): Promise<void> {
    try {
      const env = await getEnv();
      if (!env?.RECIPE_CACHE) {
        return;
      }

      const fullKey = `${CACHE_PREFIX}${key}`;
      await env.RECIPE_CACHE.delete(fullKey);
      console.log(`[Cache] KV 删除: ${key}`);
    } catch (error) {
      console.error("[Cache] KV 删除失败:", error);
    }
  },

  /** 清除所有缓存（慎用） */
  async clearAll(): Promise<void> {
    try {
      const env = await getEnv();
      if (!env?.RECIPE_CACHE) {
        return;
      }

      // KV 不支持批量删除，需要逐个删除
      // 这里只是示例，实际应该限制前缀
      console.warn("[Cache] clearAll 未实现（KV 不支持批量删除）");
    } catch (error) {
      console.error("[Cache] KV 清除失败:", error);
    }
  },
};

/** 生成缓存键 */
export function generateCacheKey(...parts: string[]): string {
  return parts.join(":").toLowerCase().replace(/\s+/g, "_");
}
