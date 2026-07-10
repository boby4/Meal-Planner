import { NextRequest, NextResponse } from "next/server";
import { searchRecipes, toRecipeDetail } from "@/lib/recipe";

/** GET /api/search?q=菜名 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
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
    console.error("GET /api/search 错误:", error);
    return NextResponse.json({ error: "搜索失败" }, { status: 500 });
  }
}
