import { NextRequest, NextResponse } from "next/server";
import { searchRecipes, toRecipeDetail } from "@/lib/recipe";
import { handleAPIError, validationError } from "@/lib/error-handler";

/** GET /api/search?q=菜名 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    // 空查询返回空结果
    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    // 验证查询长度
    if (query.length > 50) {
      throw validationError("搜索词过长，请缩短搜索词");
    }

    const recipes = await searchRecipes(query);
    const results = recipes.slice(0, 20).map((r) => ({
      name: r.name,
      description: r.description,
      ingredientCount: r.ingredients.length,
      stepCount: r.steps.length,
    }));

    return NextResponse.json({ results, total: recipes.length });
  } catch (error) {
    return handleAPIError(error, "/api/search");
  }
}
