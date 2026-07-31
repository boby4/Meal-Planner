import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/error-handler";

// 积分规则配置
export const POINT_RULES = {
  REGISTER: { points: 100, description: "新用户注册奖励" },
  DAILY_CHECKIN: { points: 10, description: "每日签到奖励" },
  CONSECUTIVE_7_DAYS: { points: 50, description: "连续7天签到奖励" },
  CHAT_MESSAGE: { points: -1, description: "聊天发言" },
  AI_RECOMMEND: { points: -10, description: "AI推荐" },
};

interface UserPoints {
  user_id: number;
  points: number;
  total_earned: number;
  total_spent: number;
}

// 获取用户积分
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    // 获取或创建积分记录
    let pointsResult = await env.DB
      .prepare("SELECT * FROM user_points WHERE user_id = ?")
      .bind(auth.userId)
      .first<UserPoints>();

    if (!pointsResult) {
      // 如果没有积分记录，创建一个
      await env.DB
        .prepare(
          "INSERT INTO user_points (user_id, points, total_earned, total_spent) VALUES (?, 0, 0, 0)"
        )
        .bind(auth.userId)
        .run();
      pointsResult = { user_id: auth.userId, points: 0, total_earned: 0, total_spent: 0 };
    }

    // 获取最近积分记录
    const records = await env.DB
      .prepare(
        "SELECT * FROM point_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
      )
      .bind(auth.userId)
      .all();

    return NextResponse.json({
      points: pointsResult.points,
      totalEarned: pointsResult.total_earned,
      totalSpent: pointsResult.total_spent,
      records: records.results || [],
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

// 增加/扣减积分
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { type, relatedId, points: customPoints } = body;

    // 处理摇摇乐（动态积分）
    if (type === 'LOTTERY_WIN' || type === 'LOTTERY_SPIN') {
      if (!customPoints || customPoints <= 0) {
        return NextResponse.json({ error: "无效的积分数量" }, { status: 400 });
      }

      const env = await getEnv();
      if (!env?.DB) {
        return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
      }

      // 获取当前积分
      let pointsResult = await env.DB
        .prepare("SELECT * FROM user_points WHERE user_id = ?")
        .bind(auth.userId)
        .first<UserPoints>();

      if (!pointsResult) {
        await env.DB
          .prepare(
            "INSERT INTO user_points (user_id, points, total_earned, total_spent) VALUES (?, 0, 0, 0)"
          )
          .bind(auth.userId)
          .run();
        pointsResult = { user_id: auth.userId, points: 0, total_earned: 0, total_spent: 0 };
      }

      const isWin = type === 'LOTTERY_WIN';
      const pointsChange = isWin ? customPoints : -customPoints;

      // 扣减时检查积分
      if (!isWin && pointsResult.points < customPoints) {
        return NextResponse.json(
          { error: "积分不足", currentPoints: pointsResult.points },
          { status: 400 }
        );
      }

      // 更新积分
      const newPoints = pointsResult.points + pointsChange;
      const newTotalEarned = isWin ? pointsResult.total_earned + customPoints : pointsResult.total_earned;
      const newTotalSpent = !isWin ? pointsResult.total_spent + customPoints : pointsResult.total_spent;

      await env.DB
        .prepare(
          "UPDATE user_points SET points = ?, total_earned = ?, total_spent = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
        )
        .bind(newPoints, newTotalEarned, newTotalSpent, auth.userId)
        .run();

      // 记录积分变动
      const description = isWin ? `摇摇乐中奖 +${customPoints}积分` : `摇摇乐投注 -${customPoints}积分`;
      await env.DB
        .prepare(
          "INSERT INTO point_records (user_id, points, type, description, related_id) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(auth.userId, pointsChange, type, description, relatedId || null)
        .run();

      return NextResponse.json({
        success: true,
        points: newPoints,
        description,
      });
    }

    const rule = POINT_RULES[type as keyof typeof POINT_RULES];
    if (!rule) {
      return NextResponse.json({ error: "无效的积分类型" }, { status: 400 });
    }

    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    // 获取当前积分
    let pointsResult = await env.DB
      .prepare("SELECT * FROM user_points WHERE user_id = ?")
      .bind(auth.userId)
      .first<UserPoints>();

    if (!pointsResult) {
      await env.DB
        .prepare(
          "INSERT INTO user_points (user_id, points, total_earned, total_spent) VALUES (?, 0, 0, 0)"
        )
        .bind(auth.userId)
        .run();
      pointsResult = { user_id: auth.userId, points: 0, total_earned: 0, total_spent: 0 };
    }

    // 检查扣减时是否有足够积分
    if (rule.points < 0 && pointsResult.points < Math.abs(rule.points)) {
      return NextResponse.json(
        { error: "积分不足", currentPoints: pointsResult.points },
        { status: 400 }
      );
    }

    const newPoints = pointsResult.points + rule.points;
    const newTotalEarned =
      rule.points > 0
        ? pointsResult.total_earned + rule.points
        : pointsResult.total_earned;
    const newTotalSpent =
      rule.points < 0
        ? pointsResult.total_spent + Math.abs(rule.points)
        : pointsResult.total_spent;

    // 更新积分
    await env.DB
      .prepare(
        "UPDATE user_points SET points = ?, total_earned = ?, total_spent = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      )
      .bind(newPoints, newTotalEarned, newTotalSpent, auth.userId)
      .run();

    // 记录积分变动
    await env.DB
      .prepare(
        "INSERT INTO point_records (user_id, points, type, description, related_id) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(auth.userId, rule.points, type, rule.description, relatedId || null)
      .run();

    return NextResponse.json({
      success: true,
      points: newPoints,
      earned: rule.points,
      description: rule.description,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
