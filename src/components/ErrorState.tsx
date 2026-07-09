"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "加载失败，请稍后再试",
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <span className="text-5xl mb-4">😔</span>
      <h3 className="text-lg font-medium text-gray-800 mb-2">出错了</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="rounded-full px-6 bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
        >
          重试
        </Button>
      )}
    </motion.div>
  );
}
