"use client";

import { useState, KeyboardEvent } from "react";
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

interface IngredientInputProps {
  onSubmit: (ingredients: string[]) => void;
}

export function IngredientInput({ onSubmit }: IngredientInputProps) {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

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
      onSubmit(ingredients);
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
