# AI 今天吃什么

> 今天吃什么，不再纠结。

基于 AI 的智能菜谱推荐 H5 应用。支持随机推荐、AI 条件推荐、冰箱食材推荐三种方式，让每天吃饭不再纠结。

## 功能特性

- **随机推荐** — 一键随机推荐菜谱，治好选择困难症
- **AI 推荐** — 根据人数、口味、烹饪时间、预算、减脂需求智能推荐
- **冰箱食材** — 输入现有食材，推荐可以做的菜
- **菜谱详情** — 完整的食材清单、制作步骤、小贴士
- **换一道** — 不满意？换一批推荐，自动去重
- **移动端优先** — 针对手机浏览器优化，支持后续迁移微信小程序

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript (Strict) |
| 样式 | TailwindCSS 4 + shadcn/ui |
| 动画 | Framer Motion |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query |
| 表单 | React Hook Form + Zod |
| AI | DeepSeek API |
| 数据源 | [HuggingFace XiaChuFang Recipe Corpus](https://huggingface.co/datasets/xzm1999/XiaChuFang_Recipe_Corpus) |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm

### 安装

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 DeepSeek API Key
# DEEPSEEK_API_KEY=sk-xxxx
```

### 开发

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建

```bash
pnpm build
pnpm start
```

### 代码检查

```bash
pnpm lint
```

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页（三大入口）
│   ├── layout.tsx            # 根布局
│   ├── providers.tsx         # QueryClient Provider
│   ├── recommend/
│   │   └── page.tsx          # 推荐结果页
│   ├── recipe/
│   │   └── [name]/
│   │       └── page.tsx      # 菜谱详情页
│   └── api/
│       ├── chat/
│       │   └── route.ts      # DeepSeek API 代理
│       └── recipe/
│           └── route.ts      # 菜谱查询 API
├── components/
│   ├── ui/                   # shadcn/ui 基础组件
│   ├── FilterPanel.tsx       # AI 推荐条件面板
│   ├── IngredientInput.tsx   # 食材输入组件
│   ├── RecommendationCard.tsx# 推荐结果卡片
│   ├── RecipeDetail.tsx      # 菜谱详情组件
│   ├── ChangeRecipeButton.tsx# 换一道按钮
│   ├── LoadingSkeleton.tsx   # 骨架屏
│   ├── EmptyState.tsx        # 空状态
│   └── ErrorState.tsx        # 错误状态
├── hooks/
│   └── useRecommendation.ts  # 推荐逻辑 Hook
├── stores/
│   └── useMealStore.ts       # Zustand 全局状态
└── lib/
    ├── types.ts              # TypeScript 类型定义
    ├── recipe.ts             # 菜谱数据获取（HuggingFace API）
    ├── deepseek.ts           # DeepSeek API 封装
    └── prompts.ts            # AI Prompt 模板
```

## 数据架构

菜谱数据通过 HuggingFace Datasets Server API 实时获取，无需本地存储：

```
用户操作 → Zustand 状态更新
         → TanStack Query 请求
         → /api/recipe 或 /api/chat（服务端）
         → HuggingFace API / DeepSeek API
         → 内存缓存 5 分钟
         → 返回结果
```

- **菜谱查询**：从 HuggingFace 随机采样 1000 条菜谱（10 批 × 100 条），内存缓存 5 分钟
- **菜谱详情**：优先匹配缓存数据，找不到时由 DeepSeek 自动生成
- **AI 推荐**：DeepSeek 根据用户条件返回结构化 JSON

## 部署到 Vercel

1. Fork 或推送项目到 GitHub
2. 在 [Vercel](https://vercel.com/new) 导入项目
3. 添加环境变量 `DEEPSEEK_API_KEY`
4. 点击 Deploy

## 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | ✅ |

## 预留功能（仅架构）

以下功能已预留扩展接口，尚未实现：

- 收藏
- 浏览历史
- 一周菜单
- 买菜清单
- AI 识图
- 微信小程序

## License

MIT
