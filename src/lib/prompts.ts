import type { FilterOptions, ChatMessage } from "./types";

/** 系统 Prompt：强制 JSON 输出 */
const SYSTEM_JSON = `你是一个专业的中国厨师和美食推荐官。
你必须始终返回严格的 JSON 格式，不要返回任何 Markdown、注释或额外文字。
只返回 JSON 对象。`;

/** AI 条件推荐 Prompt */
export function buildAIRecommendPrompt(
  filters: FilterOptions,
  excludeNames: string[]
): ChatMessage[] {
  const parts: string[] = [];

  parts.push(`请根据以下条件推荐3道菜谱：`);
  parts.push(`- 用餐人数：${filters.people}人`);

  if (filters.taste.length > 0) {
    parts.push(`- 口味偏好：${filters.taste.join("、")}`);
  }
  if (filters.cookTime) {
    parts.push(`- 烹饪时间：${filters.cookTime}`);
  }
  if (filters.budget) {
    parts.push(`- 预算：${filters.budget}`);
  }
  if (filters.ingredients.length > 0) {
    parts.push(`- 已有食材：${filters.ingredients.join("、")}`);
  }
  if (filters.isDiet) {
    parts.push(`- 减脂餐：是，请推荐低脂低卡的健康菜品`);
  }

  if (excludeNames.length > 0) {
    parts.push(`\n不要推荐以下菜品：\n${excludeNames.join("\n")}`);
  }

  parts.push(`\n返回格式：
{
  "recipes": [
    {
      "name": "菜名",
      "reason": "推荐理由（简短一句话）",
      "time": "预估制作时间",
      "difficulty": "难度（简单/中等/较难）"
    }
  ]
}`);

  return [
    { role: "system", content: SYSTEM_JSON },
    { role: "user", content: parts.join("\n") },
  ];
}

/** 冰箱食材推荐 Prompt */
export function buildIngredientPrompt(
  ingredients: string[],
  excludeNames: string[]
): ChatMessage[] {
  let prompt = `我家里有以下食材：\n${ingredients.join("\n")}\n\n请根据这些食材推荐3道可以制作的菜品。只能使用我提供的食材（允许额外使用常见调味料如盐、糖、酱油、醋、油等）。`;

  if (excludeNames.length > 0) {
    prompt += `\n\n不要推荐以下菜品：\n${excludeNames.join("\n")}`;
  }

  prompt += `\n\n返回格式：
{
  "recipes": [
    {
      "name": "菜名",
      "reason": "推荐理由（说明用到了哪些食材）",
      "time": "预估制作时间",
      "difficulty": "难度（简单/中等/较难）"
    }
  ]
}`;

  return [
    { role: "system", content: SYSTEM_JSON },
    { role: "user", content: prompt },
  ];
}

/** 生成菜谱详情 Prompt（当本地数据找不到时） */
export function buildRecipeDetailPrompt(name: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_JSON },
    {
      role: "user",
      content: `请为「${name}」生成一份完整的中文菜谱。

返回格式：
{
  "name": "${name}",
  "description": "菜品简介（2-3句话）",
  "time": "制作时间",
  "difficulty": "难度（简单/中等/较难）",
  "ingredients": [
    { "name": "食材名", "amount": "用量" }
  ],
  "steps": ["步骤1", "步骤2", "步骤3"],
  "tips": ["小贴士1", "小贴士2"]
}`,
    },
  ];
}
