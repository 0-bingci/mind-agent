// app/actions/mindmap.ts
"use server"
import { llm } from "./ai"
import { db } from "@/db/index"
import { notes } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function generateMindMap(markdown: string): Promise<string> {
  const result = await llm.invoke(`
你是一个专业的思维导图设计师。根据以下笔记内容，生成一个 JSON 格式的思维导图数据。

严格要求：
- 只输出 JSON，不要任何解释、前缀或后缀
- 不要用 \`\`\` 代码块包裹
- 必须是合法 JSON

JSON 结构如下：
{
  "nodes": [
    {
      "id": "root",
      "label": "核心主题",
      "type": "root",
      "icon": "💡"
    },
    {
      "id": "b1",
      "label": "分支名称",
      "type": "branch",
      "icon": "📝"
    },
    {
      "id": "l1",
      "label": "叶子节点",
      "type": "leaf",
      "tags": [{ "text": "标签文字", "color": "pink" }],
      "details": ["补充细节1", "补充细节2"]
    }
  ],
  "edges": [
    { "source": "root", "target": "b1" },
    { "source": "b1", "target": "l1", "style": "solid" }
  ]
}

节点类型说明：
- "root": 根节点，只有 1 个，提炼核心主题，配一个贴切的 emoji icon
- "branch": 分支节点，3-6 个，表示主要分类，每个配一个 emoji icon
- "leaf": 叶子节点，挂在 branch 下，表示具体要点
  - 可选 tags 数组：彩色小标签，color 可选 pink/blue/green/orange/purple/yellow/red
  - 可选 details 数组：补充细节文字

边类型说明：
- style 可选 "solid"（默认实线）或 "dashed"（虚线）

设计原则：
- 节点文字简洁精炼，每个节点不超过 12 个字
- 总节点数控制在 12-25 个
- 每个 branch 下 2-5 个 leaf
- tags 用于标注关键属性或情感色彩（不是每个节点都需要）
- details 用于补充说明（不是每个节点都需要）
- 重在提炼核心结构，而非罗列所有内容

笔记内容：
${markdown.slice(0, 3000)}
  `)

  return result.content as string
}

// 保存到数据库
export async function saveMindMap(noteId: string, mindmapCode: string) {
  await db
    .update(notes)
    .set({ mindmapCode })
    .where(eq(notes.id, noteId))
}
