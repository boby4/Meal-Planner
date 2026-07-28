"use client";

import { useState, useEffect, useCallback } from "react";

interface CheckInStatsProps {
  refreshKey: number;
}

interface Stats {
  totalDays: number;
  streak: number;
  completionRate: number;
  weekDays: { date: string; count: number }[];
}

export default function CheckInStats({ refreshKey }: CheckInStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalDays: 0,
    streak: 0,
    completionRate: 0,
    weekDays: [],
  });

  const loadStats = useCallback(async () => {
    try {
      const today = new Date();
      const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      const res = await fetch(`/api/checkin?month=${monthStr}`);
      if (!res.ok) return;

      const data = await res.json();
      const checkIns = data.checkIns || [];

      // 按日期分组统计每日打卡餐数
      const dateCountMap: Record<string, number> = {};
      for (const record of checkIns) {
        dateCountMap[record.check_date] = (dateCountMap[record.check_date] || 0) + 1;
      }

      // 总打卡天数
      const totalDays = Object.keys(dateCountMap).length;

      // 连续打卡天数（从今天往前数）
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

      // 本月完成率（已过天数中打卡天数占比）
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const passedDays = today.getDate();
      const completionRate = passedDays > 0 ? Math.round((totalDays / passedDays) * 100) : 0;

      // 本周数据（周一到周日）
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      const weekDays: { date: string; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        weekDays.push({ date: dateStr, count: dateCountMap[dateStr] || 0 });
      }

      setStats({ totalDays, streak, completionRate, weekDays });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-800 mb-3">本月统计</h3>

      {/* 数据卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#FF6B35]">{stats.totalDays}</p>
          <p className="text-xs text-gray-400">打卡天数</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#FF6B35]">{stats.streak}</p>
          <p className="text-xs text-gray-400">连续打卡</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#FF6B35]">{stats.completionRate}%</p>
          <p className="text-xs text-gray-400">完成率</p>
        </div>
      </div>

      {/* 本周柱状图 */}
      <div>
        <p className="text-sm text-gray-500 mb-2">本周打卡</p>
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
      </div>
    </div>
  );
}
