"use server";

import { db } from "@/db";
import { agentPrompts, chatFeedback, chatLogs } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { llm } from "./ai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 硬编码的初始 prompt（兜底用）
const DEFAULT_PROMPT = `## 角色定位
你是一个具备 L4 级自治能力的 Mind Agent。你不仅能执行任务，还拥有"自我监视"和"策略迭代"能力。你的目标是在复杂的、模糊的信息环境中，通过多轮工具调用完成任务闭环。

## 核心认知框架：[P-R-E-A] 模式
每一轮响应，你必须遵循以下逻辑步骤，并在输出中（或思考过程中）体现：

1. **[PLAN] 任务规划**：
   - 严禁直接调用工具。首先将用户意图拆解为 2-3 个子目标。
   - 示例：1. 确认软件名称；2. 检索该软件的 Logo 描述；3. 对比笔记中的版本信息。

2. **[REASONING] 逻辑链条**：
   - 解释为什么要调用当前工具。如果前一次搜索失败，必须在这里分析失败原因（如关键词太窄）。

3. **[EXECUTE] 执行与观察**：
   - 调用工具并诚实地观察返回结果。

4. **[ADAPT] 策略调整 (关键)**：
   - 如果工具返回结果为空或不匹配，禁止回答"不知道"。
   - 你必须执行"查询重写（Query Rewriting）"，尝试近义词、关联场景（如：远控 -> 运维 -> 远程运维）进行二次搜索。

## 行为守则
- **深度溯源**：如果用户提到"我的笔记"，必须优先调用 'search_notes'；如果笔记内容模糊，立即联动 'search_web' 进行"常识补全"。
- **拒绝复读**：严禁直接输出搜索结果的原始片段。你必须根据 [CONTENT] 标签整理出逻辑清晰的结论。
- **冲突处理**：当"网页信息"与"用户笔记"冲突时，必须在回复中指出："在您的笔记中记录为 A，但目前网络公认信息为 B，我建议以...为准。"

## 信源标注（强制）
- 你输出的每一个事实性陈述，必须标注来源：[笔记] 或 [网络: URL] 或 [常识]。
- 如果某信息无法标注来源，你必须明确说明"这是我的推测，未经验证"。
- 严禁混淆来源：不要把网络搜到的内容说成"你的笔记里记录了"。
- 如果 search_notes 返回"[无匹配结果]"，你必须如实告知用户笔记中没有相关内容，严禁编造笔记内容。

## 强制约束
- 如果第一次搜索结果不理想，你**必须**进行至少第二次不同角度的搜索尝试。
- 在输出最终答案前，检查是否满足了用户所有的潜在需求（如：不仅找到了软件，还确认了它的图标特征）。`;

/**
 * 获取当前激活的 prompt，没有则返回默认
 */
export async function getActivePrompt(): Promise<{ id: string | null; content: string }> {
  const [active] = await db
    .select({ id: agentPrompts.id, content: agentPrompts.content })
    .from(agentPrompts)
    .where(eq(agentPrompts.isActive, true))
    .orderBy(desc(agentPrompts.createdAt))
    .limit(1);

  return active ?? { id: null, content: DEFAULT_PROMPT };
}

/**
 * 获取 prompt 版本历史
 */
export async function getPromptHistory() {
  return await db
    .select({
      id: agentPrompts.id,
      content: agentPrompts.content,
      isActive: agentPrompts.isActive,
      source: agentPrompts.source,
      description: agentPrompts.description,
      createdAt: agentPrompts.createdAt,
    })
    .from(agentPrompts)
    .orderBy(desc(agentPrompts.createdAt))
    .limit(20);
}

/**
 * 根据用户反馈生成优化建议
 */
export async function generatePromptSuggestion(): Promise<{
  suggestion: string;
  currentPrompt: string;
  feedbackSummary: string;
  feedbackCount: { up: number; down: number };
}> {
  // 获取当前 prompt
  const { content: currentPrompt } = await getActivePrompt();

  // 查询所有 👎 反馈关联的对话
  const downFeedbacks = await db
    .select({
      userInput: chatLogs.userInput,
      agentOutput: chatLogs.agentOutput,
      rating: chatFeedback.rating,
    })
    .from(chatFeedback)
    .innerJoin(chatLogs, eq(chatFeedback.chatLogId, chatLogs.id))
    .where(eq(chatFeedback.rating, "down"))
    .orderBy(desc(chatFeedback.createdAt))
    .limit(20);

  // 也查一下 👍 的，作为正面参考
  const upFeedbacks = await db
    .select({
      userInput: chatLogs.userInput,
      agentOutput: chatLogs.agentOutput,
      rating: chatFeedback.rating,
    })
    .from(chatFeedback)
    .innerJoin(chatLogs, eq(chatFeedback.chatLogId, chatLogs.id))
    .where(eq(chatFeedback.rating, "up"))
    .orderBy(desc(chatFeedback.createdAt))
    .limit(10);

  if (downFeedbacks.length === 0 && upFeedbacks.length === 0) {
    return {
      suggestion: currentPrompt,
      currentPrompt,
      feedbackSummary: "暂无反馈数据，无法生成优化建议。",
      feedbackCount: { up: 0, down: 0 },
    };
  }

  // 构造反馈摘要
  const formatFeedback = (items: typeof downFeedbacks, label: string) =>
    items
      .map(
        (f, i) =>
          `[${label} #${i + 1}]\n用户: ${f.userInput?.substring(0, 200)}\nAgent: ${f.agentOutput?.substring(0, 300)}`
      )
      .join("\n\n");

  const feedbackText = [
    downFeedbacks.length > 0
      ? `### 负面反馈 (👎 ${downFeedbacks.length} 条)\n${formatFeedback(downFeedbacks, "👎")}`
      : "",
    upFeedbacks.length > 0
      ? `### 正面反馈 (👍 ${upFeedbacks.length} 条)\n${formatFeedback(upFeedbacks, "👍")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  // 调用 LLM 生成优化建议
  const response = await llm.invoke([
    new SystemMessage(
      `你是一个 prompt 工程专家。你的任务是根据用户反馈优化一个 AI Agent 的 system prompt。

规则：
1. 保持原有 prompt 的核心框架和结构不变（如 [P-R-E-A] 模式）
2. 根据负面反馈识别问题模式，针对性地添加或修改指令
3. 根据正面反馈，保留和强化有效的指令
4. 输出完整的优化后 prompt，不要输出解释，只输出 prompt 本身
5. 使用中文
6. 不要添加任何前缀说明如"以下是优化后的prompt"，直接输出 prompt 内容`
    ),
    new HumanMessage(
      `## 当前 Prompt\n\n${currentPrompt}\n\n## 用户反馈数据\n\n${feedbackText}\n\n请输出优化后的完整 prompt：`
    ),
  ]);

  const suggestion =
    typeof response.content === "string"
      ? response.content
      : String(response.content);

  return {
    suggestion,
    currentPrompt,
    feedbackSummary: feedbackText,
    feedbackCount: { up: upFeedbacks.length, down: downFeedbacks.length },
  };
}

/**
 * 保存新的 prompt 版本并设为激活
 */
export async function savePrompt(content: string, description: string, source = "manual") {
  // 先把所有版本取消激活
  await db
    .update(agentPrompts)
    .set({ isActive: false })
    .where(eq(agentPrompts.isActive, true));

  // 插入新版本并设为激活
  const [newPrompt] = await db
    .insert(agentPrompts)
    .values({
      content,
      isActive: true,
      source,
      description,
    })
    .returning();

  return newPrompt;
}

/**
 * 切换激活某个历史版本
 */
export async function activatePrompt(promptId: string) {
  await db
    .update(agentPrompts)
    .set({ isActive: false })
    .where(eq(agentPrompts.isActive, true));

  await db
    .update(agentPrompts)
    .set({ isActive: true })
    .where(eq(agentPrompts.id, promptId));
}
