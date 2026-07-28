import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/error-handler";
import type { UserPreferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";

/**
 * GET /api/preferences
 * 获取用户偏好（登录用户从 user_id 查询，未登录从 device_id 查询）
 */
export async function GET(request: Request) {
  try {
    const { userId, deviceId } = await getAuthFromRequest(request);
    const env = await getEnv();

    let row: { preferences: string } | null = null;

    if (userId) {
      row = await env.DB.prepare(
        "SELECT preferences FROM user_preferences WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1"
      ).bind(userId).first() as { preferences: string } | null;
    } else if (deviceId) {
      row = await env.DB.prepare(
        "SELECT preferences FROM user_preferences WHERE device_id = ? AND user_id IS NULL ORDER BY updated_at DESC LIMIT 1"
      ).bind(deviceId).first() as { preferences: string } | null;
    }

    if (!row) {
      return NextResponse.json({ preferences: DEFAULT_PREFERENCES });
    }

    const prefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(row.preferences) };
    return NextResponse.json({ preferences: prefs });
  } catch (e: unknown) {
    return handleAPIError(e);
  }
}

/**
 * PUT /api/preferences
 * 更新用户偏好
 */
export async function PUT(request: Request) {
  try {
    const { userId, deviceId } = await getAuthFromRequest(request);
    const env = await getEnv();

    const body = (await request.json()) as Partial<UserPreferences>;
    const prefs: UserPreferences = { ...DEFAULT_PREFERENCES, ...body };

    // 查找现有记录
    let existing: { id: number } | null = null;
    if (userId) {
      existing = await env.DB.prepare(
        "SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1"
      ).bind(userId).first() as { id: number } | null;
    } else if (deviceId) {
      existing = await env.DB.prepare(
        "SELECT id FROM user_preferences WHERE device_id = ? AND user_id IS NULL LIMIT 1"
      ).bind(deviceId).first() as { id: number } | null;
    }

    const prefsJson = JSON.stringify(prefs);

    if (existing) {
      await env.DB.prepare(
        "UPDATE user_preferences SET preferences = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(prefsJson, existing.id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO user_preferences (user_id, device_id, preferences) VALUES (?, ?, ?)"
      ).bind(userId, deviceId || "", prefsJson).run();
    }

    return NextResponse.json({ preferences: prefs });
  } catch (e: unknown) {
    return handleAPIError(e);
  }
}
