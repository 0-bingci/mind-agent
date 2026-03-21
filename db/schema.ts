// db/schema.ts
import { pgTable, text, timestamp, uuid, vector, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("新对话"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'agent'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content"),
  embedding: vector("embedding", { dimensions: 4096 }),
  
  // ✅ 新增：缓存 AI 生成的思维导图 Mermaid 代码
  mindmapCode: text("mindmap_code"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 对话日志表：记录每次 Agent 调用的详细信息
export const chatLogs = pgTable("chat_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => chatSessions.id, { onDelete: "cascade" }),
  userInput: text("user_input").notNull(),
  agentOutput: text("agent_output"),
  // token 统计
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  // 工具调用记录 [{name, input, output, durationMs}]
  toolCalls: jsonb("tool_calls").$type<{
    name: string;
    input: Record<string, unknown>;
    output: string;
    durationMs: number;
  }[]>(),
  // 耗时（毫秒）
  durationMs: integer("duration_ms"),
  // 状态: success | error
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Trace span 表：记录每一步的链路信息（LLM 调用、工具调用、chain）
export const traceSpans = pgTable("trace_spans", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatLogId: uuid("chat_log_id").notNull().references(() => chatLogs.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull(),
  parentRunId: text("parent_run_id"),
  type: text("type").notNull(), // 'llm' | 'tool' | 'chain'
  name: text("name").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationMs: integer("duration_ms"),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 用户反馈表
export const chatFeedback = pgTable("chat_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatLogId: uuid("chat_log_id").references(() => chatLogs.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => chatSessions.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(), // 'up' | 'down'
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent prompt 版本管理表
export const agentPrompts = pgTable("agent_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  source: text("source").notNull().default("manual"), // 'initial' | 'manual' | 'ai_suggestion'
  description: text("description"), // 版本说明，如 "根据 5 条负反馈优化"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});