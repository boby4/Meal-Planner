"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CheckInRecord {
  id: number;
  check_date: string;
  meal_type: string;
  recipe_name: string;
}

interface CalendarViewProps {
  onDateClick: (date: string) => void;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1; // 周一=0
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarView({ onDateClick }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [direction, setDirection] = useState(0);
  const [checkInMap, setCheckInMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const loadMonthData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const monthStr = `${y}-${String(m).padStart(2, "0")}`;
      const res = await fetch(`/api/checkin?month=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, number> = {};
        for (const record of data.checkIns || []) {
          const date = record.check_date;
          map[date] = (map[date] || 0) + 1;
        }
        setCheckInMap(map);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMonthData(year, month);
  }, [year, month, loadMonthData]);

  const goToPrevMonth = () => {
    setDirection(-1);
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    setDirection(1);
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
        >
          ‹
        </button>
        <h3 className="text-lg font-bold text-gray-800">{year}年{month}月</h3>
        <button
          onClick={goToNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
        >
          ›
        </button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* 日期网格 */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`${year}-${month}`}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7"
        >
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} />;

            const dateStr = formatDate(year, month, day);
            const count = checkInMap[dateStr] || 0;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && onDateClick(dateStr)}
                disabled={isFuture}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all
                  ${isFuture ? "text-gray-200 cursor-not-allowed" : "hover:bg-orange-50 cursor-pointer"}
                  ${isToday ? "font-bold text-[#FF6B35]" : "text-gray-700"}
                `}
              >
                <span>{day}</span>
                {count > 0 && (
                  <span className="text-[10px] mt-0.5">
                    {count >= 3 ? "✅" : "⚠️"}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {loading && (
        <div className="text-center text-xs text-gray-400 mt-2">加载中...</div>
      )}
    </div>
  );
}
