"use server";

import { db } from "@/db";
import { chatFeedback } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function submitFeedback(
  chatLogId: string,
  sessionId: string | null,
  rating: "up" | "down"
) {
  // 如果已有反馈，先删除旧的再插入新的（相当于 upsert）
  if (chatLogId) {
    await db
      .delete(chatFeedback)
      .where(eq(chatFeedback.chatLogId, chatLogId));
  }

  const [result] = await db
    .insert(chatFeedback)
    .values({
      chatLogId,
      sessionId,
      rating,
    })
    .returning();

  return result;
}

export async function getFeedbackByLogId(chatLogId: string) {
  const [feedback] = await db
    .select()
    .from(chatFeedback)
    .where(eq(chatFeedback.chatLogId, chatLogId))
    .limit(1);

  return feedback ?? null;
}

export async function getFeedbacksBySessionId(sessionId: string) {
  return await db
    .select({
      chatLogId: chatFeedback.chatLogId,
      rating: chatFeedback.rating,
    })
    .from(chatFeedback)
    .where(eq(chatFeedback.sessionId, sessionId));
}
