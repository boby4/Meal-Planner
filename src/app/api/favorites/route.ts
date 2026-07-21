import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireAuth, AuthRequiredError } from "@/lib/auth";
import { handleAPIError, validationError, unauthorizedError, notFoundError } from "@/lib/error-handler";

/** GET /api/favorites */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);

    const result = await env.DB.prepare(
      `SELECT id, recipe_name, recipe_data, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    ).bind(userId).all();

    const favorites = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      recipe_name: row.recipe_name,
      recipe_data: row.recipe_data ? JSON.parse(row.recipe_data as string) : null,
      created_at: row.created_at,
    }));

    return NextResponse.json({ favorites });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/favorites GET");
  }
}

/** POST /api/favorites */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { recipe_name, recipe_data } = await request.json();

    if (!recipe_name) {
      throw validationError("缺少 recipe_name");
    }

    if (typeof recipe_name !== "string" || recipe_name.length > 200) {
      throw validationError("recipe_name 格式错误");
    }

    await env.DB.prepare(
      "INSERT OR REPLACE INTO favorites (user_id, device_id, recipe_name, recipe_data) VALUES (?, '', ?, ?)"
    ).bind(userId, recipe_name, recipe_data ? JSON.stringify(recipe_data) : null).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/favorites POST");
  }
}

/** DELETE /api/favorites */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      throw validationError("缺少 name 参数");
    }

    const result = await env.DB.prepare(
      `DELETE FROM favorites WHERE user_id = ? AND recipe_name = ?`
    ).bind(userId, name).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/favorites DELETE");
  }
}
