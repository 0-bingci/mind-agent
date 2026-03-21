"use server";

import { db } from "@/db";
import { chatLogs, chatSessions, traceSpans, chatFeedback } from "@/db/schema";
import { desc, eq, sql, asc } from "drizzle-orm";

export async function getLogs(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const logs = await db
    .select({
      id: chatLogs.id,
      sessionId: chatLogs.sessionId,
      sessionTitle: chatSessions.title,
      userInput: chatLogs.userInput,
      agentOutput: chatLogs.agentOutput,
      promptTokens: chatLogs.promptTokens,
      completionTokens: chatLogs.completionTokens,
      totalTokens: chatLogs.totalTokens,
      toolCalls: chatLogs.toolCalls,
      durationMs: chatLogs.durationMs,
      status: chatLogs.status,
      errorMessage: chatLogs.errorMessage,
      createdAt: chatLogs.createdAt,
    })
    .from(chatLogs)
    .leftJoin(chatSessions, eq(chatLogs.sessionId, chatSessions.id))
    .orderBy(desc(chatLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatLogs);

  return {
    logs,
    total: Number(count),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count) / pageSize),
  };
}

export async function getLogDetail(logId: string) {
  const [log] = await db
    .select({
      id: chatLogs.id,
      sessionId: chatLogs.sessionId,
      sessionTitle: chatSessions.title,
      userInput: chatLogs.userInput,
      agentOutput: chatLogs.agentOutput,
      promptTokens: chatLogs.promptTokens,
      completionTokens: chatLogs.completionTokens,
      totalTokens: chatLogs.totalTokens,
      toolCalls: chatLogs.toolCalls,
      durationMs: chatLogs.durationMs,
      status: chatLogs.status,
      errorMessage: chatLogs.errorMessage,
      createdAt: chatLogs.createdAt,
    })
    .from(chatLogs)
    .leftJoin(chatSessions, eq(chatLogs.sessionId, chatSessions.id))
    .where(eq(chatLogs.id, logId));

  if (!log) return null;

  // 查询该日志关联的 trace spans
  const spans = await db
    .select({
      id: traceSpans.id,
      runId: traceSpans.runId,
      parentRunId: traceSpans.parentRunId,
      type: traceSpans.type,
      name: traceSpans.name,
      input: traceSpans.input,
      output: traceSpans.output,
      promptTokens: traceSpans.promptTokens,
      completionTokens: traceSpans.completionTokens,
      startedAt: traceSpans.startedAt,
      endedAt: traceSpans.endedAt,
      durationMs: traceSpans.durationMs,
      status: traceSpans.status,
      errorMessage: traceSpans.errorMessage,
    })
    .from(traceSpans)
    .where(eq(traceSpans.chatLogId, logId))
    .orderBy(asc(traceSpans.startedAt));

  // 查询反馈
  const [feedback] = await db
    .select({
      rating: chatFeedback.rating,
      comment: chatFeedback.comment,
    })
    .from(chatFeedback)
    .where(eq(chatFeedback.chatLogId, logId))
    .limit(1);

  return { ...log, spans, feedback: feedback ?? null };
}

export async function getLogsStats() {
  const [stats] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      totalTokens: sql<number>`coalesce(sum(${chatLogs.totalTokens}), 0)`,
      totalPromptTokens: sql<number>`coalesce(sum(${chatLogs.promptTokens}), 0)`,
      totalCompletionTokens: sql<number>`coalesce(sum(${chatLogs.completionTokens}), 0)`,
      avgDurationMs: sql<number>`coalesce(avg(${chatLogs.durationMs}), 0)`,
      errorCount: sql<number>`count(*) filter (where ${chatLogs.status} = 'error')`,
    })
    .from(chatLogs);

  const [feedbackStats] = await db
    .select({
      thumbsUp: sql<number>`count(*) filter (where ${chatFeedback.rating} = 'up')`,
      thumbsDown: sql<number>`count(*) filter (where ${chatFeedback.rating} = 'down')`,
    })
    .from(chatFeedback);

  return { ...stats, ...feedbackStats };
}
