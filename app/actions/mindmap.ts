// app/actions/mindmap.ts
"use server"
import { llm } from "./ai"
import { db } from "@/db/index"
import { notes } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function generateMindMap(markdown: string): Promise<string> {
  const result = await llm.invoke(`
    根据以下笔记内容，生成一个 Mermaid mindmap 思维导图。
    严格要求：
    - 只输出 Mermaid 代码，不要任何解释
    - 不要用 \`\`\` 代码块包裹
    - 第一行必须是 mindmap
    - 层级用空格缩进，不要用 tab
    - 节点文字不要带括号以外的特殊字符
    
    示例格式：
    mindmap
      root((核心主题))
        分支一
          子节点A
          子节点B
        分支二
          子节点C
    
    笔记内容：
    ${markdown.slice(0, 3000)}
  `)

  return result.content as string
}

// ✅ 新增：保存到数据库
export async function saveMindMap(noteId: string, mindmapCode: string) {
  await db
    .update(notes)
    .set({ mindmapCode })
    .where(eq(notes.id, noteId))
}