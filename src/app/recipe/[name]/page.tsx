"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RecipeDetail as RecipeDetailComponent } from "@/components/RecipeDetail";
import { RecipeDetailSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import type { RecipeDetail as RecipeDetailType } from "@/lib/types";

export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const recipeName = decodeURIComponent(params.name ?? "");

  const [recipe, setRecipe] = useState<RecipeDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipe = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/recipe?name=${encodeURIComponent(recipeName)}`
      );
      if (!res.ok) {
        throw new Error(`获取菜谱失败: ${res.status}`);
      }
      const data = await res.json();
      setRecipe(data.recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载菜谱失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (recipeName) {
      fetchRecipe();
    }
  }, [recipeName]);

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <RecipeDetailSkeleton />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <ErrorState message={error} onRetry={fetchRecipe} />
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <ErrorState message="菜谱未找到" onRetry={() => router.push("/")} />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          className="rounded-full text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </Button>
      </div>

      <RecipeDetailComponent recipe={recipe} />
    </main>
  );
}
