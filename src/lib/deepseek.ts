import type { ChatMessage } from "./types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

interface DeepSeekOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

/** 调用 DeepSeek API（仅服务端使用） */
export async function callDeepSeek({
  messages,
  temperature = 0.7,
  maxTokens = 2048,
}: DeepSeekOptions): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 未返回有效内容");
  }

  return content;
}

/** 解析 DeepSeek 返回的 JSON */
export function parseDeepSeekJSON<T>(raw: string): T {
  // 尝试直接解析
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 尝试从 markdown code block 中提取
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      return JSON.parse(match[1].trim()) as T;
    }
    throw new Error("无法解析 DeepSeek 返回的 JSON");
  }
}
