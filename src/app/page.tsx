"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/FilterPanel";
import { IngredientInput } from "@/components/IngredientInput";
import { useRecommendation } from "@/hooks/useRecommendation";
import { useMealStore } from "@/stores/useMealStore";
import { useAuth } from "@/hooks/useAuth";

type HomeView = "main" | "ai" | "ingredient" | "search";

interface SearchResult {
  name: string;
  description: string;
  ingredientCount: number;
  stepCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [view, setView] = useState<HomeView>("main");
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const { user } = useAuth();
  const { randomRecommend, aiRecommend, ingredientRecommend } =
    useRecommendation();
  const { isLoading } = useMealStore();

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setSearchResults(json.results || []);
      setSearchTotal(json.total || 0);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (view === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [view]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) doSearch(searchQuery.trim());
  };

  const handleRandom = async () => {
    setIsRandomLoading(true);
    try {
      useMealStore.getState().resetFilters();
      await randomRecommend();
      router.push("/recommend");
    } finally {
      setIsRandomLoading(false);
    }
  };

  const handleAISubmit = async () => {
    // AI 推荐前只清除食材字段（FilterPanel 已设置了 AI 条件）
    useMealStore.getState().setFilters({ ingredients: [] });
    await aiRecommend();
    router.push("/recommend");
  };

  const handleIngredientSubmit = async (ingredients: string[]) => {
    // 食材推荐前重置其他筛选条件，只保留 ingredients
    useMealStore.getState().resetFilters();
    useMealStore.getState().setFilters({ ingredients });
    await ingredientRecommend(ingredients);
    router.push("/recommend");
  };

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 max-w-md mx-auto w-full">
      {/* 顶部用户状态 */}
      <div className="w-full flex justify-end mb-2">
        {user ? (
          <Link href="/my" className="text-xs text-gray-400 hover:text-[#FF6B35] transition-colors">
            👤 {user.email.split("@")[0]}
          </Link>
        ) : (
          <Link href="/login" className="text-xs text-gray-400 hover:text-[#FF6B35] transition-colors">
            登录/注册
          </Link>
        )}
      </div>
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
            {/* ④ 搜索菜谱 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                onClick={() => setView("search")}
                variant="outline"
                className="w-full h-auto py-5 rounded-3xl border-gray-200 bg-white hover:bg-gray-50 shadow-lg shadow-gray-100/50 text-left"
              >
                <div className="flex items-center gap-4 w-full">
                  <span className="text-3xl">🔍</span>
                  <div className="text-left">
                    <div className="font-bold text-base text-gray-900">
                      搜索菜谱
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      输入菜名，快速找到想吃的菜
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
        {view === "search" && (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full space-y-4"
          >
            <Button
              onClick={() => { setView("main"); setSearchQuery(""); setSearchResults([]); }}
              variant="ghost"
              className="rounded-full text-gray-500 hover:text-gray-700"
            >
              ← 返回
            </Button>

            {/* 搜索输入框 */}
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); }}
                  placeholder="输入菜名，如：红烧肉、番茄炒蛋..."
                  className="w-full pl-12 pr-10 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all shadow-sm text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setSearchResults([]); searchInputRef.current?.focus(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={handleSearchSubmit}
                disabled={!searchQuery.trim() || isSearching}
                className="px-6 py-4 rounded-2xl bg-[#FF6B35] text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {isSearching ? "搜索中..." : "搜索"}
              </button>
            </div>

            {/* 搜索结果 */}
            {isSearching && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block text-2xl mb-2"
                >🔍</motion.span>
                <div>搜索中...</div>
              </div>
            )}

            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">🍽️</div>
                <div className="text-sm">没有找到「{searchQuery}」相关菜谱</div>
                <div className="text-xs mt-1">换个关键词试试</div>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 px-1">
                  找到 {searchTotal} 道菜谱{searchTotal > 20 && "，显示前 20 道"}
                </div>
                {searchResults.map((item, idx) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Link
                      href={`/recipe/${encodeURIComponent(item.name)}`}
                      className="block p-4 rounded-2xl bg-white border border-gray-100 hover:border-[#FF6B35]/30 hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <div className="font-medium text-gray-900 text-base">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</div>
                      )}
                      <div className="flex gap-3 mt-2">
                        <span className="text-xs text-[#FF6B35] bg-orange-50 px-2 py-0.5 rounded-full">
                          {item.ingredientCount} 种食材
                        </span>
                        <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                          {item.stepCount} 个步骤
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {!isSearching && !searchQuery && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">🔍</div>
                <div className="text-sm">输入菜名开始搜索</div>
                <div className="text-xs mt-1">试试「红烧肉」「番茄炒蛋」「可乐鸡翅」</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-auto pt-12 flex flex-col items-center gap-3">
        <Link href="/my">
          <Button variant="ghost" className="text-gray-500 hover:text-[#FF6B35] text-sm">
            ❤️ 我的收藏 · 📋 浏览历史 · 🛒 买菜清单
          </Button>
        </Link>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-gray-400"
        >
          Powered by DeepSeek AI
        </motion.p>
      </div>
    </main>
  );
}
