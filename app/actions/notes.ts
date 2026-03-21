"use server";

import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { embeddings } from "./ai";

// --- 1. 增 (Create) ---
export async function createNote(title: string, content: string) {
  // 1. 调用上面的函数，把笔记内容变向量
  const embedding = await embeddings.embedQuery(content);

  // 2. 存入 Supabase (现在 embedding 列不再是空了)
  const result = await db.insert(notes).values({
    title,
    content,
    embedding: embedding, // 注入灵魂
  }).returning();
  
  revalidatePath("/");
  return result[0];
}

// --- 2. 查 (Read - 全部) ---
export async function getNotes() {
  return await db.select().from(notes).orderBy(desc(notes.createdAt));
}

// --- 3. 改 (Update) ---
export async function updateNote(id: string, title: string, content: string) {
  try {
    // 1. 重新计算修改后内容的向量
    const newEmbedding = await embeddings.embedQuery(content);

    // 2. 同步更新数据库里的文字和向量
    const result = await db.update(notes)
      .set({ 
        title, 
        content, 
        embedding: newEmbedding, // 关键：同步更新向量
        updatedAt: new Date() 
      })
      .where(eq(notes.id, id))
      .returning();
      
    revalidatePath("/");
    return result[0];
  } catch (error) {
    console.error("更新笔记及向量失败:", error);
    throw error;
  }
}

// --- 4. 删 (Delete) ---
export async function deleteNote(id: string) {
  await db.delete(notes).where(eq(notes.id, id));
  revalidatePath("/");
}