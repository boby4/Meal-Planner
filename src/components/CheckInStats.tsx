"use client";

import { useState, useEffect, useCallback } from "react";

interface CheckInStatsProps {
  refreshKey: number;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

interface Stats {
  totalDays: number;
  streak: number;
  completionRate: number;
  totalSpend: number;
  todaySpend: number;
  weekDays: { date: string; count: number; spend: number }[];
  mealDistribution: { type: string; count: number }[];
  monthlyTrend: { month: string; days: number }[];
}

export default function CheckInStats({ refreshKey, authFetch }: CheckInStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalDays: 0,
    streak: 0,
    completionRate: 0,
    totalSpend: 0,
    todaySpend: 0,
    weekDays: [],
    mealDistribution: [],
    monthlyTrend: [],
  });

  const loadStats = useCallback(async () => {
    try {
      const today = new Date();
      const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const res = await authFetch(`/api/checkin?month=${monthStr}`);
      if (!res.ok) return;

      const data = await res.json();
      const checkIns = data.checkIns || [];

      const dateCountMap: Record<string, number> = {};
      const dateSpendMap: Record<string, number> = {};
      for (const record of checkIns) {
        dateCountMap[record.check_date] = (dateCountMap[record.check_date] || 0) + 1;
        dateSpendMap[record.check_date] = (dateSpendMap[record.check_date] || 0) + (Number(record.cost) || 0);
      }

      const totalDays = Object.keys(dateCountMap).length;
      const totalSpend = Object.values(dateSpendMap).reduce((s, v) => s + v, 0);
      const todaySpend = dateSpendMap[todayStr] || 0;

      let streak = 0;
      const d = new Date();
      while (true) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dateCountMap[dateStr] && dateCountMap[dateStr] > 0) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }

      const passedDays = today.getDate();
      const completionRate = passedDays > 0 ? Math.round((totalDays / passedDays) * 100) : 0;

      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      const weekDays: { date: string; count: number; spend: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const wd = new Date(monday);
        wd.setDate(monday.getDate() + i);
        const dateStr = `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, "0")}-${String(wd.getDate()).padStart(2, "0")}`;
        weekDays.push({
          date: dateStr,
          count: dateCountMap[dateStr] || 0,
          spend: dateSpendMap[dateStr] || 0,
        });
      }

      const mealMap: Record<string, number> = {};
      for (const record of checkIns) {
        mealMap[record.meal_type] = (mealMap[record.meal_type] || 0) + 1;
      }
      const mealDistribution = [
        { type: "breakfast", count: mealMap.breakfast || 0 },
        { type: "lunch", count: mealMap.lunch || 0 },
        { type: "dinner", count: mealMap.dinner || 0 },
      ];

      const monthlyTrend: { month: string; days: number }[] = [];
      for (let i = 2; i >= 0; i--) {
        const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
        const label = `${m.getMonth() + 1}月`;

        if (i === 0) {
          monthlyTrend.push({ month: label, days: totalDays });
        } else {
          try {
            const mRes = await authFetch(`/api/checkin?month=${mStr}`);
            if (mRes.ok) {
              const mData = await mRes.json();
              const mDateSet = new Set<string>();
              for (const r of mData.checkIns || []) {
                mDateSet.add(r.check_date);
              }
              monthlyTrend.push({ month: label, days: mDateSet.size });
            } else {
              monthlyTrend.push({ month: label, days: 0 });
            }
          } catch {
            monthlyTrend.push({ month: label, days: 0 });
          }
        }
      }

      setStats({ totalDays, streak, completionRate, totalSpend, todaySpend, weekDays, mealDistribution, monthlyTrend });
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const mealLabels: Record<string, string> = { breakfast: "🌅 早餐", lunch: "☀️ 午餐", dinner: "🌙 晚餐" };
  const totalMeals = stats.mealDistribution.reduce((s, m) => s + m.count, 0) || 1;

  return (
    <div className="space-y-4">
      {/* 数据卡片 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-3">本月统计</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#FF6B35]">{stats.totalDays}</p>
            <p className="text-xs text-gray-400">打卡天数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#FF6B35]">{stats.streak}</p>
            <p className="text-xs text-gray-400">连续打卡</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-50">
          <div className="text-center">
            <p className="text-lg font-bold text-orange-500">¥{stats.totalSpend.toFixed(0)}</p>
            <p className="text-[10px] text-gray-400">本月花费</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-orange-500">¥{stats.todaySpend.toFixed(0)}</p>
            <p className="text-[10px] text-gray-400">今日花费</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-orange-500">{stats.completionRate}%</p>
            <p className="text-[10px] text-gray-400">完成率</p>
          </div>
        </div>
      </div>

      {/* 本周柱状图 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-800 mb-3">本周打卡</p>
        <div className="flex items-end justify-between gap-1 h-16">
          {stats.weekDays.map((day, idx) => {
            const height = Math.max(4, (day.count / 3) * 48);
            const isToday = day.date === todayStr;
            const isFuture = day.date > todayStr;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center">
                  <div
                    className={`w-5 rounded-t transition-all ${
                      isFuture
                        ? "bg-gray-100"
                        : day.count > 0
                        ? isToday ? "bg-[#FF6B35]" : "bg-[#FF6B35]/60"
                        : "bg-gray-100"
                    }`}
                    style={{ height: `${isFuture ? 4 : height}px` }}
                  />
                </div>
                <span className={`text-[10px] ${isToday ? "text-[#FF6B35] font-bold" : "text-gray-400"}`}>
                  {dayLabels[idx]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 px-1">
          {stats.weekDays.map((day) => (
            <span key={day.date} className="flex-1 text-center text-[9px] text-gray-400">
              {day.spend > 0 ? `¥${day.spend}` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* 餐类型分布 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-800 mb-3">用餐分布</p>
        <div className="space-y-3">
          {stats.mealDistribution.map((meal) => {
            const pct = totalMeals > 0 ? Math.round((meal.count / totalMeals) * 100) : 0;
            return (
              <div key={meal.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{mealLabels[meal.type]}</span>
                  <span className="text-sm font-bold text-gray-800">{meal.count}次 <span className="text-xs text-gray-400">({pct}%)</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF6B35] to-orange-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 月度趋势 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-800 mb-3">月度趋势</p>
        <div className="flex items-end justify-around gap-3 h-20">
          {stats.monthlyTrend.map((m, idx) => {
            const isCurrent = idx === stats.monthlyTrend.length - 1;
            const height = Math.max(8, (m.days / 30) * 64);
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500 font-medium">{m.days}天</span>
                <div className="w-full flex justify-center">
                  <div
                    className={`w-8 rounded-t ${isCurrent ? "bg-[#FF6B35]" : "bg-[#FF6B35]/40"}`}
                    style={{ height: `${height}px` }}
                  />
                </div>
                <span className={`text-xs ${isCurrent ? "text-[#FF6B35] font-bold" : "text-gray-400"}`}>
                  {m.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
