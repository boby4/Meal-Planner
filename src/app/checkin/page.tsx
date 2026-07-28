"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import CalendarView from "@/components/CalendarView";
import CheckInModal from "@/components/CheckInModal";
import CheckInStats from "@/components/CheckInStats";

export default function CheckInPage() {
  const router = useRouter();
  const { authFetch } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const handleUpdate = useCallback(() => {
    setStatsRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF8F2]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-12 flex items-center">
          <button onClick={() => router.back()} className="text-gray-600 mr-3">←</button>
          <h1 className="text-lg font-bold text-gray-800">饮食打卡</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 日历 */}
        <CalendarView onDateClick={handleDateClick} authFetch={authFetch} />

        {/* 统计 */}
        <CheckInStats refreshKey={statsRefreshKey} authFetch={authFetch} />
      </div>

      {/* 打卡模态框 */}
      {selectedDate && (
        <CheckInModal
          date={selectedDate}
          onClose={handleCloseModal}
          onUpdate={handleUpdate}
          authFetch={authFetch}
        />
      )}
    </div>
  );
}
