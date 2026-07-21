import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireAuth, AuthRequiredError } from "@/lib/auth";
import { handleAPIError, validationError, unauthorizedError } from "@/lib/error-handler";

/** GET /api/history */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Number(limitParam), 200) : 50;

    if (limitParam && (isNaN(Number(limitParam)) || Number(limitParam) < 1)) {
      throw validationError("limit 参数必须是正整数");
    }

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
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/history GET");
  }
}

/** POST /api/history */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { recipe_name, recipe_data, source } = await request.json();

    if (!recipe_name) {
      throw validationError("缺少 recipe_name");
    }

    if (typeof recipe_name !== "string" || recipe_name.length > 200) {
      throw validationError("recipe_name 格式错误");
    }

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
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/history POST");
  }
}

/** DELETE /api/history */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);

    await env.DB.prepare(`DELETE FROM history WHERE user_id = ?`).bind(userId).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/history DELETE");
  }
}
