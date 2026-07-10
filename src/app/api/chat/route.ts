import { NextRequest, NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/deepseek";

export const runtime = "edge";

/** POST /api/chat - DeepSeek 代理 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, temperature, maxTokens } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 不能为空" },
        { status: 400 }
      );
    }

    const result = await callDeepSeek({
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 2048,
    });

    return NextResponse.json({ content: result });
  } catch (error) {
    console.error("API /api/chat 错误:", error);
    const message =
      error instanceof Error ? error.message : "服务内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
