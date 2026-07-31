import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/error-handler";
import { POINT_RULES } from "@/app/api/points/route";

// GET /api/checkin?month=2026-07 或 ?date=2026-07-16
export async function GET(request: Request) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId, deviceId } = await getAuthFromRequest(request);
    if (!userId && !deviceId) {
      return NextResponse.json({ error: "需要登录或设备ID" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const date = searchParams.get("date");

    if (month) {
      const rows = await env.DB.prepare(
        userId
          ? `SELECT * FROM check_ins WHERE user_id = ? AND check_date LIKE ? ORDER BY check_date ASC`
          : `SELECT * FROM check_ins WHERE device_id = ? AND check_date LIKE ? ORDER BY check_date ASC`
      ).bind(userId || deviceId, `${month}%`).all();

      return NextResponse.json({ checkIns: rows.results || [] });
    }

    if (date) {
      const rows = await env.DB.prepare(
        userId
          ? `SELECT * FROM check_ins WHERE user_id = ? AND check_date = ? ORDER BY meal_type ASC`
          : `SELECT * FROM check_ins WHERE device_id = ? AND check_date = ? ORDER BY meal_type ASC`
      ).bind(userId || deviceId, date).all();

      return NextResponse.json({ checkIns: rows.results || [] });
    }

    return NextResponse.json({ error: "请提供 month 或 date 参数" }, { status: 400 });
  } catch (error) {
    return handleAPIError(error);
  }
}

// POST /api/checkin - 新增/更新打卡记录
export async function POST(request: Request) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId, deviceId } = await getAuthFromRequest(request);
    if (!userId && !deviceId) {
      return NextResponse.json({ error: "需要登录或设备ID" }, { status: 401 });
    }

    const body = await request.json();
    const { check_date, meal_type, recipe_name, recipe_data, image_url, note, cost } = body;

    if (!check_date || !meal_type || !recipe_name) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    await env.DB.prepare(
      `INSERT INTO check_ins (user_id, device_id, check_date, meal_type, recipe_name, recipe_data, image_url, note, cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, check_date, meal_type)
       DO UPDATE SET recipe_name = excluded.recipe_name, recipe_data = excluded.recipe_data, image_url = excluded.image_url, note = excluded.note, cost = excluded.cost`
    ).bind(userId, deviceId || "", check_date, meal_type, recipe_name, JSON.stringify(recipe_data || {}), image_url || null, note || null, cost || 0).run();

    // 打卡成功后赠送积分（仅限已登录用户）
    if (userId) {
      try {
        const pointEnv = await getEnv();
        if (!pointEnv?.DB) return NextResponse.json({ success: true });
        const db = pointEnv.DB;
        
        // 检查今天是否已经获得过签到积分（北京时间）
        const todayCheckin = await db
          .prepare(
            "SELECT id FROM point_records WHERE user_id = ? AND type = 'DAILY_CHECKIN' AND date(created_at, '+8 hours') = date('now', '+8 hours')"
          )
          .bind(userId)
          .first();

        if (!todayCheckin) {
          const rule = POINT_RULES.DAILY_CHECKIN;
          
          // 更新积分
          await db
            .prepare(
              "INSERT INTO user_points (user_id, points, total_earned) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET points = points + ?, total_earned = total_earned + ?, updated_at = datetime('now', '+8 hours')"
            )
            .bind(userId, rule.points, rule.points, rule.points, rule.points)
            .run();
          
          // 记录积分变动
          await db
            .prepare(
              "INSERT INTO point_records (user_id, points, type, description) VALUES (?, ?, 'DAILY_CHECKIN', ?)"
            )
            .bind(userId, rule.points, rule.description)
            .run();
        }

        // 检查连续签到奖励（7天，北京时间）
        const consecutiveDays = await db
          .prepare(
            "SELECT COUNT(DISTINCT check_date) as days FROM check_ins WHERE user_id = ? AND check_date >= date('now', '+8 hours', '-7 days')"
          )
          .bind(userId)
          .first<{ days: number }>();

        if (consecutiveDays && consecutiveDays.days >= 7) {
          const bonusRule = POINT_RULES.CONSECUTIVE_7_DAYS;
          
          // 检查是否已经获得过连续签到奖励（北京时间）
          const existingBonus = await db
            .prepare(
              "SELECT id FROM point_records WHERE user_id = ? AND type = 'CONSECUTIVE_7_DAYS' AND created_at > date('now', '+8 hours', '-7 days')"
            )
            .bind(userId)
            .first();

          if (!existingBonus) {
            await db
              .prepare(
                "UPDATE user_points SET points = points + ?, total_earned = total_earned + ?, updated_at = datetime('now', '+8 hours') WHERE user_id = ?"
              )
              .bind(bonusRule.points, bonusRule.points, userId)
              .run();

            await db
              .prepare(
                "INSERT INTO point_records (user_id, points, type, description) VALUES (?, ?, 'CONSECUTIVE_7_DAYS', ?)"
              )
              .bind(userId, bonusRule.points, bonusRule.description)
              .run();
          }
        }
      } catch (e) {
        console.error("签到积分发放失败:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}

// DELETE /api/checkin?id=1
export async function DELETE(request: Request) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    await env.DB.prepare("DELETE FROM check_ins WHERE id = ?").bind(Number(id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
