import { create } from "zustand";
import type {
  RecommendedRecipe,
  FilterOptions,
  RecommendMode,
  RecipeDetail,
} from "@/lib/types";

interface MealState {
  /** 推荐模式 */
  mode: RecommendMode | null;
  /** 当前推荐列表 */
  recommendations: RecommendedRecipe[];
  /** 当前查看的菜谱 */
  currentRecipe: RecipeDetail | null;
  /** 筛选条件 */
  filters: FilterOptions;
  /** 推荐历史（用于"换一道"去重） */
  history: string[];
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

interface MealActions {
  setMode: (mode: RecommendMode | null) => void;
  setRecommendations: (recipes: RecommendedRecipe[]) => void;
  setCurrentRecipe: (recipe: RecipeDetail | null) => void;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  addToHistory: (names: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: FilterOptions = {
  people: 2,
  taste: [],
  cookTime: "",
  budget: "",
  ingredients: [],
  isDiet: false,
};

const initialState: MealState = {
  mode: null,
  recommendations: [],
  currentRecipe: null,
  filters: DEFAULT_FILTERS,
  history: [],
  isLoading: false,
  error: null,
};

export const useMealStore = create<MealState & MealActions>((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),

  setRecommendations: (recipes) =>
    set((state) => ({
      recommendations: recipes,
      history: [...state.history, ...recipes.map((r) => r.name)],
    })),

  setCurrentRecipe: (recipe) => set({ currentRecipe: recipe }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  addToHistory: (names) =>
    set((state) => ({
      history: [...state.history, ...names],
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
