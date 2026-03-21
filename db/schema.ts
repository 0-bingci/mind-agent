// db/schema.ts
import { pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

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