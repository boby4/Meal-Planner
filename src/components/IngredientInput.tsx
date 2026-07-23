"use client";

import { useState, KeyboardEvent, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const MAX_RECENT = 14;

interface IngredientInputProps {
  onSubmit: (ingredients: string[]) => void;
}

interface ShoppingItem {
  id: number;
  item_name: string;
  amount: string;
  checked: boolean;
}

export function IngredientInput({ onSubmit }: IngredientInputProps) {
  const { authFetch, user } = useAuth();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [recentItems, setRecentItems] = useState<ShoppingItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 加载买菜清单最近 8 条（仅登录用户）
  const loadRecent = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch("/api/shopping");
      const data = await res.json();
      const items: ShoppingItem[] = data.items || [];
      // 取最近添加的 8 条（API 已按 created_at DESC 排序）
      setRecentItems(items.slice(0, MAX_RECENT));
    } catch { /* ignore */ }
  }, [authFetch, user]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // 添加食材到当前列表 + 保存到买菜清单（仅登录用户）
  const addIngredient = async () => {
    const trimmed = inputValue.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed]);
      setInputValue("");

      // 同步保存到买菜清单（仅登录用户且清单里还没有）
      if (user) {
        const exists = recentItems.some((i) => i.item_name === trimmed);
        if (!exists) {
          await authFetch("/api/shopping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_name: trimmed, related_recipe: "" }),
          });
          loadRecent();
        }
      }
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // 从最近列表删除（同步删除买菜清单，仅登录用户）
  const removeFromRecent = async (item: ShoppingItem) => {
    if (user) {
      await authFetch(`/api/shopping?id=${item.id}`, { method: "DELETE" });
    }
    setRecentItems((prev) => prev.filter((i) => i.id !== item.id));
    // 同时从当前选中移除
    setIngredients((prev) => prev.filter((name) => name !== item.item_name));
  };

  // 点击最近食材快速填入
  const toggleRecentItem = (item: ShoppingItem) => {
    setIngredients((prev) => {
      if (prev.includes(item.item_name)) {
        return prev.filter((name) => name !== item.item_name);
      } else {
        return [...prev, item.item_name];
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient();
    }
  };

  const handleSubmit = async () => {
    if (ingredients.length > 0 && !submitting) {
      setSubmitting(true);
      try {
        await onSubmit(ingredients);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="rounded-3xl border-none shadow-lg shadow-orange-100/50">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">
            🧊 冰箱里有什么
          </CardTitle>
          <p className="text-sm text-gray-500">
            输入食材自动存入买菜清单，AI 帮你推荐可以做的菜
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 输入区域 */}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入食材，按回车添加"
              className="rounded-xl flex-1"
            />
            <Button
              onClick={addIngredient}
              variant="outline"
              className="rounded-xl shrink-0"
            >
              添加
            </Button>
          </div>

          {/* 当前选中的食材标签 */}
          <AnimatePresence>
            {ingredients.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2"
              >
                {ingredients.map((ing, index) => (
                  <motion.div
                    key={ing}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-orange-50 text-[#FF6B35] hover:bg-orange-100 border-none px-3 py-1 cursor-pointer"
                      onClick={() => removeIngredient(index)}
                    >
                      {ing}
                      <span className="ml-1.5 text-xs opacity-60">×</span>
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 最近输入的食材（来自买菜清单） */}
          {recentItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">🕐 最近食材</span>
                <span className="text-[10px] text-gray-400">
                  点击选中，长按删除
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentItems.map((item) => {
                  const isSelected = ingredients.includes(item.item_name);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative group"
                    >
                      <button
                        onClick={() => toggleRecentItem(item)}
                        className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                          isSelected
                            ? "bg-orange-50 border-orange-200 text-[#FF6B35] font-medium"
                            : "bg-white border-gray-200 text-gray-600 hover:border-[#FF6B35] hover:text-[#FF6B35]"
                        }`}
                      >
                        {isSelected ? "✓ " : ""}
                        {item.item_name}
                      </button>
                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromRecent(item);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        ×
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={ingredients.length === 0 || submitting}
            className="w-full rounded-full py-6 text-base font-medium bg-[#FF6B35] hover:bg-[#E55A2B] text-white disabled:opacity-50"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                >🍳</motion.span>
                正在推荐中...
              </span>
            ) : ingredients.length === 0
              ? "请先添加食材"
              : `用 ${ingredients.length} 种食材推荐菜品`}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
