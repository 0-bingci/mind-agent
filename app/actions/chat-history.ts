"use server";

import { db } from "@/db";
import { chatSessions, chatMessages } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export async function getSessions() {
  return await db.select().from(chatSessions).orderBy(desc(chatSessions.createdAt));
}

export async function createSession(firstMessage: string) {
  const title = firstMessage.slice(0, 28) + (firstMessage.length > 28 ? "..." : "");
  const [session] = await db.insert(chatSessions).values({ title }).returning();
  return session;
}

export async function getSessionMessages(sessionId: string) {
  return await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function saveMessages(sessionId: string, userContent: string, agentContent: string) {
  await db.insert(chatMessages).values([
    { sessionId, role: "user", content: userContent },
    { sessionId, role: "agent", content: agentContent },
  ]);
}

export async function deleteSession(sessionId: string) {
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
}
