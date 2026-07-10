import { NextRequest, NextResponse } from "next/server";
import { findRecipeByName, toRecipeDetail, getRandomRecipe, getRandomRecipes } from "@/lib/recipe";
import { callDeepSeek, parseDeepSeekJSON } from "@/lib/deepseek";
import { buildRecipeDetailPrompt } from "@/lib/prompts";
import type { RecipeDetail } from "@/lib/types";

export const runtime = "edge";

/** GET /api/recipe?name=xxx - 查询菜谱详情 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "缺少 name 参数" }, { status: 400 });
    }

    // 优先从缓存数据查找
    const localRecipe = await findRecipeByName(decodeURIComponent(name));

    if (localRecipe) {
      const detail = toRecipeDetail(localRecipe);
      return NextResponse.json({ recipe: detail, source: "local" });
    }

    // 本地找不到，调用 DeepSeek 生成
    const messages = buildRecipeDetailPrompt(name);
    const raw = await callDeepSeek({ messages, temperature: 0.7, maxTokens: 2048 });
    const generated = parseDeepSeekJSON<RecipeDetail>(raw);

    return NextResponse.json({ recipe: generated, source: "ai" });
  } catch (error) {
    console.error("API /api/recipe 错误:", error);
    const message = error instanceof Error ? error.message : "服务内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/recipe - 随机获取菜谱 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 1, excludeNames = [] } = body;

    if (count === 1) {
      const recipe = await getRandomRecipe(excludeNames);
      if (!recipe) {
        return NextResponse.json({ error: "没有更多菜谱了" }, { status: 404 });
      }
      return NextResponse.json({
        recipes: [{ name: recipe.name, reason: "随机推荐", time: "约30分钟", difficulty: "中等" }],
      });
    }

    const recipes = await getRandomRecipes(count, excludeNames);
    return NextResponse.json({
      recipes: recipes.map((r) => ({
        name: r.name,
        reason: "随机推荐",
        time: "约30分钟",
        difficulty: "中等",
      })),
    });
  } catch (error) {
    console.error("API /api/recipe POST 错误:", error);
    const message = error instanceof Error ? error.message : "服务内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
