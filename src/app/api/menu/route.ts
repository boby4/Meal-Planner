import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireAuth, AuthRequiredError } from "@/lib/auth";
import { handleAPIError, validationError, unauthorizedError } from "@/lib/error-handler";

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
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const weekStart = getWeekStart();

    const result = await env.DB.prepare(
      `SELECT id, day_of_week, meal_type, recipe_name, recipe_data FROM weekly_menu WHERE user_id = ? AND week_start = ? ORDER BY day_of_week, meal_type`
    ).bind(userId, weekStart).all();

    const menu = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      meal_type: row.meal_type,
      recipe_name: row.recipe_name,
      recipe_data: row.recipe_data ? JSON.parse(row.recipe_data as string) : null,
    }));

    return NextResponse.json({ menu, week_start: weekStart });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/menu GET");
  }
}

/** POST /api/menu */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { day_of_week, meal_type, recipe_name, recipe_data } = await request.json();

    // 验证必填字段
    if (day_of_week === undefined || !meal_type || !recipe_name) {
      throw validationError("缺少必填字段：day_of_week, meal_type, recipe_name");
    }

    // 验证字段类型
    if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6) {
      throw validationError("day_of_week 必须是 0-6 之间的数字");
    }

    if (!["breakfast", "lunch", "dinner", "snack"].includes(meal_type)) {
      throw validationError("meal_type 必须是 breakfast、lunch、dinner 或 snack");
    }

    if (typeof recipe_name !== "string" || recipe_name.length > 200) {
      throw validationError("recipe_name 格式错误");
    }

    const weekStart = getWeekStart();

    await env.DB.prepare(
      "DELETE FROM weekly_menu WHERE week_start = ? AND day_of_week = ? AND meal_type = ? AND user_id = ?"
    ).bind(weekStart, day_of_week, meal_type, userId).run();

    await env.DB.prepare(
      "INSERT INTO weekly_menu (user_id, device_id, day_of_week, meal_type, recipe_name, recipe_data, week_start) VALUES (?, '', ?, ?, ?, ?, ?)"
    ).bind(userId, day_of_week, meal_type, recipe_name, recipe_data ? JSON.stringify(recipe_data) : null, weekStart).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/menu POST");
  }
}

/** DELETE /api/menu */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const numId = Number(id);
      if (isNaN(numId) || numId < 1) {
        throw validationError("id 参数必须是正整数");
      }

      await env.DB.prepare(
        `DELETE FROM weekly_menu WHERE id = ? AND user_id = ?`
      ).bind(numId, userId).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/menu DELETE");
  }
}
