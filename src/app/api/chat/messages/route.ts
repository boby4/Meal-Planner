import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";

// HTTP降级：加载聊天消息
export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ messages: [] });
    }

    const db = env.DB;
    
    // 从D1加载最近50条消息
    const { results } = await db
      .prepare(
        `SELECT cm.id, cm.user_id as userId, u.email, u.username, cm.content, cm.message_type as messageType, cm.created_at
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         ORDER BY cm.created_at DESC
         LIMIT 50`
      )
      .all();

    // 转换时间戳并反转顺序
    const messages = (results || [])
      .map((msg: { id: string; userId: number; email: string; username: string; content: string; messageType: string; created_at: string }) => ({
        ...msg,
        timestamp: new Date(msg.created_at + 'Z').getTime()
      }))
      .reverse();

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to load chat messages:", error);
    return NextResponse.json({ messages: [] });
  }
}
