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

const RECENT_KEY = "meal_planner_recent_ingredients";
const MAX_RECENT = 8;

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
  const { authFetch } = useAuth();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [recentSets, setRecentSets] = useState<string[][]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [showShopping, setShowShopping] = useState(false);

  // 加载最近使用的食材组合
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecentSets(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // 加载买菜清单
  const loadShopping = useCallback(async () => {
    try {
      const res = await authFetch("/api/shopping");
      const data = await res.json();
      setShoppingItems((data.items || []).filter((i: ShoppingItem) => !i.checked));
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    if (showShopping) loadShopping();
  }, [showShopping, loadShopping]);

  // 保存食材组合到 localStorage
  const saveToRecent = (items: string[]) => {
    const updated = [items, ...recentSets.filter(
      (s) => JSON.stringify(s) !== JSON.stringify(items)
    )].slice(0, MAX_RECENT);
    setRecentSets(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const addIngredient = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed]);
      setInputValue("");
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient();
    }
  };

  const handleSubmit = () => {
    if (ingredients.length > 0) {
      saveToRecent(ingredients);
      onSubmit(ingredients);
    }
  };

  // 快速填入最近使用的食材组合
  const useRecent = (items: string[]) => {
    setIngredients(items);
  };

  // 从买菜清单添加
  const addFromShopping = (itemName: string) => {
    if (!ingredients.includes(itemName)) {
      setIngredients([...ingredients, itemName]);
    }
  };

  // 从清单批量添加全部未勾选
  const addAllUnchecked = () => {
    const uncheckedNames = shoppingItems.map((i) => i.item_name);
    const merged = [...new Set([...ingredients, ...uncheckedNames])];
    setIngredients(merged);
  };

  const clearRecent = () => {
    setRecentSets([]);
    localStorage.removeItem(RECENT_KEY);
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
            输入你现有的食材，AI 帮你推荐可以做的菜
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

          {/* 食材标签 */}
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

          {/* 从买菜清单导入 */}
          <div>
            <button
              onClick={() => setShowShopping(!showShopping)}
              className="text-xs text-[#FF6B35] hover:text-[#E55A2B] flex items-center gap-1 transition-colors"
            >
              🛒 {showShopping ? "收起买菜清单" : "从买菜清单添加食材"}
            </button>
            <AnimatePresence>
              {showShopping && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  {shoppingItems.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">买菜清单为空</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">
                          待购买 {shoppingItems.length} 项
                        </span>
                        <button
                          onClick={addAllUnchecked}
                          className="text-xs text-[#FF6B35] hover:text-[#E55A2B]"
                        >
                          全部添加
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {shoppingItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addFromShopping(item.item_name)}
                            disabled={ingredients.includes(item.item_name)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                              ingredients.includes(item.item_name)
                                ? "bg-orange-50 border-orange-200 text-[#FF6B35] cursor-default"
                                : "bg-white border-gray-200 text-gray-600 hover:border-[#FF6B35] hover:text-[#FF6B35]"
                            }`}
                          >
                            {ingredients.includes(item.item_name) ? "✓ " : "+ "}
                            {item.item_name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 最近使用 */}
          {recentSets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">🕐 最近使用</span>
                <button
                  onClick={clearRecent}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  清除
                </button>
              </div>
              <div className="space-y-1.5">
                {recentSets.map((items, idx) => (
                  <button
                    key={idx}
                    onClick={() => useRecent(items)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2 ${
                      JSON.stringify(items) === JSON.stringify(ingredients)
                        ? "bg-orange-50 border border-orange-200 text-[#FF6B35]"
                        : "bg-gray-50 border border-transparent hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    <span className="flex-1 truncate">
                      {items.join("、")}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">{items.length} 种</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={ingredients.length === 0}
            className="w-full rounded-full py-6 text-base font-medium bg-[#FF6B35] hover:bg-[#E55A2B] text-white disabled:opacity-50"
          >
            {ingredients.length === 0
              ? "请先添加食材"
              : `用 ${ingredients.length} 种食材推荐菜品`}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
