"use client";

import { motion } from "framer-motion";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: string;
}

export function EmptyState({
  title = "暂无数据",
  description = "当前没有可展示的内容",
  icon = "🍽️",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-medium text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs">{description}</p>
    </motion.div>
  );
}
