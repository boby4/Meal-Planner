import { NextRequest, NextResponse } from "next/server";
import { findRecipeByName, toRecipeDetail, getRandomRecipe, getRandomRecipes } from "@/lib/recipe";
import { callDeepSeek, parseDeepSeekJSON } from "@/lib/deepseek";
import { buildRecipeDetailPrompt } from "@/lib/prompts";
import { handleAPIError, validationError } from "@/lib/error-handler";
import type { RecipeDetail } from "@/lib/types";

/** GET /api/recipe?name=xxx - 查询菜谱详情 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      throw validationError("缺少 name 参数");
    }

    const decodedName = decodeURIComponent(name);
    if (decodedName.length > 100) {
      throw validationError("菜谱名称过长");
    }

    // 优先从缓存数据查找
    const localRecipe = await findRecipeByName(decodedName);

    if (localRecipe) {
      const detail = toRecipeDetail(localRecipe);
      return NextResponse.json({ recipe: detail, source: "local" });
    }

    // 本地找不到，调用 DeepSeek 生成（带超时保护）
    const messages = buildRecipeDetailPrompt(decodedName);

    // 设置整体超时（25秒）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("请求超时")), 25000);
    });

    const aiPromise = (async () => {
      const raw = await callDeepSeek({ messages, temperature: 0.7, maxTokens: 2048 });
      return parseDeepSeekJSON<RecipeDetail>(raw);
    })();

    const generated = await Promise.race([aiPromise, timeoutPromise]);

    return NextResponse.json({ recipe: generated, source: "ai" });
  } catch (error) {
    return handleAPIError(error, "/api/recipe GET");
  }
}

/** POST /api/recipe - 随机获取菜谱 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 1, excludeNames = [] } = body;

    // 验证参数
    if (typeof count !== "number" || count < 1 || count > 10) {
      throw validationError("count 必须是 1-10 之间的数字");
    }

    if (!Array.isArray(excludeNames)) {
      throw validationError("excludeNames 必须是数组");
    }

    if (excludeNames.length > 100) {
      throw validationError("excludeNames 数组过长");
    }

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
    return handleAPIError(error, "/api/recipe POST");
  }
}
