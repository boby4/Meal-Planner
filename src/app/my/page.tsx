"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type Tab = "favorites" | "history" | "shopping";

interface FavoriteItem {
  id: number;
  recipe_name: string;
  recipe_data: unknown;
  created_at: string;
}

interface HistoryItem {
  id: number;
  recipe_name: string;
  recipe_data: unknown;
  source: string;
  viewed_at: string;
}

interface ShoppingItem {
  id: number;
  item_name: string;
  amount: string;
  checked: boolean;
  related_recipe: string;
}

export default function MyPage() {
  const { user, logout, authFetch } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("favorites");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await authFetch("/api/favorites");
      const data = await res.json();
      setFavorites(data.favorites || []);
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await authFetch("/api/history");
      const data = await res.json();
      setHistory(data.history || []);
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
    else if (tab === "history") loadHistory();
    else loadShopping();
    setLoading(false);
  }, [tab, loadFavorites, loadHistory, loadShopping]);

  const removeFavorite = async (name: string) => {
    await authFetch(`/api/favorites?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => f.recipe_name !== name));
  };

  const clearHistory = async () => {
    await authFetch("/api/history", { method: "DELETE" });
    setHistory([]);
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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "favorites", label: "收藏", icon: "❤️" },
    { key: "history", label: "历史", icon: "📋" },
    { key: "shopping", label: "买菜清单", icon: "🛒" },
  ];

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-full text-gray-500">
            ← 返回
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">我的</h1>
        <div className="flex-1" />
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 max-w-[100px] truncate">{user.email}</span>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              退出
            </button>
          </div>
        ) : (
          <Link href="/login">
            <Button size="sm" className="bg-[#FF6B35] hover:bg-[#E55A2B] rounded-full text-xs">
              登录/注册
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-[#FF6B35] text-white shadow-md shadow-orange-200/50"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex-1"
        >
          {/* 收藏 */}
          {tab === "favorites" && (
            <div className="space-y-3">
              {favorites.length === 0 ? (
                <p className="text-center text-gray-400 py-12">暂无收藏菜谱</p>
              ) : (
                favorites.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                  >
                    <Link
                      href={`/recipe/${encodeURIComponent(item.recipe_name)}`}
                      className="flex-1 font-medium text-gray-800 hover:text-[#FF6B35] transition-colors"
                    >
                      {item.recipe_name}
                    </Link>
                    <button
                      onClick={() => removeFavorite(item.recipe_name)}
                      className="text-gray-400 hover:text-red-500 ml-2 text-lg"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 历史 */}
          {tab === "history" && (
            <div className="space-y-3">
              {history.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={clearHistory}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    清空历史
                  </button>
                </div>
              )}
              {history.length === 0 ? (
                <p className="text-center text-gray-400 py-12">暂无浏览记录</p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                  >
                    <Link
                      href={`/recipe/${encodeURIComponent(item.recipe_name)}`}
                      className="flex-1"
                    >
                      <div className="font-medium text-gray-800 hover:text-[#FF6B35] transition-colors">
                        {item.recipe_name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.source && <span className="mr-2">{item.source}</span>}
                        {item.viewed_at}
                      </div>
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 买菜清单 */}
          {tab === "shopping" && (
            <div className="space-y-3">
              {/* 添加项 */}
              <div className="flex gap-2 mb-4">
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addShoppingItem()}
                  placeholder="添加买菜清单项..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
                />
                <Button
                  onClick={addShoppingItem}
                  size="sm"
                  className="bg-[#FF6B35] hover:bg-[#E55A2B] rounded-xl px-4"
                >
                  添加
                </Button>
              </div>

              {shopping.some((i) => i.checked) && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={clearChecked}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    清除已购买
                  </button>
                </div>
              )}

              {shopping.length === 0 ? (
                <p className="text-center text-gray-400 py-12">买菜清单是空的</p>
              ) : (
                shopping.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-all ${
                      item.checked
                        ? "bg-gray-50 border-gray-100 opacity-60"
                        : "bg-white border-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecked(item.id, item.checked)}
                      className="w-4 h-4 rounded accent-[#FF6B35]"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.checked ? "line-through text-gray-400" : "text-gray-800"
                      }`}
                    >
                      {item.item_name}
                      {item.amount && (
                        <span className="text-gray-400 ml-2">{item.amount}</span>
                      )}
                    </span>
                    <button
                      onClick={() => removeShoppingItem(item.id)}
                      className="text-gray-400 hover:text-red-500 text-lg"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
