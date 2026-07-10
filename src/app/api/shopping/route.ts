import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";

function userFilter(userId: number | null, deviceId: string) {
  if (userId) return { clause: "user_id = ?", binds: [userId as string | number] };
  if (deviceId) return { clause: "user_id IS NULL AND device_id = ?", binds: [deviceId] };
  return { clause: "1 = 0", binds: [] as (string | number)[] };
}

/** GET /api/shopping */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);

    const result = await env.DB.prepare(
      `SELECT id, item_name, amount, checked, related_recipe, created_at FROM shopping_list WHERE ${clause} ORDER BY checked ASC, created_at DESC`
    ).bind(...binds).all();

    const items = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      item_name: row.item_name,
      amount: row.amount,
      checked: !!row.checked,
      related_recipe: row.related_recipe,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/shopping 错误:", error);
    return NextResponse.json({ error: "获取清单失败" }, { status: 500 });
  }
}

/** POST /api/shopping */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { item_name, amount, related_recipe } = await request.json();
    if (!item_name) return NextResponse.json({ error: "缺少 item_name" }, { status: 400 });

    await env.DB.prepare(
      "INSERT INTO shopping_list (user_id, device_id, item_name, amount, related_recipe) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, userId ? "" : deviceId, item_name, amount || "", related_recipe || "").run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/shopping 错误:", error);
    return NextResponse.json({ error: "添加失败" }, { status: 500 });
  }
}

/** PATCH /api/shopping */
export async function PATCH(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);
    const { id, checked } = await request.json();

    await env.DB.prepare(
      `UPDATE shopping_list SET checked = ? WHERE id = ? AND ${clause}`
    ).bind(checked ? 1 : 0, id, ...binds).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/shopping 错误:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/** DELETE /api/shopping */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) return NextResponse.json({ error: "数据库不可用" }, { status: 503 });

    const { userId, deviceId } = await getAuthFromRequest(request);
    const { clause, binds } = userFilter(userId, deviceId);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearChecked = searchParams.get("clear");

    if (id) {
      await env.DB.prepare(
        `DELETE FROM shopping_list WHERE id = ? AND ${clause}`
      ).bind(Number(id), ...binds).run();
    } else if (clearChecked === "true") {
      await env.DB.prepare(
        `DELETE FROM shopping_list WHERE checked = 1 AND ${clause}`
      ).bind(...binds).run();
    } else {
      await env.DB.prepare(`DELETE FROM shopping_list WHERE ${clause}`).bind(...binds).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shopping 错误:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
