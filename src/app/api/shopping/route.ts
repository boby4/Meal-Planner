import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireAuth, AuthRequiredError } from "@/lib/auth";

/** GET /api/shopping */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);

    const result = await env.DB.prepare(
      `SELECT id, item_name, amount, checked, related_recipe, created_at FROM shopping_list WHERE user_id = ? ORDER BY checked ASC, created_at DESC`
    ).bind(userId).all();

    const items = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      item_name: row.item_name,
      amount: row.amount,
      checked: !!row.checked,
      related_recipe: row.related_recipe,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("GET /api/shopping 错误:", error);
    return NextResponse.json({ error: "获取清单失败" }, { status: 500 });
  }
}

/** POST /api/shopping */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);
    const { item_name, amount, related_recipe } = await request.json();
    if (!item_name) return NextResponse.json({ error: "缺少 item_name" }, { status: 400 });

    await env.DB.prepare(
      "INSERT INTO shopping_list (user_id, device_id, item_name, amount, related_recipe) VALUES (?, '', ?, ?, ?)"
    ).bind(userId, item_name, amount || "", related_recipe || "").run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("POST /api/shopping 错误:", error);
    return NextResponse.json({ error: "添加失败" }, { status: 500 });
  }
}

/** PATCH /api/shopping */
export async function PATCH(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);
    const { id, checked } = await request.json();

    await env.DB.prepare(
      `UPDATE shopping_list SET checked = ? WHERE id = ? AND user_id = ?`
    ).bind(checked ? 1 : 0, id, userId).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("PATCH /api/shopping 错误:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/** DELETE /api/shopping */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearChecked = searchParams.get("clear");

    if (id) {
      await env.DB.prepare(
        `DELETE FROM shopping_list WHERE id = ? AND user_id = ?`
      ).bind(Number(id), userId).run();
    } else if (clearChecked === "true") {
      await env.DB.prepare(
        `DELETE FROM shopping_list WHERE checked = 1 AND user_id = ?`
      ).bind(userId).run();
    } else {
      await env.DB.prepare(`DELETE FROM shopping_list WHERE user_id = ?`).bind(userId).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    console.error("DELETE /api/shopping 错误:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
