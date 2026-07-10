import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";

function userFilter(userId: number | null, deviceId: string) {
  if (userId) return { clause: "user_id = ?", binds: [userId as string | number] };
  if (deviceId) return { clause: "user_id IS NULL AND device_id = ?", binds: [deviceId] };
  return { clause: "1 = 0", binds: [] as (string | number)[] };
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split("T")[0];
}

/** GET /api/menu */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);
    const weekStart = getWeekStart();

    const result = await env.DB.prepare(
      `SELECT id, day_of_week, meal_type, recipe_name, recipe_data FROM weekly_menu WHERE ${clause} AND week_start = ? ORDER BY day_of_week, meal_type`
    ).bind(...binds, weekStart).all();

    const menu = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      meal_type: row.meal_type,
      recipe_name: row.recipe_name,
      recipe_data: row.recipe_data ? JSON.parse(row.recipe_data as string) : null,
    }));

    return NextResponse.json({ menu, week_start: weekStart });
  } catch (error) {
    console.error("GET /api/menu 错误:", error);
    return NextResponse.json({ error: "获取菜单失败" }, { status: 500 });
  }
}

/** POST /api/menu */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { day_of_week, meal_type, recipe_name, recipe_data } = await request.json();
    if (day_of_week === undefined || !meal_type || !recipe_name) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const weekStart = getWeekStart();

    await env.DB.prepare(
      "DELETE FROM weekly_menu WHERE week_start = ? AND day_of_week = ? AND meal_type = ? AND (user_id = ? OR (user_id IS NULL AND device_id = ?))"
    ).bind(weekStart, day_of_week, meal_type, userId ?? -1, deviceId).run();

    await env.DB.prepare(
      "INSERT INTO weekly_menu (user_id, device_id, day_of_week, meal_type, recipe_name, recipe_data, week_start) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(userId, userId ? "" : deviceId, day_of_week, meal_type, recipe_name, recipe_data ? JSON.stringify(recipe_data) : null, weekStart).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/menu 错误:", error);
    return NextResponse.json({ error: "添加菜单失败" }, { status: 500 });
  }
}

/** DELETE /api/menu */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await env.DB.prepare(
        `DELETE FROM weekly_menu WHERE id = ? AND ${clause}`
      ).bind(Number(id), ...binds).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/menu 错误:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
