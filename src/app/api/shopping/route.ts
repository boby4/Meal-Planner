import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireAuth, AuthRequiredError } from "@/lib/auth";
import { handleAPIError, validationError, unauthorizedError } from "@/lib/error-handler";

/** GET /api/shopping */
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

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
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/shopping GET");
  }
}

/** POST /api/shopping */
export async function POST(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { item_name, amount, related_recipe } = await request.json();

    if (!item_name) {
      throw validationError("缺少 item_name");
    }

    if (typeof item_name !== "string" || item_name.length > 200) {
      throw validationError("item_name 格式错误");
    }

    if (amount && (typeof amount !== "string" || amount.length > 100)) {
      throw validationError("amount 格式错误");
    }

    await env.DB.prepare(
      "INSERT INTO shopping_list (user_id, device_id, item_name, amount, related_recipe) VALUES (?, '', ?, ?, ?)"
    ).bind(userId, item_name, amount || "", related_recipe || "").run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/shopping POST");
  }
}

/** PATCH /api/shopping */
export async function PATCH(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { id, checked } = await request.json();

    if (!id) {
      throw validationError("缺少 id");
    }

    const numId = Number(id);
    if (isNaN(numId) || numId < 1) {
      throw validationError("id 必须是正整数");
    }

    await env.DB.prepare(
      `UPDATE shopping_list SET checked = ? WHERE id = ? AND user_id = ?`
    ).bind(checked ? 1 : 0, numId, userId).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/shopping PATCH");
  }
}

/** DELETE /api/shopping */
export async function DELETE(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearChecked = searchParams.get("clear");

    if (id) {
      const numId = Number(id);
      if (isNaN(numId) || numId < 1) {
        throw validationError("id 必须是正整数");
      }

      await env.DB.prepare(
        `DELETE FROM shopping_list WHERE id = ? AND user_id = ?`
      ).bind(numId, userId).run();
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
      throw unauthorizedError();
    }
    return handleAPIError(error, "/api/shopping DELETE");
  }
}
