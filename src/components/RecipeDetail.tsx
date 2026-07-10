"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import type { RecipeDetail as RecipeDetailType } from "@/lib/types";

interface RecipeDetailProps {
  recipe: RecipeDetailType;
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const { authFetch } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    // 检查是否已收藏
    authFetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => {
        const found = data.favorites?.some(
          (f: { recipe_name: string }) => f.recipe_name === recipe.name
        );
        setIsFavorited(!!found);
      })
      .catch(() => {});
  }, [recipe.name, authFetch]);

  const toggleFavorite = async () => {
    if (isFavorited) {
      await authFetch(`/api/favorites?name=${encodeURIComponent(recipe.name)}`, { method: "DELETE" });
      setIsFavorited(false);
    } else {
      await authFetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_name: recipe.name, recipe_data: recipe }),
      });
      setIsFavorited(true);
    }
  };

  // 记录浏览历史
  useEffect(() => {
    authFetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_name: recipe.name, recipe_data: recipe, source: "detail" }),
    }).catch(() => {});
  }, [recipe, authFetch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* 图片 */}
      {recipe.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>
      )}

      {/* 标题 + 收藏 */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{recipe.name}</h1>
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={toggleFavorite}
            className="flex-shrink-0 ml-3 text-2xl transition-transform"
          >
            {isFavorited ? "❤️" : "🤍"}
          </motion.button>
        </div>
        {recipe.description && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {recipe.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="rounded-full bg-orange-50 text-[#FF6B35] hover:bg-orange-100 border-none">
            ⏱️ {recipe.time}
          </Badge>
          <Badge className="rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border-none">
            📊 {recipe.difficulty}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* 食材 */}
      {recipe.ingredients.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">🥬 食材</h2>
          <div className="grid grid-cols-2 gap-2">
            {recipe.ingredients.map((ing, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl"
              >
                <span className="text-sm text-gray-800">{ing.name}</span>
                {ing.amount && (
                  <span className="text-xs text-gray-500">{ing.amount}</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* 步骤 */}
      {recipe.steps.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">👨‍🍳 做法步骤</h2>
          <ol className="space-y-3">
            {recipe.steps.map((step, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="flex gap-3"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF6B35] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      )}

      {/* Tips */}
      {recipe.tips.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">💡 小贴士</h2>
            <ul className="space-y-2">
              {recipe.tips.map((tip, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <span className="text-orange-400">•</span>
                  <span>{tip}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </>
      )}
    </motion.div>
  );
}
