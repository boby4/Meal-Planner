"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/FilterPanel";
import { IngredientInput } from "@/components/IngredientInput";
import { useRecommendation } from "@/hooks/useRecommendation";
import { useMealStore } from "@/stores/useMealStore";

type HomeView = "main" | "ai" | "ingredient";

export default function HomePage() {
  const router = useRouter();
  const [view, setView] = useState<HomeView>("main");
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const { randomRecommend, aiRecommend, ingredientRecommend } =
    useRecommendation();
  const { isLoading } = useMealStore();

  const handleRandom = async () => {
    setIsRandomLoading(true);
    try {
      await randomRecommend();
      router.push("/recommend");
    } finally {
      setIsRandomLoading(false);
    }
  };

  const handleAISubmit = async () => {
    await aiRecommend();
    router.push("/recommend");
  };

  const handleIngredientSubmit = async (ingredients: string[]) => {
    useMealStore.getState().setFilters({ ingredients });
    await ingredientRecommend(ingredients);
    router.push("/recommend");
  };

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 max-w-md mx-auto w-full">
      {/* Logo / Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          🍳 今天吃什么
        </h1>
        <p className="text-gray-500">
          不知道吃什么？
          <br />
          <span className="text-[#FF6B35] font-medium">让 AI 帮你决定。</span>
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === "main" && (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full space-y-4"
          >
            {/* ① 随机推荐 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Button
                onClick={handleRandom}
                disabled={isRandomLoading}
                className="w-full h-auto py-5 rounded-3xl bg-[#FF6B35] hover:bg-[#E55A2B] text-white shadow-lg shadow-orange-200/50 text-left"
              >
                <div className="flex items-center gap-4 w-full">
                  {isRandomLoading ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="text-3xl inline-block"
                      >
                        🎲
                      </motion.span>
                      <div className="text-left">
                        <div className="font-bold text-base">正在挑选菜谱...</div>
                        <div className="text-xs opacity-80 mt-0.5">
                          AI 正在为你寻找今天的惊喜
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">🎲</span>
                      <div className="text-left">
                        <div className="font-bold text-base">今天吃什么</div>
                        <div className="text-xs opacity-80 mt-0.5">
                          随机推荐一道菜，治好选择困难症
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Button>
            </motion.div>

            {/* ② AI 推荐 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={() => setView("ai")}
                variant="outline"
                className="w-full h-auto py-5 rounded-3xl border-gray-200 bg-white hover:bg-gray-50 shadow-lg shadow-gray-100/50 text-left"
              >
                <div className="flex items-center gap-4 w-full">
                  <span className="text-3xl">🤖</span>
                  <div className="text-left">
                    <div className="font-bold text-base text-gray-900">
                      AI 推荐
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      根据口味、时间、预算智能推荐
                    </div>
                  </div>
                </div>
              </Button>
            </motion.div>

            {/* ③ 冰箱有什么 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={() => setView("ingredient")}
                variant="outline"
                className="w-full h-auto py-5 rounded-3xl border-gray-200 bg-white hover:bg-gray-50 shadow-lg shadow-gray-100/50 text-left"
              >
                <div className="flex items-center gap-4 w-full">
                  <span className="text-3xl">🧊</span>
                  <div className="text-left">
                    <div className="font-bold text-base text-gray-900">
                      冰箱有什么
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      输入现有食材，推荐可以做的菜
                    </div>
                  </div>
                </div>
              </Button>
            </motion.div>
          </motion.div>
        )}

        {view === "ai" && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full space-y-4"
          >
            <Button
              onClick={() => setView("main")}
              variant="ghost"
              className="rounded-full text-gray-500 hover:text-gray-700"
            >
              ← 返回
            </Button>
            <FilterPanel onSubmit={handleAISubmit} />
          </motion.div>
        )}

        {view === "ingredient" && (
          <motion.div
            key="ingredient"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full space-y-4"
          >
            <Button
              onClick={() => setView("main")}
              variant="ghost"
              className="rounded-full text-gray-500 hover:text-gray-700"
            >
              ← 返回
            </Button>
            <IngredientInput onSubmit={handleIngredientSubmit} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-gray-400 mt-auto pt-12"
      >
        Powered by DeepSeek AI
      </motion.p>
    </main>
  );
}
