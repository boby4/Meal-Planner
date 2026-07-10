"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      router.push("/my");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        {/* 返回 */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8"
        >
          ← 返回首页
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🍳</div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isRegister ? "注册账号" : "登录账号"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRegister ? "注册后可同步数据到云端" : "登录后同步你的收藏和历史"}
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少 6 位"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#FF6B35] hover:bg-[#E55A2B] disabled:bg-gray-300 text-white font-medium rounded-xl transition-all shadow-md shadow-orange-200/50 disabled:shadow-none"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isRegister ? "注册中..." : "登录中..."}
              </span>
            ) : (
              isRegister ? "注册" : "登录"
            )}
          </button>
        </form>

        {/* 切换 */}
        <div className="text-center mt-6">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="text-sm text-[#FF6B35] hover:text-[#E55A2B]"
          >
            {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
          </button>
        </div>

        {/* 提示 */}
        <p className="text-center text-xs text-gray-400 mt-8">
          不验证邮箱，仅用于数据存储和跨设备同步
        </p>
      </motion.div>
    </main>
  );
}
