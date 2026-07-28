"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CheckInRecord {
  id: number;
  meal_type: string;
  recipe_name: string;
  recipe_data?: string;
  note?: string;
}

interface FavoriteItem {
  id: number;
  recipe_name: string;
}

interface CheckInModalProps {
  date: string;
  onClose: () => void;
  onUpdate: () => void;
}

const MEAL_TYPES = [
  { key: "breakfast", label: "早餐", icon: "🌅", time: "07:00" },
  { key: "lunch", label: "午餐", icon: "☀️", time: "12:00" },
  { key: "dinner", label: "晚餐", icon: "🌙", time: "18:00" },
];

export default function CheckInModal({ date, onClose, onUpdate }: CheckInModalProps) {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checkin?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.checkIns || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const loadFavorites = async () => {
    if (favorites.length > 0) {
      setShowFavorites(!showFavorites);
      return;
    }
    setFavLoading(true);
    try {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
        setShowFavorites(true);
      }
    } catch { /* ignore */ }
    setFavLoading(false);
  };

  const selectFavorite = (name: string) => {
    setRecipeName(name);
    setShowFavorites(false);
  };

  const handleSave = async (mealType: string) => {
    if (!recipeName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_date: date,
          meal_type: mealType,
          recipe_name: recipeName.trim(),
          note: note.trim(),
        }),
      });
      if (res.ok) {
        setEditingMeal(null);
        setRecipeName("");
        setNote("");
        setShowFavorites(false);
        await loadRecords();
        onUpdate();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/checkin?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadRecords();
        onUpdate();
      }
    } catch { /* ignore */ }
  };

  const getRecord = (mealType: string) => {
    return records.find((r) => r.meal_type === mealType);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="sticky top-0 bg-white px-4 pt-4 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">{date} 饮食记录</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
          </div>

          {/* 三餐列表 */}
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-8">加载中...</div>
            ) : (
              MEAL_TYPES.map((meal) => {
                const record = getRecord(meal.key);
                const isEditing = editingMeal === meal.key;

                return (
                  <div key={meal.key} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meal.icon}</span>
                        <span className="font-medium text-gray-700">{meal.label}</span>
                      </div>
                      {!record && !isEditing && (
                        <button
                          onClick={() => setEditingMeal(meal.key)}
                          className="text-sm text-[#FF6B35] hover:underline"
                        >
                          + 添加
                        </button>
                      )}
                    </div>

                    {record ? (
                      <div className="flex items-center justify-between bg-white rounded-lg p-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{record.recipe_name}</p>
                          {record.note && <p className="text-xs text-gray-400 mt-0.5">{record.note}</p>}
                        </div>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="text-gray-300 hover:text-red-400 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ) : isEditing ? (
                      <div className="space-y-2 mt-2">
                        {/* 菜名输入 + 收藏夹按钮 */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={recipeName}
                            onChange={(e) => setRecipeName(e.target.value)}
                            placeholder="输入菜名..."
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6B35]"
                            autoFocus
                          />
                          <button
                            onClick={loadFavorites}
                            disabled={favLoading}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                          >
                            {favLoading ? "..." : "❤️ 收藏"}
                          </button>
                        </div>

                        {/* 收藏夹列表 */}
                        <AnimatePresence>
                          {showFavorites && favorites.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="max-h-32 overflow-y-auto bg-white rounded-lg border border-gray-100">
                                {favorites.map((fav) => (
                                  <button
                                    key={fav.id}
                                    onClick={() => selectFavorite(fav.recipe_name)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-[#FF6B35] transition-colors border-b border-gray-50 last:border-0"
                                  >
                                    ❤️ {fav.recipe_name}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {showFavorites && favorites.length === 0 && (
                          <p className="text-xs text-gray-400">暂无收藏菜谱</p>
                        )}

                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="备注（可选）"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6B35]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingMeal(null); setRecipeName(""); setNote(""); setShowFavorites(false); }}
                            className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleSave(meal.key)}
                            disabled={saving || !recipeName.trim()}
                            className="flex-1 py-2 text-sm text-white bg-[#FF6B35] rounded-lg disabled:opacity-50"
                          >
                            {saving ? "保存中..." : "保存"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300">未打卡</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
