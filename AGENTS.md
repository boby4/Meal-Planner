<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI 今天吃什么 - Meal Planner

## 项目概述

基于 AI 的智能菜谱推荐 H5 应用，移动端优先。用户可通过随机推荐、AI 条件推荐、冰箱食材推荐、搜索菜谱四种方式获取菜谱。

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript (Strict) |
| 样式 | TailwindCSS 4 + shadcn/ui |
| 动画 | Framer Motion |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query (staleTime: 5min) |
| 表单 | React Hook Form + Zod |
| AI | DeepSeek API (deepseek-chat 模型) |
| 部署 | Cloudflare Workers (opennextjs-cloudflare) |
| 存储 | Cloudflare D1 (SQLite) / KV / R2 |
| 包管理 | pnpm |

## 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 是 |

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 本地开发 (localhost:3000)
pnpm build            # Next.js 构建
pnpm lint             # ESLint 检查
pnpm cf:build         # Cloudflare 构建
pnpm cf:dev           # Cloudflare 本地预览
pnpm cf:deploy        # 部署到 Cloudflare
pnpm cf:preview       # Cloudflare 预览部署
```

## 项目结构

```
src/
├── app/
│   ├── page.tsx                # 首页（随机推荐/AI推荐/冰箱食材/搜索 四大入口）
│   ├── layout.tsx              # 根布局（Geist 字体、Providers）
│   ├── providers.tsx           # QueryClient + AuthProvider
│   ├── globals.css             # 全局样式
│   ├── login/page.tsx          # 登录注册页
│   ├── my/page.tsx             # 个人中心（收藏/历史/菜单/清单）
│   ├── recommend/page.tsx      # 推荐结果页
│   ├── recipe/[name]/page.tsx  # 菜谱详情页（动态路由）
│   └── api/
│       ├── auth/route.ts       # 认证 API（登录/注册/退出/获取用户）
│       ├── chat/route.ts       # DeepSeek API 代理
│       ├── favorites/route.ts  # 收藏 CRUD（需登录）
│       ├── history/route.ts    # 浏览历史 CRUD（需登录）
│       ├── menu/route.ts       # 一周菜单 CRUD（需登录）
│       ├── recipe/route.ts     # 菜谱查询 + 随机获取
│       ├── search/route.ts     # 菜谱搜索
│       └── shopping/route.ts   # 买菜清单 CRUD（需登录）
├── components/
│   ├── ui/                     # shadcn/ui 基础组件（badge/button/card/input/separator/skeleton/textarea）
│   ├── ChangeRecipeButton.tsx  # 换一道按钮
│   ├── EmptyState.tsx          # 空状态
│   ├── ErrorState.tsx          # 错误状态
│   ├── FilterPanel.tsx         # AI 推荐条件面板
│   ├── IngredientInput.tsx     # 食材输入组件
│   ├── LoadingSkeleton.tsx     # 骨架屏
│   ├── RecipeDetail.tsx        # 菜谱详情组件
│   └── RecommendationCard.tsx  # 推荐结果卡片
├── hooks/
│   ├── useAuth.tsx             # 认证 Hook + AuthProvider（Context）
│   └── useRecommendation.ts    # 推荐逻辑 Hook（随机/AI/食材/换一道）
├── lib/
│   ├── types.ts                # TypeScript 类型定义
│   ├── recipe.ts               # 菜谱数据（R2 范围读取 + 内存缓存 + 搜索索引）
│   ├── deepseek.ts             # DeepSeek API 封装
│   ├── prompts.ts              # AI Prompt 模板
│   ├── auth.ts                 # 认证工具（PBKDF2/Session/Token）
│   ├── cloudflare.ts           # Cloudflare Bindings 访问 + 本地 sql.js Mock
│   └── utils.ts                # 通用工具函数
└── stores/
    └── useMealStore.ts         # Zustand 全局状态
```

## 数据架构

### Cloudflare 资源

| 资源 | Binding | 用途 |
|------|---------|------|
| D1 Database | `DB` | 用户/Session/收藏/历史/菜单/清单 |
| KV Namespace | `RECIPE_CACHE` | 菜谱缓存 |
| R2 Bucket | `RECIPE_DATA` | 菜谱原始数据（21个 chunk 文件 + 索引） |

### 本地开发

- D1 通过 `sql.js` 内存数据库 Mock（`src/lib/cloudflare.ts`）
- KV 通过内存 Map Mock
- R2 返回空（菜谱功能需连接 Cloudflare 才完整可用）

### 菜谱数据流

```
用户操作 → Zustand 状态更新
         → TanStack Query 请求
         → /api/recipe 或 /api/chat（服务端）
         → R2 范围读取 / DeepSeek API
         → 内存缓存 10 分钟
         → 返回结果
```

- **菜谱查询**：从 R2 随机分片读取，内存缓存 10 分钟
- **菜谱搜索**：通过 R2 上的 `index.json` 索引文件分段读取匹配
- **菜谱详情**：优先匹配缓存数据，找不到时由 DeepSeek 生成
- **AI 推荐**：DeepSeek 根据用户条件返回结构化 JSON

## 认证系统

- 基于 Session Token（30天有效期）
- 密码哈希：PBKDF2 + SHA-256（100000 迭代）
- 使用 Web Crypto API（兼容 Cloudflare Workers + Node.js）
- 前端通过 `useAuth` Hook 管理状态，`authFetch` 自动附加认证头
- 支持设备 ID（deviceId）：未登录用户数据关联设备，登录后合并

## 数据库表结构（D1）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户 | email, password_hash, salt |
| `sessions` | 会话 | token, user_id, expires_at |
| `favorites` | 收藏 | user_id, recipe_name, recipe_data |
| `history` | 浏览历史 | user_id, recipe_name, viewed_at |
| `weekly_menu` | 一周菜单 | user_id, day_of_week, meal_type, week_start |
| `shopping_list` | 买菜清单 | user_id, item_name, checked |

## API 路由

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET/POST/DELETE | `/api/auth` | 登录/注册/退出/获取用户 | 否（POST）/ 是（GET/DELETE） |
| GET/POST | `/api/recipe` | 菜谱查询/随机获取 | 否 |
| POST | `/api/chat` | DeepSeek API 代理 | 否 |
| GET | `/api/search?q=` | 菜谱搜索 | 否 |
| GET/POST/DELETE | `/api/favorites` | 收藏管理 | 是 |
| GET/POST/DELETE | `/api/history` | 浏览历史 | 是 |
| GET/POST/DELETE | `/api/menu` | 一周菜单 | 是 |
| GET/POST/PATCH/DELETE | `/api/shopping` | 买菜清单 | 是 |

## 组件设计

- **shadcn/ui 组件**：`src/components/ui/` 下的基础组件，通过 `components.json` 配置
- **业务组件**：直接放在 `src/components/` 下
- **动画**：使用 Framer Motion 的 `motion` 和 `AnimatePresence`
- **样式**：TailwindCSS 4，主色调 `#FF6B35`（橙色），背景 `#FFF8F2`（暖白）

## 状态管理

- **Zustand Store** (`useMealStore`)：管理推荐模式、推荐列表、筛选条件、历史记录、加载状态
- **React Query**：管理服务端数据请求，staleTime 5 分钟
- **Auth Context** (`useAuth`)：管理用户认证状态、deviceId、authFetch

## 关键约定

- 所有页面组件使用 `"use client"` 指令（客户端渲染）
- API 路由使用 Next.js App Router 的 `route.ts` 约定
- 使用 `@/` 路径别名导入模块
- 使用 `cn()` 工具函数合并 TailwindCSS 类名
- 需要认证的 API 通过 `requireAuth()` 中间件函数验证
- 错误处理：API 路由统一 try/catch，返回 `{ error: message }` 格式
