"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ChangeRecipeButton } from "@/components/ChangeRecipeButton";
import { RecommendationSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { useMealStore } from "@/stores/useMealStore";
import { useRecommendation } from "@/hooks/useRecommendation";

export default function RecommendPage() {
  const router = useRouter();
  const { recommendations, isLoading, error } = useMealStore();
  const { refreshRecommend, isRefreshing } = useRecommendation();

  const handleViewRecipe = (name: string) => {
    router.push(`/recipe/${encodeURIComponent(name)}`);
  };

  const handleRefresh = async () => {
    await refreshRecommend();
  };

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <RecommendationSkeleton />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <ErrorState message={error} onRetry={handleRefresh} />
      </main>
    );
  }

  if (recommendations.length === 0) {
    return (
      <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <EmptyState
          title="暂无推荐"
          description="返回首页试试其他推荐方式吧"
          icon="🍽️"
        />
        <Button
          onClick={() => router.push("/")}
          variant="outline"
          className="rounded-full mx-auto mt-4"
        >
          返回首页
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <Button
          onClick={() => router.push("/")}
          variant="ghost"
          className="rounded-full text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </Button>
        <ChangeRecipeButton onClick={handleRefresh} isLoading={isRefreshing} />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-gray-900 mb-6 text-center"
      >
        为你推荐 🎉
      </motion.h2>

      {/* Cards */}
      <div className="space-y-4">
        {recommendations.map((recipe, index) => (
          <RecommendationCard
            key={`${recipe.name}-${index}`}
            recipe={recipe}
            index={index}
            onViewRecipe={handleViewRecipe}
          />
        ))}
      </div>

      {/* Bottom change button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 flex justify-center"
      >
        <ChangeRecipeButton onClick={handleRefresh} isLoading={isRefreshing} />
      </motion.div>
    </main>
  );
}
