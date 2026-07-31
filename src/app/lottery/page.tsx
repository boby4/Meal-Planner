"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";

// ============ 常量定义 ============

/** 转盘食材符号池 */
const SYMBOLS = ["🍅", "🥬", "🍗", "🐟", "🥕", "🍄", "🦐", "🥩", "🌽", "🍳", "🧄", "🥦", "🍜", "🫑", "🥟"];

/** 网格配置：3行5列 */
const ROWS = 3;
const COLS = 5;

/** 支付线定义（行索引组合） */
const PAYLINES: { name: string; cells: [number, number][] }[] = [
  { name: "第一行", cells: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { name: "第二行", cells: [[1,0],[1,1],[1,2],[1,3],[1,4]] },
  { name: "第三行", cells: [[2,0],[2,1],[2,2],[2,3],[2,4]] },
  { name: "对角线↘", cells: [[0,0],[1,1],[2,2],[1,3],[0,4]] },
  { name: "对角线↗", cells: [[2,0],[1,1],[0,2],[1,3],[2,4]] },
];

/** 投注积分选项（与积分系统兼容） */
const BET_OPTIONS = [
  { label: "10积分", value: 10 },
  { label: "50积分", value: 50 },
  { label: "100积分", value: 100 },
  { label: "200积分", value: 200 },
];

/** 摇次数选项 */
const SPIN_COUNT_OPTIONS = [
  { label: "10次", value: 10 },
  { label: "50次", value: 50 },
  { label: "100次", value: 100 },
  { label: "无限", value: 0 },
];

/** 中奖结果类型 */
type ResultType = "miss" | "small" | "medium" | "big" | "jackpot";

const RESULT_INFO: Record<ResultType, { emoji: string; label: string; color: string }> = {
  miss: { emoji: "💨", label: "未命中", color: "#9CA3AF" },
  small: { emoji: "🎉", label: "恭喜中奖！", color: "#F59E0B" },
  medium: { emoji: "🎊", label: "大奖！", color: "#F97316" },
  big: { emoji: "🌟", label: "超级大奖！", color: "#EF4444" },
  jackpot: { emoji: "🏆", label: "450倍暴击！", color: "#DC2626" },
};

/** 备用菜谱池（本地 R2 不可用时兜底） */
const FALLBACK_RECIPES = [
  { name: "红烧肉", desc: "肥而不腻，入口即化" },
  { name: "番茄炒蛋", desc: "国民家常菜，酸甜可口" },
  { name: "可乐鸡翅", desc: "甜香入味，色泽红亮" },
  { name: "酸菜鱼", desc: "酸辣开胃，鱼肉嫩滑" },
  { name: "宫保鸡丁", desc: "麻辣鲜香，花生酥脆" },
  { name: "麻婆豆腐", desc: "麻辣烫嫩，下饭神器" },
  { name: "糖醋排骨", desc: "外酥里嫩，酸甜适口" },
  { name: "清蒸鲈鱼", desc: "鲜嫩原味，营养丰富" },
  { name: "回锅肉", desc: "肉片微卷，酱香浓郁" },
  { name: "水煮牛肉", desc: "麻辣鲜烫，牛肉滑嫩" },
  { name: "蒜蓉西兰花", desc: "清爽低脂，简单快手" },
  { name: "蛋炒饭", desc: "粒粒分明，锅气十足" },
  { name: "酸辣土豆丝", desc: "爽脆开胃，家常经典" },
  { name: "干锅花菜", desc: "焦香微辣，越吃越香" },
  { name: "葱油拌面", desc: "葱香四溢，简单满足" },
  { name: "白切鸡", desc: "皮爽肉滑，原汁原味" },
  { name: "鱼香肉丝", desc: "甜酸微辣，层次丰富" },
  { name: "啤酒鸭", desc: "酱香浓厚，肉质紧实" },
  { name: "蒜苔炒肉", desc: "脆嫩清香，快手好菜" },
  { name: "西红柿牛腩", desc: "浓汤慢炖，暖胃暖心" },
];

/** 模拟播报数据 */
const MOCK_BROADCASTS = [
  { nickname: "吃货小王", resultType: "medium" as ResultType, betAmount: 200, win: 3000, time: "2分钟前" },
  { nickname: "干饭达人", resultType: "small" as ResultType, betAmount: 100, win: 500, time: "5分钟前" },
  { nickname: "厨房新手", resultType: "big" as ResultType, betAmount: 500, win: 22500, time: "8分钟前" },
  { nickname: "美食猎人", resultType: "small" as ResultType, betAmount: 50, win: 250, time: "12分钟前" },
  { nickname: "夜宵大师", resultType: "medium" as ResultType, betAmount: 1000, win: 15000, time: "15分钟前" },
];

// ============ 工具函数 ============

function randomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function generateGrid(): string[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => randomSymbol())
  );
}

function formatWan(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  return String(n);
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

/** 根据概率决定中奖结果 */
function rollResult(): ResultType {
  const r = Math.random() * 100;
  if (r < 50) return "miss";
  if (r < 62) return "small";
  if (r < 83) return "medium";
  if (r < 96.5) return "big";
  return "jackpot";
}

const MULTIPLIER: Record<ResultType, number> = {
  miss: 0,
  small: 5,
  medium: 15,
  big: 45,
  jackpot: 450,
};

// ============ 主页面组件 ============

type TabType = "game" | "stats" | "records" | "rules";

interface SpinRecord {
  id: number;
  grid: string[][];
  resultType: ResultType;
  betAmount: number;
  winAmount: number;
  recipeName: string;
  recipeDesc: string;
  time: string;
}

export default function LotteryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<TabType>("game");

  // 游戏状态
  const [grid, setGrid] = useState<string[][]>(generateGrid);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>([0, 1]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(50);
  const [spinCount, setSpinCount] = useState(10);

  // 结果状态
  const [lastResult, setLastResult] = useState<ResultType | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [lastRecipe, setLastRecipe] = useState<{ name: string; desc: string } | null>(null);
  const [hitLines, setHitLines] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());

  // 统计
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalBet, setTotalBet] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [maxWin, setMaxWin] = useState(0);
  const [records, setRecords] = useState<SpinRecord[]>([]);

  // 播报
  const [broadcastTab, setBroadcastTab] = useState<"latest" | "big">("latest");
  // 播报数据
  const [broadcasts, setBroadcasts] = useState<{resultType: ResultType; betAmount: number; win: number; time: string}[]>([]);

  // 动画控制
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recordIdRef = useRef(0);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
      stopTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // 加载统计数据、记录和播报
  useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem('meal_planner_token');
      if (!token) return;

      try {
        // 并行加载
        const [statsRes, recordsRes, broadcastRes] = await Promise.all([
          fetch('/api/lottery?type=stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/lottery', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/lottery?type=broadcast')
        ]);

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setTotalSpins(stats.total_spins || 0);
          setTotalBet(stats.total_bet || 0);
          setTotalWin(stats.total_win || 0);
          setMaxWin(stats.max_win || 0);
        }

        if (recordsRes.ok) {
          const data = await recordsRes.json();
          setRecords((data || []).map((r: any, i: number) => ({
            id: r.id || i + 1,
            grid: generateGrid(),
            resultType: r.result_type,
            betAmount: r.bet_amount,
            winAmount: r.win_amount,
            recipeName: r.recipe_name,
            recipeDesc: '摇摇乐推荐',
            time: new Date(r.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
          })));
        }

        if (broadcastRes.ok) {
          const data = await broadcastRes.json();
          setBroadcasts((data || []).map((r: any) => ({
            resultType: r.result_type,
            betAmount: r.bet_amount,
            win: r.win_amount,
            time: getTimeAgo(r.created_at)
          })));
        }
      } catch (error) {
        console.error('Failed to load lottery data:', error);
      }
    };

    loadData();
  }, [user]);

  /** 获取随机菜谱 */
  const fetchRandomRecipe = useCallback(async (): Promise<{ name: string; desc: string }> => {
    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      const json = await res.json();
      if (json.recipes?.[0]?.name) {
        return { name: json.recipes[0].name, desc: json.recipes[0].reason || "摇摇乐推荐" };
      }
    } catch {
      /* 兜底 */
    }
    return FALLBACK_RECIPES[Math.floor(Math.random() * FALLBACK_RECIPES.length)];
  }, []);

  /** 计算命中 */
  const evaluateGrid = useCallback((g: string[][], target: string) => {
    const lines: string[] = [];
    const cells = new Set<string>();
    for (const line of PAYLINES) {
      let count = 0;
      for (const [r, c] of line.cells) {
        if (g[r][c] === target) count++;
      }
      if (count >= 3) {
        lines.push(line.name);
        line.cells.forEach(([r, c]) => {
          if (g[r][c] === target) cells.add(`${r}-${c}`);
        });
      }
    }
    return { lines, cells };
  }, []);

  /** 执行一次摇奖 */
  const doSpin = useCallback(async () => {
    if (isSpinning) return;
    if (!selectedCell) return;

    // 扣减积分（按投注金额扣减）
    try {
      const token = localStorage.getItem('meal_planner_token');
      const pointsRes = await fetch('/api/points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'LOTTERY_SPIN', points: betAmount })
      });

      if (!pointsRes.ok) {
        const errorData = await pointsRes.json();
        if (errorData.error === '积分不足') {
          showToast('积分不足，无法投注！每日签到可获得积分哦～', 'error');
          return;
        }
        throw new Error(errorData.error);
      }
      showToast(`-${betAmount} 积分`, 'info');
    } catch (error) {
      console.error('Points deduction failed:', error);
      showToast('积分扣减失败，请重试', 'error');
      return;
    }

    setIsSpinning(true);
    setShowResult(false);
    setLastResult(null);
    setWinCells(new Set());
    setHitLines([]);

    const target = grid[selectedCell[0]][selectedCell[1]];

    // 快速滚动动画
    spinTimerRef.current = setInterval(() => {
      setGrid(generateGrid());
    }, 80);

    // 预决定结果
    const resultType = rollResult();
    const multiplier = MULTIPLIER[resultType];
    const winAmount = Math.round(betAmount * multiplier);

    // 生成最终网格
    let finalGrid = generateGrid();
    if (resultType !== "miss") {
      // 中奖时：在随机一条支付线上放置 3+ 个目标符号
      const line = PAYLINES[Math.floor(Math.random() * PAYLINES.length)];
      const placeCount = resultType === "jackpot" ? 5 : resultType === "big" ? 4 : 3;
      const shuffled = [...line.cells].sort(() => Math.random() - 0.5);
      for (let i = 0; i < placeCount; i++) {
        const [r, c] = shuffled[i];
        finalGrid[r][c] = target;
      }
    } else {
      // 未中奖时确保目标符号不超过2个连续
      let attempts = 0;
      while (attempts < 20) {
        const { lines } = evaluateGrid(finalGrid, target);
        if (lines.length === 0) break;
        finalGrid = generateGrid();
        attempts++;
      }
    }

    // 逐列停止
    await new Promise<void>((resolve) => {
      for (let col = 0; col < COLS; col++) {
        const timer = setTimeout(() => {
          setGrid((prev) => {
            const next = prev.map((row) => [...row]);
            for (let row = 0; row < ROWS; row++) {
              next[row][col] = finalGrid[row][col];
            }
            return next;
          });
          if (col === COLS - 1) {
            if (spinTimerRef.current) clearInterval(spinTimerRef.current);
            resolve();
          }
        }, 600 + col * 350);
        stopTimersRef.current.push(timer);
      }
    });

    // 额外等待最后一列停稳
    await new Promise((r) => setTimeout(r, 300));

    // 结算
    const { lines, cells } = evaluateGrid(finalGrid, target);
    const recipe = await fetchRandomRecipe();

    // 中奖积分入库
    if (winAmount > 0) {
      try {
        const token = localStorage.getItem('meal_planner_token');
        await fetch('/api/points', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ type: 'LOTTERY_WIN', points: winAmount })
        });
        showToast(`🎉 恭喜中奖！+${winAmount} 积分`, 'success');
      } catch (error) {
        console.error('Failed to save lottery win points:', error);
      }
    }

    setTotalSpins((p) => p + 1);
    setTotalBet((p) => p + betAmount);
    setTotalWin((p) => p + winAmount);
    if (winAmount > maxWin) setMaxWin(winAmount);
    setLastResult(resultType);
    setLastWin(winAmount);
    setLastRecipe(recipe);
    setHitLines(lines);
    setWinCells(cells);
    setShowResult(true);
    setIsSpinning(false);

    // 记录
    recordIdRef.current += 1;
    const record: SpinRecord = {
      id: recordIdRef.current,
      grid: finalGrid,
      resultType,
      betAmount,
      winAmount,
      recipeName: recipe.name,
      recipeDesc: recipe.desc,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };
    setRecords((prev) => [record, ...prev].slice(0, 50));

    // 保存记录到数据库
    try {
      const token = localStorage.getItem('meal_planner_token');
      await fetch('/api/lottery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resultType, betAmount, winAmount, recipeName: recipe.name })
      });
    } catch (error) {
      console.error('Failed to save lottery record:', error);
    }
  }, [isSpinning, selectedCell, grid, betAmount, maxWin, evaluateGrid, fetchRandomRecipe]);

  /** 自动摇 */
  const autoSpinRef = useRef(false);
  const [autoSpinning, setAutoSpinning] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);

  const startAutoSpin = useCallback(() => {
    if (autoSpinning) {
      autoSpinRef.current = false;
      setAutoSpinning(false);
      setAutoRemaining(0);
      return;
    }
    autoSpinRef.current = true;
    setAutoSpinning(true);
    setAutoRemaining(spinCount);
  }, [autoSpinning, spinCount]);

  useEffect(() => {
    if (!autoSpinning || isSpinning) return;
    if (autoRemaining <= 0 && spinCount !== 0) {
      autoSpinRef.current = false;
      setAutoSpinning(false);
      return;
    }
    const timer = setTimeout(() => {
      if (autoSpinRef.current) {
        if (spinCount !== 0) setAutoRemaining((p) => p - 1);
        doSpin();
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [autoSpinning, isSpinning, autoRemaining, spinCount, doSpin]);

  /** 点击格子选择 */
  const handleCellClick = (row: number, col: number) => {
    if (isSpinning) return;
    setSelectedCell([row, col]);
    setShowResult(false);
  };

  const resultInfo = lastResult ? RESULT_INFO[lastResult] : null;

  return (
    <div className="min-h-screen flex flex-col lottery-bg">
      {/* ===== 顶部导航栏 ===== */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-2">
          {/* 第一行：标题 */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none"
            >
              ✕
            </button>
            <h1 className="font-bold text-gray-900 text-sm">
              今天吃什么 · 摇摇乐
            </h1>
          </div>
          {/* 第二行：Tab导航 */}
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {(
              [
                { key: "game", label: "🎮 游戏" },
                { key: "stats", label: "📊 盈亏统计" },
                { key: "records", label: "📋 我的记录" },
                { key: "rules", label: "❓ 玩法说明" },
              ] as { key: TabType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === tab.key
                    ? "bg-white border border-gray-200 shadow-sm font-medium text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ===== 主内容区 ===== */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {/* ---- 游戏 Tab ---- */}
          {activeTab === "game" && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              {/* 主抽奖卡片 */}
              <div className="lottery-card rounded-2xl p-4 relative overflow-hidden">
                {/* 点状纹理 */}
                <div className="absolute inset-0 lottery-dots pointer-events-none" />

                <div className="relative z-10">
                  {/* 进度指示点 */}
                  <div className="flex justify-center gap-2 mb-4">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === 4
                            ? "bg-orange-500 scale-125 shadow-sm shadow-orange-300"
                            : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>

                  {/* 3×5 网格 */}
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {grid.map((row, r) =>
                      row.map((symbol, c) => {
                        const isSelected =
                          selectedCell?.[0] === r && selectedCell?.[1] === c;
                        const isWinCell = winCells.has(`${r}-${c}`);
                        return (
                          <button
                            key={`${r}-${c}`}
                            onClick={() => handleCellClick(r, c)}
                            className={`aspect-square rounded-xl flex items-center justify-center text-3xl sm:text-4xl transition-all duration-150 select-none
                              ${isWinCell && showResult
                                ? "bg-amber-100 ring-2 ring-amber-400 animate-pulse"
                                : isSelected
                                ? "bg-white ring-[3px] ring-orange-500 shadow-md scale-105"
                                : "bg-white/60 hover:bg-white hover:shadow-sm"
                            }`}
                          >
                            <motion.span
                              key={`${grid[r][c]}-${r}-${c}`}
                              initial={isSpinning ? { y: -12, opacity: 0.3 } : false}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ duration: 0.08 }}
                            >
                              {symbol}
                            </motion.span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* 结果展示区 / 提示语 */}
                  <div className="text-center min-h-[60px] flex flex-col items-center justify-center">
                    {showResult && resultInfo && lastRecipe ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <span
                          className="font-bold text-lg"
                          style={{ color: resultInfo.color }}
                        >
                          {resultInfo.emoji} {resultInfo.label}
                        </span>
                        {lastWin > 0 && (
                          <span className="text-sm text-gray-600">
                            🎯 命中 {hitLines.length} 条支付线！赢得{" "}
                            <b className="text-orange-600">{formatWan(lastWin)}</b> 美食积分
                          </span>
                        )}
                        {lastWin === 0 && (
                          <span className="text-sm text-gray-500">💨 未命中，再接再厉！</span>
                        )}
                        <button
                          onClick={() =>
                            router.push(`/recipe/${encodeURIComponent(lastRecipe.name)}`)
                          }
                          className="mt-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-white text-sm font-medium shadow-md hover:shadow-lg active:scale-95 transition-all"
                        >
                          🍽️ 抽中菜谱：{lastRecipe.name} → 查看做法
                        </button>
                      </motion.div>
                    ) : (
                      <p className="text-gray-800 text-sm font-medium">
                        {isSpinning ? "旋转中... 🎰" : "选择投注，然后摇一摇！🎲"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 投注区 */}
              <div className="flex flex-col gap-3">
                {/* 投注金额 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                    💵 投注
                  </span>
                  {BET_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBetAmount(opt.value)}
                      disabled={isSpinning}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        betAmount === opt.value
                          ? "bg-amber-400 text-white shadow-md shadow-amber-200 scale-105"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-amber-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* 摇！按钮 + 自动 */}
                <div className="flex items-center justify-center gap-3">
                  <motion.button
                    onClick={doSpin}
                    disabled={isSpinning}
                    whileTap={{ scale: 0.92 }}
                    className={`relative px-14 py-3.5 rounded-full text-white text-xl font-bold shadow-lg transition-all
                      ${
                        isSpinning
                          ? "bg-gray-300 cursor-not-allowed shadow-none"
                          : "bg-gradient-to-b from-amber-400 via-orange-400 to-orange-500 shadow-orange-300/60 hover:shadow-xl hover:brightness-105"
                      }`}
                  >
                    {isSpinning ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                        >
                          🎰
                        </motion.span>
                        旋转中
                      </span>
                    ) : (
                      "🎲 摇 !"
                    )}
                    {/* 光效 */}
                    {!isSpinning && (
                      <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                        <span className="absolute -top-1/2 left-1/4 w-1/3 h-full bg-white/20 rotate-12 blur-sm" />
                      </span>
                    )}
                  </motion.button>

                  <button
                    onClick={startAutoSpin}
                    className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                      autoSpinning
                        ? "bg-orange-50 border-orange-300 text-orange-600"
                        : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    {autoSpinning ? `停止 (${autoRemaining})` : "自动"}
                  </button>
                </div>

                {/* 摇次数 */}
                <div className="flex items-center justify-center gap-2">
                  {SPIN_COUNT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSpinCount(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        spinCount === opt.value
                          ? "bg-orange-50 border-orange-300 text-orange-600"
                          : "bg-white border-gray-200 text-gray-500 hover:border-orange-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

              </div>

              {/* 底部状态区 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 正在摇一摇 */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">🎮</span>
                    <span className="text-xs font-bold text-gray-800">正在摇一摇</span>
                  </div>
                  {isSpinning || autoSpinning ? (
                    <div className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="text-lg"
                      >
                        🎰
                      </motion.span>
                      <span className="text-xs text-gray-500">
                        {autoSpinning ? `自动模式 · 剩余${autoRemaining}次` : "手动旋转中..."}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">暂无人在摇，快来成为第一个！</p>
                  )}
                </div>

                {/* 摇摇播报 */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">📢</span>
                      <span className="text-xs font-bold text-gray-800">摇摇播报</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setBroadcastTab("latest")}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          broadcastTab === "latest"
                            ? "bg-amber-400 text-white"
                            : "border border-gray-200 text-gray-500"
                        }`}
                      >
                        最新
                      </button>
                      <button
                        onClick={() => setBroadcastTab("big")}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          broadcastTab === "big"
                            ? "bg-amber-400 text-white"
                            : "border border-gray-200 text-gray-500"
                        }`}
                      >
                        大奖
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[80px] overflow-hidden">
                    {(broadcastTab === "big"
                      ? broadcasts.filter((b) => b.resultType !== "small")
                      : broadcasts
                    )
                      .slice(0, 3)
                      .map((b, i) => (
                        <div key={i} className="flex items-center gap-1 text-[11px] text-gray-500">
                          <span>{RESULT_INFO[b.resultType].emoji}</span>
                          <span className="font-medium text-gray-700">匿名用户</span>
                          <span>
                            下注{formatWan(b.betAmount)}，赢{formatWan(b.win)}
                          </span>
                          <span className="ml-auto text-gray-300">{b.time}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- 盈亏统计 Tab ---- */}
          {activeTab === "stats" && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="lottery-card rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute inset-0 lottery-dots pointer-events-none" />
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">📊 我的摇摇乐统计</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/80 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{totalSpins}</p>
                      <p className="text-xs text-gray-500 mt-1">总旋转次数</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-orange-600">{formatWan(totalBet)}</p>
                      <p className="text-xs text-gray-500 mt-1">总投注积分</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold ${totalWin >= totalBet ? "text-green-600" : "text-red-500"}`}>
                        {totalWin > 0 ? "+" : ""}{formatWan(totalWin)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">总赢取积分</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{formatWan(maxWin)}</p>
                      <p className="text-xs text-gray-500 mt-1">单次最高奖</p>
                    </div>
                  </div>
                  <div className="mt-4 bg-white/80 rounded-xl p-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>盈亏</span>
                      <span className={totalWin - totalBet >= 0 ? "text-green-600" : "text-red-500"}>
                        {totalWin - totalBet >= 0 ? "+" : ""}{formatWan(totalWin - totalBet)} 积分
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${totalWin >= totalBet ? "bg-green-400" : "bg-red-400"}`}
                        style={{ width: `${totalBet > 0 ? Math.min(100, (totalWin / (totalBet || 1)) * 50) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- 我的记录 Tab ---- */}
          {activeTab === "records" && (
            <motion.div
              key="records"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {records.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">🎰</p>
                  <p className="text-sm">暂无记录，快去摇一摇吧！</p>
                </div>
              ) : (
                records.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3"
                  >
                    <span className="text-2xl">{RESULT_INFO[rec.resultType].emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {rec.recipeName}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            color: RESULT_INFO[rec.resultType].color,
                            backgroundColor: `${RESULT_INFO[rec.resultType].color}15`,
                          }}
                        >
                          {RESULT_INFO[rec.resultType].label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        下注 {formatWan(rec.betAmount)} · {rec.time}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${rec.winAmount > 0 ? "text-green-600" : "text-gray-400"}`}>
                        {rec.winAmount > 0 ? `+${formatWan(rec.winAmount)}` : "×0"}
                      </p>
                      <button
                        onClick={() => router.push(`/recipe/${encodeURIComponent(rec.recipeName)}`)}
                        className="text-[10px] text-orange-500 hover:underline"
                      >
                        查看菜谱 →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* ---- 玩法说明 Tab ---- */}
          {activeTab === "rules" && (
            <motion.div
              key="rules"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-5 text-sm text-gray-600">
                <section>
                  <h3 className="font-bold text-gray-800 mb-2">🎮 基础玩法</h3>
                  <p className="leading-relaxed">
                    摇摇乐是一款 3×5 的食材老虎机游戏，共有 5 条支付线（3 行 + 2 条对角线）。
                    点击选择一个食材格子作为投注目标，设置投注积分后点击「摇！」，卷轴开始转动。
                  </p>
                  <p className="leading-relaxed mt-2">
                    当卷轴停止后，从左至右在任意支付线上出现 3 个或以上相同的目标食材即为「命中」，
                    系统将随机为你推荐一道菜谱！
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-gray-800 mb-2">📊 概率与倍率</h3>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-orange-50">
                        <th className="p-2 text-left rounded-tl-lg">结果</th>
                        <th className="p-2 text-center">概率</th>
                        <th className="p-2 text-right rounded-tr-lg">赔付倍率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["💨 未命中", "50%", "×0"],
                          ["🎉 中奖", "12%", "×5"],
                          ["🎊 大奖", "21%", "×15"],
                          ["🌟 超级大奖", "12%", "×45"],
                          ["🏆 暴击", "5%", "×450"],
                        ] as const
                      ).map(([label, prob, mult]) => (
                        <tr key={label} className="border-b border-gray-50">
                          <td className="p-2">{label}</td>
                          <td className="p-2 text-center">{prob}</td>
                          <td className="p-2 text-right font-medium text-orange-600">{mult}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <h3 className="font-bold text-gray-800 mb-2">💰 投注规则</h3>
                  <ul className="space-y-1 list-disc list-inside text-xs">
                    <li>投注积分选项：50 / 100 / 200 / 500 / 1000</li>
                    <li>支持自动旋转：10次 / 50次 / 100次 / 无限</li>
                    <li>无论是否命中，每次摇奖都会获得一道菜谱推荐</li>
                    <li>积分仅为游戏娱乐，不涉及真实货币</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-bold text-gray-800 mb-2">🍽️ 菜谱奖励</h3>
                  <p className="text-xs leading-relaxed">
                    每次摇奖结束后，系统会从数千道真实菜谱中随机抽取一道推荐给你。
                    中奖倍率越高，抽到的菜谱越「硬」！点击结果即可跳转查看完整做法。
                  </p>
                </section>

                <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
                  ⚠️ 免责声明：摇摇乐为应用内趣味玩法，所有积分均为虚拟数值，仅供娱乐用途，不涉及真实货币交易，不可兑换现金。请理性游戏，适度娱乐。
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>


      {/* 全局样式 */}
      <style jsx global>{`
        .lottery-bg {
          background-color: #fdf2f0;
          background-image: radial-gradient(circle, #f3d9d5 1px, transparent 1px);
          background-size: 16px 16px;
        }
        .lottery-card {
          background-color: #f8f4e9;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }
        .lottery-dots {
          background-image: radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px);
          background-size: 12px 12px;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}