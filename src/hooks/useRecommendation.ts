import { useState, useCallback } from "react";
import { useMealStore } from "@/stores/useMealStore";
import { buildAIRecommendPrompt, buildIngredientPrompt } from "@/lib/prompts";
import type { AIRecommendResponse, RecommendedRecipe } from "@/lib/types";

/** 调用 AI 推荐 API */
async function fetchAIRecommend(
  messages: { role: string; content: string }[]
): Promise<AIRecommendResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
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

  /** 随机推荐 */
  const randomRecommend = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3, excludeNames: history }),
      });
      const data = await res.json();
      setMode("random");
      setRecommendations(data.recipes as RecommendedRecipe[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "随机推荐失败");
    } finally {
      setLoading(false);
    }
  }, [history, setMode, setRecommendations, setLoading, setError]);

  /** AI 条件推荐 */
  const aiRecommend = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const messages = buildAIRecommendPrompt(filters, history);
      const result = await fetchAIRecommend(messages);
      setMode("ai");
      setRecommendations(result.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 推荐失败");
    } finally {
      setLoading(false);
    }
  }, [filters, history, setMode, setRecommendations, setLoading, setError]);

  /** 冰箱食材推荐 */
  const ingredientRecommend = useCallback(
    async (ingredients: string[]) => {
      setLoading(true);
      setError(null);
      try {
        const messages = buildIngredientPrompt(ingredients, history);
        const result = await fetchAIRecommend(messages);
        setMode("ingredient");
        setRecommendations(result.recipes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "食材推荐失败");
      } finally {
        setLoading(false);
      }
    },
    [history, setMode, setRecommendations, setLoading, setError]
  );

  /** 换一道 */
  const refreshRecommend = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      if (mode === "random") {
        const res = await fetch("/api/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 3, excludeNames: history }),
        });
        const data = await res.json();
        setRecommendations(data.recipes as RecommendedRecipe[]);
      } else {
        const messages =
          mode === "ai"
            ? buildAIRecommendPrompt(filters, history)
            : buildIngredientPrompt(filters.ingredients, history);
        const result = await fetchAIRecommend(messages);
        setRecommendations(result.recipes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "换一道失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [mode, filters, history, setRecommendations, setError]);

  return {
    randomRecommend,
    aiRecommend,
    ingredientRecommend,
    refreshRecommend,
    isRefreshing,
  };
}
