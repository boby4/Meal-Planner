"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { UserPreferences, DietGoal, DietType } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";

const DIET_GOALS: { key: DietGoal; label: string; icon: string; desc: string }[] = [
  { key: "none", label: "无特殊目标", icon: "🍽️", desc: "正常饮食，不追求特定效果" },
  { key: "lose_weight", label: "减脂", icon: "🔥", desc: "控制热量，低脂高纤" },
  { key: "gain_muscle", label: "增肌", icon: "💪", desc: "高蛋白，充足碳水" },
  { key: "vegetarian", label: "素食", icon: "🥬", desc: "不含肉类的素食菜谱" },
];

const DIET_TYPES: { key: DietType; label: string; icon: string }[] = [
  { key: "normal", label: "普通饮食", icon: "🍚" },
  { key: "vegetarian", label: "素食", icon: "🥬" },
  { key: "low_carb", label: "低碳水", icon: "🥩" },
  { key: "high_protein", label: "高蛋白", icon: "💪" },
];

const ALLERGEN_OPTIONS = ["海鲜", "坚果", "乳制品", "麸质", "鸡蛋", "大豆"];

const TASTE_OPTIONS = ["辣", "酸甜", "咸鲜", "清淡", "麻辣", "鲜香"];

const TIME_OPTIONS = ["15分钟内", "30分钟内", "1小时内", "不限"];

interface PreferencesPanelProps {
  initial?: Partial<UserPreferences>;
  onSave: (prefs: UserPreferences) => Promise<void>;
  /** 是否为引导模式（全屏，有标题） */
  isOnboarding?: boolean;
  /** 引导模式下的完成回调 */
  onSkip?: () => void;
}

export function PreferencesPanel({
  initial,
  onSave,
  isOnboarding = false,
  onSkip,
}: PreferencesPanelProps) {
  const [prefs, setPrefs] = useState<UserPreferences>({
    ...DEFAULT_PREFERENCES,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  const update = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => setPrefs((p) => ({ ...p, [key]: value }));

  const toggleArrayItem = (key: "allergens" | "taste_prefs", item: string) => {
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(item)
        ? p[key].filter((v) => v !== item)
        : [...p[key], item],
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ ...prefs, has_completed_onboarding: true });
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    // Step 0: 饮食目标
    () => (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">你的饮食目标是什么？</h2>
          <p className="text-sm text-gray-400">帮助我们为你推荐合适的菜谱</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DIET_GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => update("diet_goal", g.key)}
              className={`p-4 rounded-2xl text-left transition-all border ${
                prefs.diet_goal === g.key
                  ? "bg-orange-50 border-[#FF6B35] shadow-md shadow-orange-100/50"
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">{g.icon}</span>
              <p className="font-semibold text-sm text-gray-800 mt-2">{g.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{g.desc}</p>
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 1: 饮食类型
    () => (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">饮食类型</h2>
          <p className="text-sm text-gray-400">选择你偏好的饮食方式</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DIET_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => update("diet_type", t.key)}
              className={`p-4 rounded-2xl text-center transition-all border ${
                prefs.diet_type === t.key
                  ? "bg-orange-50 border-[#FF6B35] shadow-md shadow-orange-100/50"
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <p className="font-semibold text-sm text-gray-800 mt-1">{t.label}</p>
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 2: 过敏源
    () => (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">有过敏源吗？</h2>
          <p className="text-sm text-gray-400">选中的过敏源将被排除（可跳过）</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_OPTIONS.map((a) => (
            <button
              key={a}
              onClick={() => toggleArrayItem("allergens", a)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all border ${
                prefs.allergens.includes(a)
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-white text-gray-600 border-gray-100 hover:border-gray-200"
              }`}
            >
              {prefs.allergens.includes(a) && <span className="mr-1">✕</span>}
              {a}
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 3: 口味偏好
    () => (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">口味偏好</h2>
          <p className="text-sm text-gray-400">选择你喜欢的口味（可多选）</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TASTE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => toggleArrayItem("taste_prefs", t)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all border ${
                prefs.taste_prefs.includes(t)
                  ? "bg-[#FF6B35] text-white border-[#FF6B35] shadow-md shadow-orange-200/60"
                  : "bg-white text-gray-600 border-gray-100 hover:border-[#FF6B35]/40"
              }`}
            >
              {prefs.taste_prefs.includes(t) && <span className="mr-1">✓</span>}
              {t}
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 4: 烹饪时间 + 用餐人数
    () => (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">最后一步</h2>
          <p className="text-sm text-gray-400">设置常用烹饪时间和用餐人数</p>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <span>⏱️</span> 常用烹饪时间
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => update("cook_time_pref", prefs.cook_time_pref === t ? "" : t)}
                className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all border ${
                  prefs.cook_time_pref === t
                    ? "bg-[#FF6B35] text-white border-[#FF6B35]"
                    : "bg-white text-gray-600 border-gray-100 hover:border-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <span>👥</span> 常用用餐人数
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => update("people_count", Math.max(1, prefs.people_count - 1))}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 w-12 text-center">
              {prefs.people_count}
            </span>
            <button
              onClick={() => update("people_count", Math.min(20, prefs.people_count + 1))}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center"
            >
              +
            </button>
            <span className="text-sm text-gray-400 ml-1">人</span>
          </div>
        </div>
      </div>
    ),
  ];

  const totalSteps = steps.length;

  // 非引导模式：所有步骤平铺展示
  if (!isOnboarding) {
    return (
      <div className="space-y-6">
        {steps.map((renderStep, i) => (
          <div key={i}>{renderStep()}</div>
        ))}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full py-6 text-base font-bold bg-[#FF6B35] hover:bg-[#E55A2B] text-white shadow-lg shadow-orange-200/60"
        >
          {saving ? "保存中..." : "保存偏好"}
        </Button>
      </div>
    );
  }

  // 引导模式：分步展示
  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-8">
      {/* 进度条 */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? "bg-[#FF6B35]" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* 步骤内容 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          {steps[step]()}
        </motion.div>
      </AnimatePresence>

      {/* 底部按钮 */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button
            onClick={() => setStep(step - 1)}
            variant="outline"
            className="flex-1 rounded-full py-5 text-sm font-medium border-gray-200"
          >
            上一步
          </Button>
        )}
        {step < totalSteps - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            className="flex-1 rounded-full py-5 text-sm font-bold bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
          >
            下一步
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-full py-5 text-sm font-bold bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
          >
            {saving ? "保存中..." : "完成"}
          </Button>
        )}
      </div>

      {/* 跳过按钮 */}
      {onSkip && (
        <button
          onClick={onSkip}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
        >
          跳过，稍后设置
        </button>
      )}
    </div>
  );
}
