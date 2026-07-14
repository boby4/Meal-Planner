"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMealStore } from "@/stores/useMealStore";

const filterSchema = z.object({
  people: z.number().min(1).max(20),
  taste: z.array(z.string()),
  cookTime: z.string(),
  budget: z.string(),
  isDiet: z.boolean(),
});

type FilterFormData = z.infer<typeof filterSchema>;

const TASTE_OPTIONS = ["辣", "酸甜", "咸鲜", "清淡", "麻辣", "鲜香"];
const TIME_OPTIONS = ["15分钟内", "30分钟内", "1小时内", "1小时以上"];
const BUDGET_OPTIONS = ["10元以内", "30元以内", "50元以内", "不限预算"];

interface FilterPanelProps {
  onSubmit: () => void | Promise<void>;
}

/** 选项按钮（单选） */
function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
        selected
          ? "bg-[#FF6B35] text-white shadow-md shadow-orange-200/60 scale-[1.02]"
          : "bg-white text-gray-600 hover:bg-orange-50 hover:text-[#FF6B35] border border-gray-100"
      }`}
    >
      {label}
    </button>
  );
}

/** 多选标签按钮 */
function MultiSelectButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 border ${
        selected
          ? "bg-[#FF6B35] text-white border-[#FF6B35] shadow-md shadow-orange-200/60"
          : "bg-white text-gray-600 border-gray-100 hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
      }`}
    >
      {selected && <span className="mr-1">✓</span>}
      {label}
    </button>
  );
}

export function FilterPanel({ onSubmit }: FilterPanelProps) {
  const { filters, setFilters } = useMealStore();
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit } = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      people: filters.people,
      taste: filters.taste,
      cookTime: filters.cookTime,
      budget: filters.budget,
      isDiet: filters.isDiet,
    },
  });

  const onFormSubmit = async (data: FilterFormData) => {
    if (submitting) return;
    setFilters({
      people: data.people,
      taste: data.taste,
      cookTime: data.cookTime,
      budget: data.budget,
      isDiet: data.isDiet,
    });
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="rounded-3xl border-none shadow-xl shadow-orange-100/40 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-gray-900">
            🤖 告诉我你的需求
          </CardTitle>
          <p className="text-sm text-gray-400">
            填写偏好，让 AI 为你精准推荐
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            {/* 人数 */}
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <span>👥</span> 用餐人数
              </label>
              <Controller
                name="people"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(Math.max(1, (field.value ?? 1) - 1))
                      }
                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      {...field}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          field.onChange(1);
                        } else {
                          const num = Number(val);
                          if (!isNaN(num)) {
                            field.onChange(Math.min(20, Math.max(1, num)));
                          }
                        }
                      }}
                      className="rounded-xl w-20 text-center text-lg font-bold h-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(Math.min(20, (field.value ?? 1) + 1))
                      }
                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-400 ml-1">人</span>
                  </div>
                )}
              />
            </div>

            <Separator className="bg-gray-100" />

            {/* 口味（多选） */}
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <span>🌶️</span> 口味偏好
                <span className="text-xs text-gray-400 font-normal ml-1">
                  （可多选）
                </span>
              </label>
              <Controller
                name="taste"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {TASTE_OPTIONS.map((opt) => {
                      const isSelected = field.value.includes(opt);
                      return (
                        <MultiSelectButton
                          key={opt}
                          label={opt}
                          selected={isSelected}
                          onClick={() => {
                            if (isSelected) {
                              field.onChange(
                                field.value.filter((v: string) => v !== opt)
                              );
                            } else {
                              field.onChange([...field.value, opt]);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* 烹饪时间 */}
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <span>⏱️</span> 烹饪时间
              </label>
              <Controller
                name="cookTime"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {TIME_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt}
                        label={opt}
                        selected={field.value === opt}
                        onClick={() =>
                          field.onChange(field.value === opt ? "" : opt)
                        }
                      />
                    ))}
                  </div>
                )}
              />
            </div>

            {/* 预算 */}
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <span>💰</span> 预算
              </label>
              <Controller
                name="budget"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt}
                        label={opt}
                        selected={field.value === opt}
                        onClick={() =>
                          field.onChange(field.value === opt ? "" : opt)
                        }
                      />
                    ))}
                  </div>
                )}
              />
            </div>

            <Separator className="bg-gray-100" />

            {/* 减脂 */}
            <Controller
              name="isDiet"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 border ${
                    field.value
                      ? "bg-green-50 text-green-700 border-green-200 shadow-sm"
                      : "bg-gray-50 text-gray-500 border-gray-100 hover:border-green-200 hover:text-green-600"
                  }`}
                >
                  {field.value
                    ? "✅ 减脂模式已开启"
                    : "🏃 开启减脂模式"}
                </button>
              )}
            />

            {/* 提交按钮 */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full py-6 text-base font-bold bg-[#FF6B35] hover:bg-[#E55A2B] text-white shadow-lg shadow-orange-200/60 transition-all duration-200 hover:shadow-xl hover:shadow-orange-200/80 disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="inline-block"
                  >🤖</motion.span>
                  AI 正在推荐...
                </span>
              ) : (
                "✨ 让 AI 推荐"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
