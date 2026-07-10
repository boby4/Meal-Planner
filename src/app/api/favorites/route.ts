import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";

/** 构建用户过滤条件 */
function userFilter(userId: number | null, deviceId: string): { clause: string; binds: (string | number)[] } {
  if (userId) return { clause: "user_id = ?", binds: [userId] };
  if (deviceId) return { clause: "user_id IS NULL AND device_id = ?", binds: [deviceId] };
  return { clause: "1 = 0", binds: [] }; // 无身份则无数据
}

/** GET /api/favorites */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);

    const result = await env.DB.prepare(
      `SELECT id, recipe_name, recipe_data, created_at FROM favorites WHERE ${clause} ORDER BY created_at DESC LIMIT 100`
    ).bind(...binds).all();

    const favorites = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      recipe_name: row.recipe_name,
      recipe_data: row.recipe_data ? JSON.parse(row.recipe_data as string) : null,
      created_at: row.created_at,
    }));

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error("GET /api/favorites 错误:", error);
    return NextResponse.json({ error: "获取收藏失败" }, { status: 500 });
  }
}

/** POST /api/favorites */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { recipe_name, recipe_data } = await request.json();
    if (!recipe_name) return NextResponse.json({ error: "缺少 recipe_name" }, { status: 400 });

    await env.DB.prepare(
      "INSERT OR REPLACE INTO favorites (user_id, device_id, recipe_name, recipe_data) VALUES (?, ?, ?, ?)"
    ).bind(userId, userId ? "" : deviceId, recipe_name, recipe_data ? JSON.stringify(recipe_data) : null).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/favorites 错误:", error);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}

/** DELETE /api/favorites */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    if (!name) return NextResponse.json({ error: "缺少 name 参数" }, { status: 400 });

    await env.DB.prepare(
      `DELETE FROM favorites WHERE ${clause} AND recipe_name = ?`
    ).bind(...binds, name).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/favorites 错误:", error);
    return NextResponse.json({ error: "取消收藏失败" }, { status: 500 });
  }
}
