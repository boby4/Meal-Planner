# Role

你是一名资深全栈工程师、AI 应用开发工程师、资深产品经理和 UI 设计师。

你的目标不是生成 Demo，而是开发一个可直接部署到 Vercel 的生产级 H5 项目。

要求：

- 代码结构清晰，可维护，可扩展
- 所有组件可复用
- 不允许使用 Mock 数据
- 不允许暴露 API Key
- 不允许省略核心实现
- 移动端优先
- 支持后续迁移到微信小程序

---

# 项目名称

AI 今天吃什么（AI Meal Planner）

Slogan：

今天吃什么，不再纠结。

---

# 技术栈

必须使用：

- Next.js 15（App Router）
- React 19
- TypeScript
- TailwindCSS
- shadcn/ui
- Framer Motion
- Zustand
- TanStack Query
- React Hook Form
- Zod
- pnpm

支持：

- Vercel 一键部署
- pnpm dev
- pnpm build
- pnpm lint

---

# 数据来源

## AI

DeepSeek API

环境变量：

```
DEEPSEEK_API_KEY=
```

所有 AI 请求必须通过：

```
app/api/chat/route.ts
```

代理调用。

禁止在客户端暴露 API Key。

---

## 菜谱数据

使用：

https://huggingface.co/datasets/xzm1999/XiaChuFang_Recipe_Corpus/blob/main/recipe_corpus_full.json

创建：

```
lib/recipe.ts
```

负责：

- 加载菜谱
- 内存缓存
- 搜索菜谱
- 随机菜谱
- 根据名称查询菜谱

项目启动后只加载一次。

不要重复下载 Dataset。

---

# 首页

标题：

🍳 今天吃什么

副标题：

不知道吃什么？

让 AI 帮你决定。

首页包含三个入口：

## ① 今天吃什么（随机推荐）

点击后：

随机从菜谱库推荐一道菜。

进入菜谱详情。

---

## ② AI 推荐

支持条件：

- 人数
- 口味
- 烹饪时间
- 预算
- 食材（可选）
- 是否减脂

调用 DeepSeek。

返回 JSON：

```json
{
  "recipes": [
    {
      "name": "",
      "reason": "",
      "time": "",
      "difficulty": ""
    }
  ]
}
```

禁止返回 Markdown。

---

## ③ 冰箱有什么（新增）

用户输入已有食材，例如：

```
鸡蛋
西红柿
土豆
牛肉
```

调用 DeepSeek。

根据已有食材推荐可以制作的菜。

返回：

```json
{
  "recipes": []
}
```

每道菜均支持查看菜谱。

---

# 推荐结果页

展示：

- 菜名
- 推荐理由
- 制作时间
- 难度

按钮：

✅ 查看菜谱

🔄 换一道

---

# 换一道（新增）

点击"换一道"：

如果当前为 AI 推荐：

再次调用 DeepSeek。

Prompt 中必须排除已经推荐过的菜。

例如：

```
不要推荐：

宫保鸡丁

鱼香肉丝

重新推荐三道。
```

如果当前为随机推荐：

重新随机。

不能返回当前菜。

保证连续两次不会重复。

---

# 菜谱详情

优先查询：

Hugging Face Dataset。

如果找到：

展示：

- 图片（如果有）
- 菜名
- 简介
- 制作时间
- 难度
- 食材
- 步骤
- Tips

如果没有：

调用 DeepSeek 自动生成标准 JSON：

```json
{
  "name": "",
  "description": "",
  "time": "",
  "difficulty": "",
  "ingredients": [],
  "steps": [],
  "tips": []
}
```

---

# UI 风格

参考：

- Apple
- Linear
- Notion

要求：

- 大量留白
- 卡片圆角 24px
- 柔和阴影
- Framer Motion 动画
- 移动端优先

颜色：

Primary：

```
#FF6B35
```

Background：

```
#FFF8F2
```

---

# 组件

至少包含：

- RecipeCard
- RecommendationCard
- RecipeDetail
- FilterPanel
- IngredientInput
- RandomButton
- AIButton
- ChangeRecipeButton
- Skeleton
- EmptyState
- ErrorState

---

# 状态管理

使用 Zustand。

管理：

- 当前推荐
- 当前菜谱
- 筛选条件
- 推荐历史（用于"换一道"去重）

---

# 性能要求

- Dataset 内存缓存
- 图片懒加载
- Skeleton Loading
- Error Retry
- 响应式布局
- TypeScript Strict
- 不允许 any
- 不允许重复代码

---

# 预留功能（仅预留架构）

- 收藏
- 浏览历史
- 一周菜单
- 买菜清单
- AI 识图
- 微信小程序

不要实现，只保留扩展能力。

---

# 最终目标

生成一个可直接部署到 Vercel 的 AI 菜谱推荐 H5 项目。

代码质量达到开源项目标准，而不是 Demo。



AI 推荐
      │
      ▼
DeepSeek 返回：
「红烧排骨」

      │
      ▼
先查询 Hugging Face Dataset

找到
↓↓↓

直接展示标准菜谱

没找到
↓↓↓

DeepSeek 自动生成完整菜谱
↓↓↓

展示结果