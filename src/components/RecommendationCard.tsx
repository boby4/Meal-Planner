"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RecommendedRecipe } from "@/lib/types";

interface RecommendationCardProps {
  recipe: RecommendedRecipe;
  index: number;
  onViewRecipe: (name: string) => void;
  onChangeRecipe?: () => void;
}

export function RecommendationCard({
  recipe,
  index,
  onViewRecipe,
  onChangeRecipe,
}: RecommendationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="rounded-3xl border-none shadow-lg shadow-orange-100/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold text-gray-900">
            {recipe.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            {recipe.reason}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className="rounded-full bg-orange-50 text-[#FF6B35] hover:bg-orange-100 border-none"
            >
              ⏱️ {recipe.time}
            </Badge>
            <Badge
              variant="secondary"
              className="rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border-none"
            >
              📊 {recipe.difficulty}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 pt-2">
          <Button
            className="flex-1 rounded-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
            onClick={() => onViewRecipe(recipe.name)}
          >
            ✅ 查看菜谱
          </Button>
          {onChangeRecipe && (
            <Button
              variant="outline"
              className="rounded-full border-gray-200"
              onClick={onChangeRecipe}
            >
              🔄
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
