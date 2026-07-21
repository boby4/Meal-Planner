import { useState, useCallback, useRef } from "react";
import { useMealStore } from "@/stores/useMealStore";
import { buildAIRecommendPrompt, buildIngredientPrompt } from "@/lib/prompts";
import type { AIRecommendResponse, RecommendedRecipe } from "@/lib/types";

// ===== 配置 =====
const DEBOUNCE_DELAY = 300; // 防抖延迟（毫秒）
const MIN_CLICK_INTERVAL = 1000; // 最小点击间隔（毫秒）

/** 调用 AI 推荐 API */
async function fetchAIRecommend(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): Promise<AIRecommendResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok) {
    if (res.status === 429) {
      const data = await res.json();
      throw new Error(`请求过于频繁，请 ${data.retryAfter || 60} 秒后再试`);
    }
    throw new Error(`AI 推荐请求失败: ${res.status}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.content) as AIRecommendResponse;
  return parsed;
}

/** 推荐逻辑 Hook */
export function useRecommendation() {
  const {
    mode,
    filters,
    history,
    setMode,
    setRecommendations,
    setLoading,
    setError,
  } = useMealStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastClickTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /** 检查点击间隔 */
  const checkClickInterval = useCallback(() => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < MIN_CLICK_INTERVAL) {
      return false;
    }
    lastClickTimeRef.current = now;
    return true;
  }, []);

  /** 取消当前请求 */
  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /** 随机推荐 */
  const randomRecommend = useCallback(async () => {
    if (!checkClickInterval()) {
      console.log("[Recommend] 点击过于频繁，忽略");
      return;
    }

    cancelCurrentRequest();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3, excludeNames: history }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const data = await res.json();
          throw new Error(`请求过于频繁，请 ${data.retryAfter || 60} 秒后再试`);
        }
        throw new Error(`随机推荐失败: ${res.status}`);
      }

      const data = await res.json();
      setMode("random");
      setRecommendations(data.recipes as RecommendedRecipe[]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // 忽略取消的请求
      }
      setError(err instanceof Error ? err.message : "随机推荐失败");
    } finally {
      setLoading(false);
    }
  }, [history, setMode, setRecommendations, setLoading, setError, checkClickInterval, cancelCurrentRequest]);

  /** AI 条件推荐 */
  const aiRecommend = useCallback(async () => {
    if (!checkClickInterval()) {
      console.log("[Recommend] 点击过于频繁，忽略");
      return;
    }

    cancelCurrentRequest();
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const messages = buildAIRecommendPrompt(filters, history);
      const result = await fetchAIRecommend(messages, controller.signal);

      setMode("ai");
      setRecommendations(result.recipes);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // 忽略取消的请求
      }
      setError(err instanceof Error ? err.message : "AI 推荐失败");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [filters, history, setMode, setRecommendations, setLoading, setError, checkClickInterval, cancelCurrentRequest]);

  /** 冰箱食材推荐 */
  const ingredientRecommend = useCallback(
    async (ingredients: string[]) => {
      if (!checkClickInterval()) {
        console.log("[Recommend] 点击过于频繁，忽略");
        return;
      }

      cancelCurrentRequest();
      setLoading(true);
      setError(null);

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const messages = buildIngredientPrompt(ingredients, history);
        const result = await fetchAIRecommend(messages, controller.signal);

        setMode("ingredient");
        setRecommendations(result.recipes);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return; // 忽略取消的请求
        }
        setError(err instanceof Error ? err.message : "食材推荐失败");
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [history, setMode, setRecommendations, setLoading, setError, checkClickInterval, cancelCurrentRequest]
  );

  /** 换一道 */
  const refreshRecommend = useCallback(async () => {
    if (!checkClickInterval()) {
      console.log("[Recommend] 点击过于频繁，忽略");
      return;
    }

    cancelCurrentRequest();
    setIsRefreshing(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (mode === "random") {
        const res = await fetch("/api/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 3, excludeNames: history }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            const data = await res.json();
            throw new Error(`请求过于频繁，请 ${data.retryAfter || 60} 秒后再试`);
          }
          throw new Error(`换一道失败: ${res.status}`);
        }

        const data = await res.json();
        setRecommendations(data.recipes as RecommendedRecipe[]);
      } else {
        const messages =
          mode === "ai"
            ? buildAIRecommendPrompt(filters, history)
            : buildIngredientPrompt(filters.ingredients, history);
        const result = await fetchAIRecommend(messages, controller.signal);
        setRecommendations(result.recipes);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // 忽略取消的请求
      }
      setError(err instanceof Error ? err.message : "换一道失败");
    } finally {
      setIsRefreshing(false);
      abortControllerRef.current = null;
    }
  }, [mode, filters, history, setRecommendations, setError, checkClickInterval, cancelCurrentRequest]);

  return {
    randomRecommend,
    aiRecommend,
    ingredientRecommend,
    refreshRecommend,
    isRefreshing,
    cancelCurrentRequest,
  };
}
