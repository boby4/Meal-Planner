"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { PreferencesPanel } from "@/components/PreferencesPanel";
import { useAuth } from "@/hooks/useAuth";
import type { UserPreferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";

export default function PreferencesPage() {
  const { user, authFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const res = await authFetch("/api/preferences");
        const data = await res.json();
        if (data.preferences) setPrefs(data.preferences);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [authLoading, authFetch]);

  const handleSave = async (newPrefs: UserPreferences) => {
    const res = await authFetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPrefs),
    });
    if (res.ok) {
      router.push("/");
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-3xl inline-block"
        >
          🍳
        </motion.span>
      </main>
    );
  }

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
        <h1 className="text-lg font-bold text-gray-900">饮食偏好设置</h1>
      </motion.div>

      <PreferencesPanel initial={prefs} onSave={handleSave} />
    </main>
  );
}
