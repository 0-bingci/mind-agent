# Mind Agent

AI 驱动的个人知识库系统，集成 Markdown 笔记管理、语义搜索和智能 AI Agent，帮助用户高效管理和探索知识。

## 功能特性

- **Markdown 笔记** — 基于 TipTap 的富文本编辑器，支持 Markdown 语法
- **语义搜索** — 基于向量嵌入（Qwen3-Embedding）的混合搜索，同时支持关键词匹配
- **AI Agent 对话** — 基于 LangChain/LangGraph 构建的智能 Agent，支持笔记检索、联网搜索和网页提取
- **思维导图** — 自动从笔记内容生成交互式思维导图，支持拖拽和缩放
- **多会话管理** — 支持创建多个对话会话，保留完整历史记录
- **流式输出** — 基于 SSE 的实时响应，体验流畅
- **监控系统** — 完整的日志追踪、Token 用量统计和执行耗时分析

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + Radix UI |
| 数据库 | PostgreSQL (Supabase) + pgvector |
| ORM | Drizzle ORM |
| LLM | Kimi K2.5 (ModelScope API) |
| Embedding | Qwen3-Embedding-8B (4096 维) |
| Agent 框架 | LangChain + LangGraph |
| 联网搜索 | Tavily Search API |
| 可视化 | XYFlow (React Flow) + Dagre |

## 项目结构

```
mind-agent/
├── app/
│   ├── actions/           # Server Actions（核心业务逻辑）
│   │   ├── ai.ts          # LLM 与 Embedding 初始化
│   │   ├── chat.ts        # Agent 编排与工具定义
│   │   ├── chat-history.ts # 会话与消息管理
│   │   ├── feedback.ts    # 用户反馈
│   │   ├── logs.ts        # 日志与追踪
│   │   ├── mindmap.ts     # 思维导图生成
│   │   ├── notes.ts       # 笔记 CRUD
│   │   └── prompt.ts      # Prompt 版本管理
│   ├── api/chat/stream/   # SSE 流式接口
│   ├── workspace/         # 工作区页面
│   └── logs/              # 日志查看页面
├── components/
│   ├── knowledge-base/    # 知识库核心组件
│   │   ├── agent-panel.tsx    # 对话面板
│   │   ├── note-content.tsx   # 笔记展示 + 思维导图
│   │   ├── note-editor.tsx    # Markdown 编辑器
│   │   ├── sidebar.tsx        # 笔记侧栏
│   │   └── MindMap.tsx        # 思维导图可视化
│   └── ui/                # 通用 UI 组件
├── db/
│   └── schema.ts          # 数据库 Schema 定义
├── drizzle/               # 数据库迁移文件
└── lib/
    └── utils.ts           # 工具函数
```

## 快速开始

### 环境要求

- Node.js 18+
- pnpm
- PostgreSQL 数据库（推荐使用 Supabase，需启用 pgvector 扩展）

### 安装

```bash
# 克隆仓库
git clone <repo-url>
cd mind-agent

# 安装依赖
pnpm install
```

### 配置环境变量

创建 `.env` 文件：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key

# 数据库
DATABASE_URL=postgresql://postgres:password@host:port/database

# ModelScope（LLM 与 Embedding）
MODELSCOPE_API_KEY=your_modelscope_key
MODELSCOPE_BASE_URL=https://api-inference.modelscope.cn/v1

# Tavily（联网搜索）
TAVILY_API_KEY=your_tavily_key
```

### 初始化数据库

```bash
pnpm exec drizzle-kit migrate
```

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可使用。

### 构建与部署

```bash
pnpm build
pnpm start
```

## Agent 工具

AI Agent 内置三个核心工具，采用 P-R-E-A（规划-推理-执行-适应）模式运行：

| 工具 | 说明 |
|------|------|
| `search_notes` | 在用户笔记中进行向量相似度 + 关键词混合搜索 |
| `search_web` | 通过 Tavily API 进行实时联网搜索 |
| `web_extract` | 提取网页完整内容，用于深度阅读 |

## License

[GPL-3.0](LICENSE)
