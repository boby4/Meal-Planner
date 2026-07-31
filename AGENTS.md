<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI 今天吃什么 - Meal Planner

## 项目概述

基于 AI 的智能菜谱推荐 H5 应用，移动端优先。支持随机推荐、AI 条件推荐、冰箱食材推荐、搜索菜谱、饮食打卡、个性化偏好、智能买菜清单、社区聊天室、积分系统、摇摇乐等功能。

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
│   ├── page.tsx                  # 首页（时间问候、快速操作网格、菜系分类浏览、积分显示）
│   ├── layout.tsx                # 根布局（Geist 字体、Providers）
│   ├── providers.tsx             # QueryClient + AuthProvider + PreferencesProvider + ToastProvider
│   ├── globals.css               # 全局样式
│   ├── login/page.tsx            # 登录注册页（支持用户名）
│   ├── my/page.tsx               # 个人中心（收藏/打卡记录/买菜清单/修改用户名）
│   ├── checkin/page.tsx          # 饮食打卡页（日历+打卡模态框+统计）
│   ├── preferences/page.tsx      # 偏好设置页
│   ├── recommend/page.tsx        # 推荐结果页
│   ├── recipe/[name]/page.tsx    # 菜谱详情页（动态路由）
│   ├── chat/page.tsx             # 社区聊天室（WebSocket 实时聊天、积分扣减）
│   ├── lottery/page.tsx          # 摇摇乐（积分抽奖、中奖入库）
│   └── api/
│       ├── auth/route.ts         # 认证 API（登录/注册/退出/获取用户/修改用户名/积分赠送）
│       ├── chat/route.ts         # DeepSeek API 代理
│       ├── checkin/route.ts      # 打卡 CRUD（支持花费记录、签到送积分）
│       ├── favorites/route.ts    # 收藏 CRUD
│       ├── history/route.ts      # 浏览历史 CRUD
│       ├── menu/route.ts         # 一周菜单 CRUD
│       ├── points/route.ts       # 积分 API（查询/增减/记录）
│       ├── preferences/route.ts  # 用户偏好 CRUD
│       ├── recipe/route.ts       # 菜谱查询 + 随机获取
│       ├── search/route.ts       # 菜谱搜索（支持筛选）
│       ├── shopping/route.ts     # 买菜清单 CRUD（支持分类）
│       └── shopping/
│           └── extract/route.ts  # AI 食材智能提取
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── CalendarView.tsx          # 日历组件（月度视图、滑动切换、打卡状态）
│   ├── ChangeRecipeButton.tsx    # 换一道按钮
│   ├── CheckInModal.tsx          # 打卡模态框（三餐记录、花费、收藏快速添加、积分提示）
│   ├── CheckInStats.tsx          # 打卡统计（天数、连续、花费、分布、趋势）
│   ├── EmptyState.tsx            # 空状态
│   ├── ErrorState.tsx            # 错误状态
│   ├── FilterPanel.tsx           # AI 推荐条件面板
│   ├── IngredientInput.tsx       # 食材输入组件（最近14个食材）
│   ├── LoadingSkeleton.tsx       # 骨架屏
│   ├── PointsDisplay.tsx         # 积分展示组件（余额、记录、规则）
│   ├── PreferencesPanel.tsx      # 偏好设置面板（引导+编辑模式）
│   ├── RecipeDetail.tsx          # 菜谱详情组件
│   ├── RecommendationCard.tsx    # 推荐结果卡片
│   └── Toast.tsx                 # Toast 提示组件（全局）
├── hooks/
│   ├── useAuth.tsx               # 认证 Hook + AuthProvider（Context）
│   ├── usePreferences.tsx        # 偏好 Hook + PreferencesProvider（引导/跳过/加载）
│   └── useRecommendation.ts      # 推荐逻辑 Hook（随机/AI/食材/换一道、积分扣减）
├── lib/
│   ├── types.ts                  # TypeScript 类型定义（含 UserPreferences）
│   ├── recipe.ts                 # 菜谱数据（R2 范围读取 + 内存缓存 + 搜索索引）
│   ├── deepseek.ts               # DeepSeek API 封装
│   ├── prompts.ts                # AI Prompt 模板（含菜系/食材/偏好 prompt）
│   ├── auth.ts                   # 认证工具（PBKDF2/Session/Token/设备ID合并）
│   ├── cloudflare.ts             # Cloudflare Bindings + 本地 sql.js Mock（含所有表）
│   ├── chat-room.ts              # Durable Object 聊天室（WebSocket 管理）
│   ├── error-handler.ts          # 统一错误处理
│   └── utils.ts                  # 通用工具函数
├── stores/
│   └── useMealStore.ts           # Zustand 全局状态（含 filters/cuisine）
└── worker.ts                     # Cloudflare Worker 入口（导出 ChatRoom Durable Object）
```

## 核心功能

### 1. 个性化定制（Preferences）

- 用户首次进入可设置饮食偏好（目标/类型/过敏源/口味/烹饪时间/人数）
- 5 步引导卡片 + 可跳过，跳过后记住选择不再弹出
- 偏好数据存 D1 `user_preferences` 表（JSON 格式）
- 首页根据偏好显示个性化推荐提示

### 2. 首页改版（Home）

- 顶部时间问候语（早上好/中午好/下午好/晚上好）
- 顶部显示积分余额（点击查看详情）
- 2×2 快速操作网格（AI 帮选/冰箱食材/饮食打卡/搜索菜谱）
- 菜系分类浏览（8 个标签，点击调 AI 推荐对应菜系）
- 搜索增强：搜索历史（localStorage 最近 10 条）、热门搜索、快速标签
- 搜索筛选面板：烹饪时间范围、卡路里范围、菜系

### 3. 饮食打卡系统（Check-in）

- 交互式日历组件（月度视图、左右滑动切换月份）
- 日历格显示打卡状态（✅3餐全打卡 / ⚠️部分打卡）
- 打卡模态框：支持记录三餐（早/中/晚）、花费金额、备注
- 支持从收藏夹快速选择菜谱打卡
- 打卡送积分（每日+10，连续7天+50）
- 打卡统计：打卡天数、连续打卡、完成率、本月/今日花费、本周柱状图、用餐分布、月度趋势

### 4. 个人中心改版（Profile）

- 三个 Tab：收藏 / 打卡记录 / 买菜清单
- 收藏：网格布局展示，支持取消收藏
- 打卡记录：按日期分组展示本月打卡详情，显示花费金额
- 买菜清单：按分类展示（蔬菜/水果/肉类/海鲜/调料/主食/其他）、勾选购买状态、清空已买
- 智能提取：从收藏菜谱 AI 自动提取食材到买菜清单
- 偏好设置入口（⚙️）
- 修改用户名入口

### 5. 社区聊天室（Chat）

- 基于 Cloudflare Durable Objects + WebSocket 实现实时聊天
- 公共大厅：所有用户可见，未登录用户提示登录后可用
- 消息类型：文本、表情（48 个常用美食表情）
- 显示用户头像（邮箱首字母 + 随机颜色）和用户名
- 消息时间戳
- 在线用户列表显示（横向滚动）
- 消息存储：最近 100 条消息存 KV（7 天过期），定期归档到 D1
- 自动重连机制（断线 2 秒后重连，无感知）
- 消息长度限制（200 字符）
- 发送消息扣积分（-1 积分/条）

### 6. 积分系统（Points）

- 新用户注册赠送 100 积分
- 每日签到赠送 10 积分
- 连续签到 7 天额外赠送 50 积分
- 聊天发言扣 1 积分/条
- AI 推荐扣 10 积分/次
- 摇摇乐抽奖扣 5 积分/次
- 摇摇乐中奖积分入库
- 积分不足时 Toast 提示
- 积分变动 Toast 提示

### 7. 摇摇乐（Lottery）

- 3×5 食材网格老虎机
- 选择目标格子，点击摇一摇
- 中奖等级：MINI(×5) / SMALL(×15) / MEDIUM(×45) / BIG(×120) / JACKPOT(×450)
- 9 条支付线检测
- 中奖时推荐菜谱
- 中奖积分入库
- 扣积分抽奖（-5 积分/次）

### 8. 用户名系统

- 注册时可设置用户名（2-20字符）
- 用户名唯一性检查
- 登录后支持修改用户名
- 聊天室显示用户名
- 首页问候语显示用户名

## 数据架构

### Cloudflare 资源

| 资源 | Binding | 用途 |
|------|---------|------|
| D1 Database | `DB` | 用户/Session/收藏/历史/菜单/清单/偏好/打卡/聊天消息/积分 |
| KV Namespace | `RECIPE_CACHE` | 菜谱缓存 + 聊天消息缓存 |
| R2 Bucket | `RECIPE_DATA` | 菜谱原始数据（21个 chunk 文件 + 索引） |
| Durable Objects | `CHAT_ROOM` | 聊天室 WebSocket 管理 |

### 本地开发

- D1 通过 `sql.js` 内存数据库 Mock（`src/lib/cloudflare.ts`）
- KV 通过内存 Map Mock
- R2 返回空（菜谱功能需连接 Cloudflare 才完整可用）
- Durable Objects 在本地开发时不可用，需部署到 Cloudflare 后测试

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
- **菜谱搜索**：通过 R2 上的 `index.json` 索引文件分段读取匹配，支持 KV 缓存
- **菜谱详情**：优先匹配缓存数据，找不到时由 DeepSeek 生成
- **AI 推荐**：DeepSeek 根据用户条件返回结构化 JSON

## 认证系统

- 基于 Session Token（30天有效期）
- 密码哈希：PBKDF2 + SHA-256（100000 迭代）
- 使用 Web Crypto API（兼容 Cloudflare Workers + Node.js）
- 前端通过 `useAuth` Hook 管理状态，`authFetch` 自动附加认证头
- 支持设备 ID（deviceId）：未登录用户数据关联设备，登录后合并
- API 认证统一使用 `getAuthFromRequest`（读 Authorization 头 + x-device-id 头）

## 数据库表结构（D1）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户 | email, username, password_hash, salt, preferences(JSON) |
| `sessions` | 会话 | token, user_id, expires_at |
| `favorites` | 收藏 | user_id, recipe_name, recipe_data |
| `history` | 浏览历史 | user_id, recipe_name, viewed_at |
| `weekly_menu` | 一周菜单 | user_id, day_of_week, meal_type, week_start |
| `shopping_list` | 买菜清单 | user_id, item_name, checked, category, amount, related_recipe |
| `user_preferences` | 用户偏好 | user_id, device_id, preferences(JSON) |
| `check_ins` | 饮食打卡 | user_id, device_id, check_date, meal_type, recipe_name, cost, note |
| `chat_messages` | 聊天消息 | user_id, content, message_type, created_at |
| `user_points` | 用户积分 | user_id, points, total_earned, total_spent |
| `point_records` | 积分记录 | user_id, points, type, description, related_id |

## API 路由

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth` | 登录/注册（支持用户名） | 否 |
| GET | `/api/auth` | 获取当前用户信息 | 是 |
| DELETE | `/api/auth` | 退出登录 | 是 |
| PUT | `/api/auth` | 修改用户名 | 是 |
| GET/POST | `/api/recipe` | 菜谱查询/随机获取 | 否 |
| POST | `/api/chat` | DeepSeek API 代理 | 否 |
| GET | `/api/search?q=&cookTime=&calories=&cuisine=` | 菜谱搜索（支持筛选） | 否 |
| GET/POST/DELETE | `/api/favorites` | 收藏管理 | 是 |
| GET/POST/DELETE | `/api/history` | 浏览历史 | 是 |
| GET/POST/DELETE | `/api/menu` | 一周菜单 | 是 |
| GET/POST/PATCH/DELETE | `/api/shopping` | 买菜清单（支持分类） | 是 |
| POST | `/api/shopping/extract` | AI 食材智能提取 | 是 |
| GET/PUT | `/api/preferences` | 用户偏好 | 是 |
| GET/POST/DELETE | `/api/checkin` | 饮食打卡（支持花费、签到送积分） | 是 |
| GET | `/api/points` | 获取用户积分和记录 | 是 |
| POST | `/api/points` | 增加/扣减积分 | 是 |

## 积分规则

| 操作 | 积分 | 说明 |
|------|------|------|
| 新用户注册 | +100 | 注册送积分 |
| 每日签到 | +10 | 打卡送积分 |
| 连续签到 7 天 | +50 | 额外奖励 |
| 聊天发言 | -1 | 每条消息 |
| AI 推荐 | -10 | DeepSeek 生成 |
| 摇摇乐 | -5 | 每次抽奖 |
| 摇摇乐中奖 | 动态 | 根据中奖等级 |

## 组件设计

- **shadcn/ui 组件**：`src/components/ui/` 下的基础组件，通过 `components.json` 配置
- **业务组件**：直接放在 `src/components/` 下
- **动画**：使用 Framer Motion 的 `motion` 和 `AnimatePresence`
- **样式**：TailwindCSS 4，主色调 `#FF6B35`（橙色），背景 `#FFF8F2`（暖白）
- **Toast 提示**：使用 `useToast()` hook，支持 success/error/info 三种类型

## 状态管理

- **Zustand Store** (`useMealStore`)：管理推荐模式、推荐列表、筛选条件（含 cuisine）、历史记录、加载状态
- **React Query**：管理服务端数据请求，staleTime 5 分钟
- **Auth Context** (`useAuth`)：管理用户认证状态、deviceId、authFetch、updateUsername
- **Preferences Context** (`usePreferences`)：管理用户偏好、引导状态、onboarding 判断
- **Toast Context** (`useToast`)：管理全局 Toast 提示

## 关键约定

- 所有页面组件使用 `"use client"` 指令（客户端渲染）
- API 路由使用 Next.js App Router 的 `route.ts` 约定
- 使用 `@/` 路径别名导入模块
- 使用 `cn()` 工具函数合并 TailwindCSS 类名
- 需要认证的 API 通过 `getAuthFromRequest()` 获取用户信息
- 错误处理：API 路由统一 try/catch，使用 `handleAPIError` 返回标准错误格式
- 本地开发 Mock：`cloudflare.ts` 中 sql.js 自动建表，无需手动迁移
- Cloudflare D1 需手动建表（通过 Dashboard Console 执行 SQL）
- 积分扣减使用 Toast 提示，积分不足时显示错误提示
- Durable Objects 使用 `new_sqlite_classes` 迁移（免费计划）
