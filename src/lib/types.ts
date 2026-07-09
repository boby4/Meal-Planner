/** 菜谱数据源中的原始数据（预处理后） */
export interface RecipeSource {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
}

/** 食材 */
export interface RecipeIngredient {
  name: string;
  amount?: string;
}

/** 菜谱详情（完整） */
export interface RecipeDetail {
  name: string;
  description: string;
  time: string;
  difficulty: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  tips: string[];
  imageUrl?: string;
}

/** AI 推荐结果中的单条菜谱 */
export interface RecommendedRecipe {
  name: string;
  reason: string;
  time: string;
  difficulty: string;
}

/** AI 推荐响应 */
export interface AIRecommendResponse {
  recipes: RecommendedRecipe[];
}

/** 筛选条件 */
export interface FilterOptions {
  people: number;
  taste: string[];
  cookTime: string;
  budget: string;
  ingredients: string[];
  isDiet: boolean;
}

/** 推荐模式 */
export type RecommendMode = "random" | "ai" | "ingredient";

/** DeepSeek 消息 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
