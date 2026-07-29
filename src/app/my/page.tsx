"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type Tab = "favorites" | "checkin" | "shopping";

interface FavoriteItem {
  id: number;
  recipe_name: string;
  recipe_data: unknown;
  created_at: string;
}

interface CheckInRecord {
  id: number;
  check_date: string;
  meal_type: string;
  recipe_name: string;
  note?: string;
  cost?: number;
}

interface ShoppingItem {
  id: number;
  item_name: string;
  amount: string;
  checked: boolean;
  related_recipe: string;
}

const MEAL_LABEL: Record<string, { icon: string; label: string }> = {
  breakfast: { icon: "🌅", label: "早餐" },
  lunch: { icon: "☀️", label: "午餐" },
  dinner: { icon: "🌙", label: "晚餐" },
};

export default function MyPage() {
  const { user, logout, updateUsername, authFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("favorites");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [showExtract, setShowExtract] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [showEditUsername, setShowEditUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  const loadFavorites = useCallback(async () => {
    try {
      const res = await authFetch("/api/favorites");
      const data = await res.json();
      setFavorites(data.favorites || []);
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadCheckIns = useCallback(async () => {
    try {
      const res = await authFetch("/api/checkin?month=" + (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })());
      const data = await res.json();
      setCheckIns(data.checkIns || []);
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadShopping = useCallback(async () => {
    try {
      const res = await authFetch("/api/shopping");
      const data = await res.json();
      setShopping(data.items || []);
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    setLoading(true);
    if (tab === "favorites") loadFavorites();
    else if (tab === "checkin") loadCheckIns();
    else loadShopping();
    setLoading(false);
  }, [tab, loadFavorites, loadCheckIns, loadShopping]);

  const removeFavorite = async (name: string) => {
    await authFetch(`/api/favorites?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => f.recipe_name !== name));
  };

  const addShoppingItem = async () => {
    if (!newItem.trim()) return;
    await authFetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: newItem.trim() }),
    });
    setNewItem("");
    loadShopping();
  };

  const toggleChecked = async (id: number, checked: boolean) => {
    await authFetch("/api/shopping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checked: !checked }),
    });
    setShopping((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !checked } : item))
    );
  };

  const removeShoppingItem = async (id: number) => {
    await authFetch(`/api/shopping?id=${id}`, { method: "DELETE" });
    setShopping((prev) => prev.filter((item) => item.id !== id));
  };

  const clearChecked = async () => {
    await authFetch("/api/shopping?clear=true", { method: "DELETE" });
    setShopping((prev) => prev.filter((item) => !item.checked));
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      setUsernameError("用户名不能为空");
      return;
    }
    if (newUsername.trim().length < 2) {
      setUsernameError("用户名至少2个字符");
      return;
    }
    if (newUsername.trim().length > 20) {
      setUsernameError("用户名不能超过20个字符");
      return;
    }
    
    setUpdatingUsername(true);
    setUsernameError("");
    try {
      await updateUsername(newUsername.trim());
      setShowEditUsername(false);
      setNewUsername("");
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const toggleRecipeSelect = (id: number) => {
    setSelectedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const extractIngredients = async () => {
    const names = favorites.filter((f) => selectedRecipes.has(f.id)).map((f) => f.recipe_name);
    if (!names.length) return;
    setExtracting(true);
    try {
      const res = await authFetch("/api/shopping/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeNames: names }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const ing of data.ingredients || []) {
          await authFetch("/api/shopping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_name: ing.name, amount: ing.amount, category: ing.category, related_recipe: names.join("、") }),
          });
        }
        setShowExtract(false);
        setSelectedRecipes(new Set());
        loadShopping();
      }
    } catch { /* ignore */ }
    setExtracting(false);
  };

  // 按日期分组打卡记录
  const groupedCheckIns = checkIns.reduce<Record<string, CheckInRecord[]>>((acc, record) => {
    if (!acc[record.check_date]) acc[record.check_date] = [];
    acc[record.check_date].push(record);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedCheckIns).sort((a, b) => b.localeCompare(a));

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "favorites", label: "收藏", icon: "❤️", count: favorites.length },
    { key: "checkin", label: "打卡", icon: "📅", count: checkIns.length },
    { key: "shopping", label: "清单", icon: "🛒", count: shopping.filter((i) => !i.checked).length },
  ];

  const shoppingDone = shopping.filter((i) => i.checked).length;
  const shoppingTotal = shopping.length;

  const stagger = {
    animate: { transition: { staggerChildren: 0.04 } },
  };

  const fadeUp = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
        >
          <span className="text-sm">←</span>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">我的</h1>
          {user && (
            <button 
              onClick={() => {
                setNewUsername(user.username || "");
                setShowEditUsername(true);
              }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#FF6B35] transition-colors"
            >
              <span>{user.username || user.email.split('@')[0]}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          )}
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/checkin"
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              title="饮食打卡"
            >
              📅
            </Link>
            <Link
              href="/preferences"
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              title="饮食偏好"
            >
              ⚙️
            </Link>
            <div className="w-8 h-8 rounded-full bg-[#FF6B35] text-white flex items-center justify-center text-xs font-bold">
              {(user.username || user.email)[0].toUpperCase()}
            </div>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              退出
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-[#FF6B35] hover:text-[#E55A2B] transition-colors"
          >
            登录 / 注册
          </Link>
        )}
      </motion.div>

      {/* 未登录提示 */}
      {!authLoading && !user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center px-4"
        >
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">请先登录</h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            登录后即可查看收藏、打卡记录和买菜清单
          </p>
          <Link
            href="/login"
            className="px-8 py-3.5 bg-[#FF6B35] hover:bg-[#E55A2B] text-white font-medium rounded-full shadow-lg shadow-orange-200/50 transition-all active:scale-95"
          >
            登录 / 注册
          </Link>
        </motion.div>
      )}

      {/* 已登录内容 */}
      {user && (
        <>
          {/* Tabs */}
          <div className="flex gap-1.5 mb-5 p-1 bg-gray-100 rounded-2xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
            {t.count > 0 && (
              <span
                className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  tab === t.key
                    ? "bg-[#FF6B35] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {/* ====== 收藏 ====== */}
          {tab === "favorites" && (
            <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2.5">
              {favorites.length === 0 ? (
                <EmptyState emoji="❤️" text="还没有收藏菜谱" sub="浏览菜谱时点击 🤍 即可收藏" />
              ) : (
                favorites.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={fadeUp}
                    className="group flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg flex-shrink-0">
                      ❤️
                    </div>
                    <Link
                      href={`/recipe/${encodeURIComponent(item.recipe_name)}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="font-semibold text-gray-800 hover:text-[#FF6B35] transition-colors truncate">
                        {item.recipe_name}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.created_at}</p>
                    </Link>
                    <button
                      onClick={() => removeFavorite(item.recipe_name)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <span className="text-lg leading-none">×</span>
                    </button>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {/* ====== 打卡记录 ====== */}
          {tab === "checkin" && (
            <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
              {sortedDates.length === 0 ? (
                <EmptyState emoji="📅" text="暂无打卡记录" sub="去打卡页面记录每日三餐吧" />
              ) : (
                sortedDates.map((date) => (
                  <motion.div key={date} variants={fadeUp}>
                    <p className="text-sm font-bold text-gray-600 mb-2">{date}</p>
                    <div className="space-y-2">
                      {groupedCheckIns[date].map((record) => {
                        const meal = MEAL_LABEL[record.meal_type] || { icon: "🍽️", label: record.meal_type };
                        return (
                          <div
                            key={record.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-lg flex-shrink-0">
                              {meal.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{record.recipe_name}</p>
                              <p className="text-[11px] text-gray-400">{meal.label}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {record.cost && record.cost > 0 && (
                                <span className="text-[11px] font-medium text-orange-500">¥{record.cost}</span>
                              )}
                              {record.note && (
                                <span className="text-[11px] text-gray-400 truncate max-w-[60px]">{record.note}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {/* ====== 买菜清单 ====== */}
          {tab === "shopping" && (
            <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2.5">
              {/* 添加项 */}
              <motion.div variants={fadeUp} className="flex gap-2 mb-3">
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addShoppingItem()}
                  placeholder="要买什么菜..."
                  className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] transition-all"
                />
                <button
                  onClick={addShoppingItem}
                  disabled={!newItem.trim()}
                  className="w-12 h-12 rounded-2xl bg-[#FF6B35] hover:bg-[#E55A2B] disabled:bg-gray-200 text-white text-xl font-bold flex items-center justify-center transition-all shadow-md shadow-orange-200/50 disabled:shadow-none"
                >
                  +
                </button>
              </motion.div>

              {/* 智能提取按钮 */}
              {favorites.length > 0 && (
                <motion.button
                  variants={fadeUp}
                  onClick={() => setShowExtract(true)}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-orange-200 text-[#FF6B35] text-sm font-medium hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🧠</span>
                  <span>从收藏菜谱智能提取食材</span>
                </motion.button>
              )}

              {/* 进度条 */}
              {shoppingTotal > 0 && (
                <motion.div variants={fadeUp} className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">
                      已购买 {shoppingDone}/{shoppingTotal}
                    </span>
                    {shoppingDone > 0 && (
                      <button
                        onClick={clearChecked}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        清除已购买
                      </button>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#FF6B35] to-orange-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${shoppingTotal > 0 ? (shoppingDone / shoppingTotal) * 100 : 0}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </motion.div>
              )}

              {shopping.length === 0 ? (
                <EmptyState emoji="🛒" text="买菜清单是空的" sub="添加需要购买的食材" />
              ) : (
                shopping.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={fadeUp}
                    layout
                    className={`group flex items-center gap-3 p-3.5 rounded-2xl border shadow-sm transition-all ${
                      item.checked
                        ? "bg-gray-50/80 border-gray-100"
                        : "bg-white border-gray-100 hover:shadow-md hover:border-green-100"
                    }`}
                  >
                    <button
                      onClick={() => toggleChecked(item.id, item.checked)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        item.checked
                          ? "bg-[#FF6B35] border-[#FF6B35]"
                          : "border-gray-300 hover:border-[#FF6B35]"
                      }`}
                    >
                      {item.checked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm block truncate transition-all ${
                          item.checked ? "line-through text-gray-400" : "text-gray-800 font-medium"
                        }`}
                      >
                        {item.item_name}
                      </span>
                      {item.amount && (
                        <span className="text-[11px] text-gray-400">{item.amount}</span>
                      )}
                      {item.related_recipe && (
                        <span className="text-[11px] text-gray-400 ml-2">
                          📎 {item.related_recipe}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeShoppingItem(item.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <span className="text-base leading-none">×</span>
                    </button>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 智能提取弹窗 */}
      {showExtract && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowExtract(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[70vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">选择菜谱提取食材</h3>
              <button onClick={() => setShowExtract(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <p className="text-xs text-gray-400 mb-3">选择要做的菜，AI 自动提取需要购买的食材</p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {favorites.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => toggleRecipeSelect(fav.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedRecipes.has(fav.id)
                      ? "border-[#FF6B35] bg-orange-50"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedRecipes.has(fav.id) ? "bg-[#FF6B35] border-[#FF6B35]" : "border-gray-300"
                  }`}>
                    {selectedRecipes.has(fav.id) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-800 truncate">{fav.recipe_name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={extractIngredients}
              disabled={selectedRecipes.size === 0 || extracting}
              className="w-full py-3 rounded-2xl bg-[#FF6B35] hover:bg-[#E55A2B] disabled:bg-gray-200 text-white font-bold transition-all"
            >
              {extracting ? "提取中..." : `提取食材（已选 ${selectedRecipes.size} 道）`}
            </button>
          </motion.div>
        </div>
      )}

      {/* 修改用户名弹窗 */}
      {showEditUsername && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => { setShowEditUsername(false); setUsernameError(""); }}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">修改用户名</h3>
              <button onClick={() => { setShowEditUsername(false); setUsernameError(""); }} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="mb-4">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => { setNewUsername(e.target.value); setUsernameError(""); }}
                placeholder="输入新用户名"
                minLength={2}
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
              />
              {usernameError && (
                <p className="text-xs text-red-500 mt-2">{usernameError}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">2-20个字符，修改后其他用户将看到你的新用户名</p>
            </div>
            <button
              onClick={handleUpdateUsername}
              disabled={updatingUsername || !newUsername.trim()}
              className="w-full py-3 rounded-2xl bg-[#FF6B35] hover:bg-[#E55A2B] disabled:bg-gray-200 text-white font-bold transition-all"
            >
              {updatingUsername ? "修改中..." : "确认修改"}
            </button>
          </motion.div>
        </div>
      )}
      </>
      )}
    </main>
  );
}

/** 空状态组件 */
function EmptyState({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="text-5xl mb-4 opacity-50">{emoji}</div>
      <p className="text-gray-500 font-medium">{text}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </motion.div>
  );
}
