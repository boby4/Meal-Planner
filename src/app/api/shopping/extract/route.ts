import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getAuthFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/error-handler";
import { callDeepSeek } from "@/lib/deepseek";

// POST /api/shopping/extract - 从菜谱提取食材
export async function POST(request: Request) {
  try {
    const env = await getEnv();
    if (!env?.DB) {
      return NextResponse.json({ error: "数据库不可用" }, { status: 503 });
    }

    const { userId, deviceId } = await getAuthFromRequest(request);
    if (!userId && !deviceId) {
      return NextResponse.json({ error: "需要登录或设备ID" }, { status: 401 });
    }

    const body = await request.json();
    const { recipeNames } = body as { recipeNames: string[] };

    if (!recipeNames?.length) {
      return NextResponse.json({ error: "请提供菜谱名称" }, { status: 400 });
    }

    const prompt = `请根据以下菜谱提取需要购买的食材，去重合并后返回。

菜谱：${recipeNames.join("、")}

返回格式：
{
  "ingredients": [
    { "name": "食材名", "category": "分类", "amount": "用量" }
  ]
}

分类只能是：蔬菜、水果、肉类、海鲜、调料、主食、其他
只返回 JSON，不要其他文字。`;

    const result = await callDeepSeek({
      messages: [
        { role: "system", content: "你是食材提取助手，只返回 JSON。" },
        { role: "user", content: prompt },
      ],
    });

    try {
      const parsed = JSON.parse(result);
      return NextResponse.json({ ingredients: parsed.ingredients || [] });
    } catch {
      return NextResponse.json({ error: "解析失败" }, { status: 500 });
    }
  } catch (error) {
    return handleAPIError(error);
  }
}
