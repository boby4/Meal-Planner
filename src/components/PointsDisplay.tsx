'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

interface PointRecord {
  id: number;
  points: number;
  type: string;
  description: string;
  created_at: string;
}

interface PointsData {
  points: number;
  totalEarned: number;
  totalSpent: number;
  records: PointRecord[];
}

export function PointsDisplay() {
  const { user } = useAuth();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRecords, setShowRecords] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPoints();
    }
  }, [user]);

  const fetchPoints = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('meal_planner_token');
      const res = await fetch('/api/points', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPointsData(data);
      }
    } catch (error) {
      console.error('Failed to fetch points:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* 积分徽章 */}
      <button
        onClick={() => setShowRecords(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-full hover:from-amber-100 hover:to-orange-100 transition-all"
      >
        <span className="text-amber-500">🪙</span>
        <span className="text-sm font-bold text-gray-800">
          {loading ? '...' : pointsData?.points || 0}
        </span>
      </button>

      {/* 积分详情弹窗 */}
      <AnimatePresence>
        {showRecords && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={() => setShowRecords(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-lg bg-white rounded-t-2xl p-6 max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">我的积分</h3>
                <button
                  onClick={() => setShowRecords(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* 积分概览 */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <p className="text-2xl font-bold text-amber-600">{pointsData?.points || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">当前积分</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-600">{pointsData?.totalEarned || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">累计获得</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <p className="text-2xl font-bold text-red-600">{pointsData?.totalSpent || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">累计消费</p>
                </div>
              </div>

              {/* 积分规则 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">积分规则</h4>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>🎯 新用户注册：+100 积分</p>
                  <p>📅 每日签到：+10 积分</p>
                  <p>🔥 连续签到7天：+50 积分</p>
                  <p>💬 聊天发言：-1 积分/条</p>
                  <p>🤖 AI推荐：-10 积分/次</p>
                  <p>🎰 摇摇乐：-5 积分/次</p>
                </div>
              </div>

              {/* 最近记录 */}
              <div className="flex-1 overflow-y-auto">
                <h4 className="text-sm font-medium text-gray-700 mb-2">最近记录</h4>
                {pointsData?.records && pointsData.records.length > 0 ? (
                  <div className="space-y-2">
                    {pointsData.records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm text-gray-700">{record.description}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(record.created_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold ${
                            record.points > 0 ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {record.points > 0 ? '+' : ''}{record.points}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">暂无记录</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
