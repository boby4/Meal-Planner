import { NextRequest, NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/deepseek";
import { handleAPIError, validationError } from "@/lib/error-handler";

/** POST /api/chat - DeepSeek 代理 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, temperature, maxTokens } = body;

    // 验证输入
    if (!Array.isArray(messages) || messages.length === 0) {
      throw validationError("messages 不能为空");
    }

    // 验证消息格式
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw validationError("消息格式错误：需要 role 和 content");
      }
      if (!["system", "user", "assistant"].includes(msg.role)) {
        throw validationError("消息角色错误：必须是 system、user 或 assistant");
      }
    }

    const result = await callDeepSeek({
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 2048,
    });

    return NextResponse.json({ content: result });
  } catch (error) {
    return handleAPIError(error, "/api/chat");
  }
}
