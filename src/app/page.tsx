"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/FilterPanel";
import { IngredientInput } from "@/components/IngredientInput";
import { PreferencesPanel } from "@/components/PreferencesPanel";
import { useRecommendation } from "@/hooks/useRecommendation";
import { useMealStore } from "@/stores/useMealStore";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import type { UserPreferences } from "@/lib/types";

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
  const { needsOnboarding, savePreferences, skipOnboarding, preferences } = usePreferences();
  const { randomRecommend, aiRecommend, ingredientRecommend } =
    useRecommendation();
  const { isLoading } = useMealStore();

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  useEffect(() => {
    const stored = localStorage.getItem("meal_search_history");
    if (stored) {
      try { setSearchHistory(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const addToSearchHistory = (q: string) => {
    setSearchHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, 10);
      localStorage.setItem("meal_search_history", JSON.stringify(next));
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("meal_search_history");
  };

  // 热门搜索
  const HOT_SEARCHES = ["红烧肉", "番茄炒蛋", "可乐鸡翅", "酸菜鱼", "宫保鸡丁", "麻婆豆腐"];

  // 问候语（客户端计算，避免 hydration mismatch）
  const [greeting, setGreeting] = useState({ text: "你好", sub: "今天吃什么？", icon: "🍳" });
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting({ text: "夜深了", sub: "来点夜宵？", icon: "🌙" });
    else if (hour < 9) setGreeting({ text: "早上好", sub: "早餐吃什么？", icon: "🌅" });
    else if (hour < 11) setGreeting({ text: "上午好", sub: "想好吃什么了吗？", icon: "☀️" });
    else if (hour < 13) setGreeting({ text: "中午好", sub: "午餐时间到！", icon: "🌞" });
    else if (hour < 17) setGreeting({ text: "下午好", sub: "来份下午茶？", icon: "🌤️" });
    else if (hour < 19) setGreeting({ text: "傍晚好", sub: "晚餐吃什么？", icon: "🌆" });
    else setGreeting({ text: "晚上好", sub: "来份夜宵？", icon: "🌙" });
  }, []);

  // 分类标签（点击后调用 AI 推荐，不走搜索）
  const CATEGORIES = [
    { label: "川菜", icon: "🌶️" },
    { label: "粤菜", icon: "🥘" },
    { label: "湘菜", icon: "🔥" },
    { label: "鲁菜", icon: "🐟" },
    { label: "江浙菜", icon: "🍲" },
    { label: "东北菜", icon: "🥢" },
    { label: "家常菜", icon: "🏠" },
    { label: "快手菜", icon: "⚡" },
  ];

  const handleCategoryClick = async (category: string) => {
    // 设置菜系筛选条件，调用 AI 推荐
    useMealStore.getState().resetFilters();
    useMealStore.getState().setFilters({ cuisine: category });
    await aiRecommend();
    router.push("/recommend");
  };

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
    if (searchQuery.trim()) {
      addToSearchHistory(searchQuery.trim());
      doSearch(searchQuery.trim());
    }
  };

  const handleQuickSearch = (q: string) => {
    setSearchQuery(q);
    addToSearchHistory(q);
    doSearch(q);
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

  const handleOnboardingSave = async (prefs: UserPreferences) => {
    await savePreferences(prefs);
  };

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 max-w-md mx-auto w-full">
      {/* 首次引导 */}
      {needsOnboarding && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-[#FFF8F2]"
        >
          <PreferencesPanel
            isOnboarding
            onSave={handleOnboardingSave}
            onSkip={skipOnboarding}
          />
        </motion.div>
      )}

      {/* 顶部用户状态 */}
      <div className="w-full flex justify-end mb-2 gap-2">
        {user ? (
          <>
            <Link href="/preferences" className="text-xs text-gray-400 hover:text-[#FF6B35] transition-colors">
              ⚙️ 偏好
            </Link>
            <Link href="/my" className="text-xs text-gray-400 hover:text-[#FF6B35] transition-colors">
              👤 {user.email.split("@")[0]}
            </Link>
          </>
        ) : (
          <Link href="/login" className="text-xs text-gray-400 hover:text-[#FF6B35] transition-colors">
            登录/注册
          </Link>
        )}
      </div>
      {/* 问候语 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting.icon} {greeting.text}
          {user && <span className="text-lg font-normal text-gray-500">，{user.email.split("@")[0]}</span>}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{greeting.sub}</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === "main" && (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full space-y-6"
          >
            {/* 快速操作 - 2x2 网格 */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <button
                  onClick={handleRandom}
                  disabled={isRandomLoading}
                  className="w-full p-4 rounded-2xl bg-[#FF6B35] text-white shadow-lg shadow-orange-200/50 text-left hover:bg-[#E55A2B] transition-all active:scale-95"
                >
                  <span className="text-2xl">{isRandomLoading ? "⏳" : "🎲"}</span>
                  <p className="font-bold text-sm mt-2">随机推荐</p>
                  <p className="text-xs opacity-80 mt-0.5">治好选择困难症</p>
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <button
                  onClick={() => setView("ai")}
                  className="w-full p-4 rounded-2xl bg-white border border-gray-100 shadow-lg shadow-gray-100/50 text-left hover:bg-gray-50 transition-all active:scale-95"
                >
                  <span className="text-2xl">🤖</span>
                  <p className="font-bold text-sm mt-2 text-gray-900">AI 推荐</p>
                  <p className="text-xs text-gray-400 mt-0.5">智能匹配口味</p>
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <button
                  onClick={() => setView("ingredient")}
                  className="w-full p-4 rounded-2xl bg-white border border-gray-100 shadow-lg shadow-gray-100/50 text-left hover:bg-gray-50 transition-all active:scale-95"
                >
                  <span className="text-2xl">🧊</span>
                  <p className="font-bold text-sm mt-2 text-gray-900">冰箱食材</p>
                  <p className="text-xs text-gray-400 mt-0.5">有什么做什么</p>
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <button
                  onClick={() => setView("search")}
                  className="w-full p-4 rounded-2xl bg-white border border-gray-100 shadow-lg shadow-gray-100/50 text-left hover:bg-gray-50 transition-all active:scale-95"
                >
                  <span className="text-2xl">🔍</span>
                  <p className="font-bold text-sm mt-2 text-gray-900">搜索菜谱</p>
                  <p className="text-xs text-gray-400 mt-0.5">按菜名搜索</p>
                </button>
              </motion.div>
            </div>

            {/* 饮食打卡入口 */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <button
                onClick={() => router.push("/checkin")}
                className="w-full p-4 rounded-2xl bg-white border border-gray-100 shadow-lg shadow-gray-100/50 text-left hover:bg-gray-50 transition-all active:scale-95 flex items-center gap-3"
              >
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-bold text-sm text-gray-900">饮食打卡</p>
                  <p className="text-xs text-gray-400 mt-0.5">记录每日三餐，养成健康习惯</p>
                </div>
              </button>
            </motion.div>

            {/* 个性化推荐提示 */}
            {preferences.diet_goal !== "none" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">✨</span>
                  <span className="text-sm font-semibold text-gray-800">为你定制</span>
                </div>
                <p className="text-xs text-gray-500">
                  {preferences.diet_goal === "lose_weight" && "已开启减脂模式，推荐低热量菜谱"}
                  {preferences.diet_goal === "gain_muscle" && "已开启增肌模式，推荐高蛋白菜谱"}
                  {preferences.diet_goal === "vegetarian" && "已开启素食模式，推荐素食菜谱"}
                  {preferences.taste_prefs.length > 0 &&
                    ` · 偏好${preferences.taste_prefs.join("、")}口味`}
                </p>
              </motion.div>
            )}

            {/* 分类浏览 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <h2 className="text-sm font-semibold text-gray-700 mb-3">🏷️ 按菜系浏览</h2>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => handleCategoryClick(cat.label)}
                    className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm text-gray-600 hover:border-[#FF6B35]/40 hover:text-[#FF6B35] transition-all"
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
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
              <div className="space-y-5">
                {/* 搜索历史 */}
                {searchHistory.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">🕐 搜索历史</span>
                      <button onClick={clearSearchHistory} className="text-xs text-gray-400 hover:text-red-500">
                        清除
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleQuickSearch(q)}
                          className="px-3 py-1.5 rounded-xl bg-gray-50 text-sm text-gray-600 hover:bg-orange-50 hover:text-[#FF6B35] transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 热门搜索 */}
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-2 block">🔥 热门搜索</span>
                  <div className="flex flex-wrap gap-2">
                    {HOT_SEARCHES.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuickSearch(q)}
                        className="px-3 py-1.5 rounded-xl bg-gray-50 text-sm text-gray-600 hover:bg-orange-50 hover:text-[#FF6B35] transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-auto pt-8 flex flex-col items-center gap-2">
        <Link href="/my">
          <Button variant="ghost" className="text-gray-400 hover:text-[#FF6B35] text-xs">
            ❤️ 收藏 · 🛒 清单 · 📅 打卡
          </Button>
        </Link>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-gray-300"
        >
          Powered by DeepSeek AI
        </motion.p>
      </div>
    </main>
  );
}
