import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireAuth, AuthRequiredError } from "@/lib/auth";

/** GET /api/history */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const result = await env.DB.prepare(
      `SELECT id, recipe_name, recipe_data, source, viewed_at FROM history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT ?`
    ).bind(userId, limit).all();

    const history = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      recipe_name: row.recipe_name,
      recipe_data: row.recipe_data ? JSON.parse(row.recipe_data as string) : null,
      source: row.source,
      viewed_at: row.viewed_at,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("GET /api/history 错误:", error);
    return NextResponse.json({ error: "获取历史失败" }, { status: 500 });
  }
}

/** POST /api/history */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);
    const { recipe_name, recipe_data, source } = await request.json();
    if (!recipe_name) return NextResponse.json({ error: "缺少 recipe_name" }, { status: 400 });

    await env.DB.prepare(
      "INSERT INTO history (user_id, device_id, recipe_name, recipe_data, source) VALUES (?, '', ?, ?, ?)"
    ).bind(userId, recipe_name, recipe_data ? JSON.stringify(recipe_data) : null, source || "").run();

    // 保留最近 500 条
    await env.DB.prepare(
      "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY viewed_at DESC LIMIT 500)"
    ).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("POST /api/history 错误:", error);
    return NextResponse.json({ error: "记录历史失败" }, { status: 500 });
  }
}

/** DELETE /api/history */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);

    await env.DB.prepare(`DELETE FROM history WHERE user_id = ?`).bind(userId).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("DELETE /api/history 错误:", error);
    return NextResponse.json({ error: "清空历史失败" }, { status: 500 });
  }
}
