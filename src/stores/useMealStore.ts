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

/** 历史记录最大数量（避免 excludeNames 过长） */
const MAX_HISTORY_SIZE = 30;

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
    set((state) => {
      const newHistory = [...state.history, ...recipes.map((r) => r.name)];
      return {
        recommendations: recipes,
        history: newHistory.slice(-MAX_HISTORY_SIZE),
      };
    }),

  setCurrentRecipe: (recipe) => set({ currentRecipe: recipe }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  addToHistory: (names) =>
    set((state) => {
      const newHistory = [...state.history, ...names];
      return { history: newHistory.slice(-MAX_HISTORY_SIZE) };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
