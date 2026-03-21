"use server";
// app/action/chat.ts
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createAgent } from "langchain";
import { z } from "zod";
import { llm, embeddings } from "./ai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { TavilySearchAPIWrapper, TavilyExtractAPIWrapper } from "@langchain/tavily";
import { db } from "@/db";
import { chatLogs, traceSpans } from "@/db/schema";
import { getActivePrompt } from "./prompt";

// 初始化 Wrapper
const searchWrapper = new TavilySearchAPIWrapper({
  tavilyApiKey: process.env.TAVILY_API_KEY!,
});
const extractWrapper = new TavilyExtractAPIWrapper({
  tavilyApiKey: process.env.TAVILY_API_KEY!,
});

const searchWebTool = tool(
  async ({ query, depth = "basic" }) => {
    try {
      // 1. 执行搜索 (对应 TavilySearchParams)
      const response = await searchWrapper.rawResults({
        query,
        search_depth: depth,
        max_results: 5,
        include_answer: true, // 让 Tavily 预先给出一个总结回答
      });

      if (!response.results || response.results.length === 0) {
        return "未能从网上搜到相关信息。";
      }

      // 2. 构造返回给 Agent 的参考资料
      const results = response.results.map(r =>
        `标题: ${r.title}\n链接: ${r.url}\n摘要: ${r.content}\n---`
      ).join("\n");

      return `搜索结果如下：\n${results}\nTavily 预处理答案: ${response.answer ?? "无"}`;
    } catch (error) {
      return `搜索出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "search_web",
    description: "从互联网搜索实时信息、技术趋势或外部事实。如果需要深度研究，可将 depth 设置为 'advanced'。",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
      depth: z.enum(["basic", "advanced"]).optional().describe("搜索深度"),
    }),
  }
);

/**
 * L4 级专属工具：如果搜索到的摘要不够，Agent 可以调用此工具直接“读”网页全文
 */
const webExtractTool = tool(
  async ({ url }) => {
    try {
      const response = await extractWrapper.rawResults({
        urls: [url],
        extract_depth: "advanced", // 提取包括表格在内的深度内容
      });

      if (response.results.length === 0) return "提取内容失败。";

      const content = response.results[0].raw_content;
      // L4 优化：如果内容太长，进行简单截断，防止 Token 溢出
      return `网页全文内容 (前 3000 字):\n${content.substring(0, 3000)}`;
    } catch (error) {
      return `提取网页失败: ${error}`;
    }
  },
  {
    name: "web_extract",
    description: "当你通过 search_web 找到了一个非常有价值的 URL，但摘要不足以回答问题时，使用此工具提取网页全文。",
    schema: z.object({
      url: z.string().url().describe("要提取全文的网页 URL"),
    }),
  }
);

// 这种写法能更清晰地向模型描述 Schema
const searchNotesTool = tool(
  async ({ query }) => {
    const allResults: { title: string; content: string; score: number; source: string }[] = [];

    // 1. 向量语义搜索
    try {
      const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabaseClient,
        tableName: "notes",
        queryName: "match_notes",
      });
      const vectorResults = await vectorStore.similaritySearchWithScore(query, 5);
      console.log("[SEARCH_NOTES] 向量搜索结果:", vectorResults.map(([d, s]) => ({
        title: d.metadata.title,
        score: s,
        contentPreview: d.pageContent?.substring(0, 80),
      })));

      for (const [doc, score] of vectorResults) {
        // SupabaseVectorStore 返回的 score 是相似度（越大越好），阈值降到 0.3
        if (score > 0.3) {
          allResults.push({
            title: doc.metadata.title,
            content: doc.pageContent,
            score,
            source: "向量搜索",
          });
        }
      }
    } catch (err) {
      console.error("[SEARCH_NOTES] 向量搜索失败:", err);
    }

    // 2. 关键词全文搜索（兜底）
    try {
      const { data: keywordResults } = await supabaseClient
        .from("notes")
        .select("id, title, content")
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(5);

      if (keywordResults) {
        console.log("[SEARCH_NOTES] 关键词搜索命中:", keywordResults.map(n => n.title));
        for (const note of keywordResults) {
          // 去重：如果向量搜索已经找到同一篇笔记，跳过
          if (!allResults.some(r => r.title === note.title)) {
            allResults.push({
              title: note.title,
              content: note.content || "",
              score: 0.5, // 关键词匹配给一个中等分数
              source: "关键词匹配",
            });
          }
        }
      }
    } catch (err) {
      console.error("[SEARCH_NOTES] 关键词搜索失败:", err);
    }

    if (allResults.length === 0) {
      return `[无匹配结果] 用户笔记库中没有找到与"${query}"相关的内容。请不要编造笔记内容，应如实告知用户未找到。`;
    }

    // 按分数排序，返回结果
    allResults.sort((a, b) => b.score - a.score);
    return allResults
      .map(r => `[${r.source} | 相似度: ${r.score.toFixed(2)}] 标题: ${r.title}\n内容: ${r.content}`)
      .join("\n\n");
  },
  {
    name: "search_notes",
    description: "查询用户的私人笔记和知识库。当你需要查找个人记录、过去的总结或特定私人信息时使用。",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
    }),
  }
);

// 初始化 Supabase 客户端 (LangChain 专用)
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const instructions = `## 角色定位
你是一个具备 L4 级自治能力的 Mind Agent。你不仅能执行任务，还拥有“自我监视”和“策略迭代”能力。你的目标是在复杂的、模糊的信息环境中，通过多轮工具调用完成任务闭环。

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
   - 如果工具返回结果为空或不匹配，禁止回答“不知道”。
   - 你必须执行“查询重写（Query Rewriting）”，尝试近义词、关联场景（如：远控 -> 运维 -> 远程运维）进行二次搜索。

## 行为守则
- **深度溯源**：如果用户提到“我的笔记”，必须优先调用 'search_notes'；如果笔记内容模糊，立即联动 'search_web' 进行“常识补全”。
- **拒绝复读**：严禁直接输出搜索结果的原始片段。你必须根据 [CONTENT] 标签整理出逻辑清晰的结论。
- **冲突处理**：当“网页信息”与“用户笔记”冲突时，必须在回复中指出：“在您的笔记中记录为 A，但目前网络公认信息为 B，我建议以...为准。”

## 信源标注（强制）
- 你输出的每一个事实性陈述，必须标注来源：[笔记] 或 [网络: URL] 或 [常识]。
- 如果某信息无法标注来源，你必须明确说明"这是我的推测，未经验证"。
- 严禁混淆来源：不要把网络搜到的内容说成"你的笔记里记录了"。
- 如果 search_notes 返回"[无匹配结果]"，你必须如实告知用户笔记中没有相关内容，严禁编造笔记内容。

## 强制约束
- 如果第一次搜索结果不理想，你**必须**进行至少第二次不同角度的搜索尝试。
- 在输出最终答案前，检查是否满足了用户所有的潜在需求（如：不仅找到了软件，还确认了它的图标特征）。
`;

export async function askAgent(
  userInput: string,
  clientHistory: { role: string; content: string }[] = [],
  sessionId?: string
) {
  // 从 DB 读取激活的 prompt，没有则 fallback 到硬编码版本
  const { content: activePrompt } = await getActivePrompt();
  const systemPrompt = activePrompt || instructions;

  const agent = createAgent({
    model: llm,
    tools: [searchNotesTool, searchWebTool, webExtractTool],
    systemPrompt,
  });

  // 将客户端传来的历史转换为 LangChain 消息格式
  const history: BaseMessage[] = clientHistory
    .filter((m) => m.content)
    .map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Span 数据结构
  interface SpanRecord {
    runId: string;
    parentRunId: string | null;
    type: "llm" | "tool" | "chain";
    name: string;
    input: unknown;
    output: unknown;
    promptTokens: number;
    completionTokens: number;
    startedAt: Date;
    endedAt: Date | null;
    durationMs: number | null;
    status: string;
    errorMessage: string | null;
  }

  (async () => {
    const startTime = Date.now();
    let agentOutput = "";
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let logStatus = "success";
    let logError: string | undefined;

    // Span 追踪
    const spans = new Map<string, SpanRecord>();
    // 维护一个 chain runId 栈，用于推导 parent
    const chainStack: string[] = [];

    const getCurrentParent = () =>
      chainStack.length > 0 ? chainStack[chainStack.length - 1] : null;

    // 安全截断数据，直接存为截断后的字符串，不尝试重新解析
    const truncate = (data: unknown, maxLen = 5000): unknown => {
      if (data == null) return null;
      try {
        const str = typeof data === "string" ? data : JSON.stringify(data);
        if (str.length <= maxLen) return data;
        return str.substring(0, maxLen) + "...(truncated)";
      } catch {
        return String(data).substring(0, maxLen);
      }
    };

    const safeStringify = (data: unknown, maxLen = 5000): string => {
      try {
        const str = typeof data === "string" ? data : JSON.stringify(data);
        return str.substring(0, maxLen);
      } catch {
        return String(data).substring(0, maxLen);
      }
    };

    try {
      const eventStream = agent.streamEvents(
        {
          messages: [...history, new HumanMessage(userInput)],
        },
        {
          version: "v2",
          recursionLimit: 25,
        }
      );

      for await (const event of eventStream) {
        // --- Chain 事件 ---
        if (event.event === "on_chain_start") {
          spans.set(event.run_id, {
            runId: event.run_id,
            parentRunId: getCurrentParent(),
            type: "chain",
            name: event.name || "chain",
            input: truncate(event.data?.input),
            output: null,
            promptTokens: 0,
            completionTokens: 0,
            startedAt: new Date(),
            endedAt: null,
            durationMs: null,
            status: "success",
            errorMessage: null,
          });
          chainStack.push(event.run_id);
        }

        if (event.event === "on_chain_end") {
          const span = spans.get(event.run_id);
          if (span) {
            span.endedAt = new Date();
            span.durationMs = span.endedAt.getTime() - span.startedAt.getTime();
            span.output = truncate(event.data?.output);
          }
          // 从栈中弹出（可能不在栈顶，用 filter 安全移除）
          const idx = chainStack.lastIndexOf(event.run_id);
          if (idx !== -1) chainStack.splice(idx, 1);
        }

        // --- LLM 事件 ---
        if (event.event === "on_chat_model_start") {
          // 记录 LLM span，input 包含完整的输入 messages
          const inputMessages = event.data?.input?.messages;
          // 将 messages 序列化为可读格式
          const formattedInput = inputMessages
            ? (Array.isArray(inputMessages) ? inputMessages : [inputMessages]).flat().map((msg: any) => ({
                role: msg?.constructor?.name || msg?._getType?.() || "unknown",
                content: typeof msg?.content === "string"
                  ? msg.content.substring(0, 2000)
                  : safeStringify(msg?.content, 2000),
              }))
            : null;

          spans.set(event.run_id, {
            runId: event.run_id,
            parentRunId: getCurrentParent(),
            type: "llm",
            name: event.name || "ChatOpenAI",
            input: formattedInput,
            output: null,
            promptTokens: 0,
            completionTokens: 0,
            startedAt: new Date(),
            endedAt: null,
            durationMs: null,
            status: "success",
            errorMessage: null,
          });
        }

        if (event.event === "on_chat_model_stream") {
          const content = event.data.chunk?.content;
          if (content && typeof content === "string") {
            agentOutput += content;
            await writer.write(encoder.encode(content));
          }
        }

        if (event.event === "on_chat_model_end") {
          const output = event.data?.output;
          const span = spans.get(event.run_id);
          if (span) {
            span.endedAt = new Date();
            span.durationMs = span.endedAt.getTime() - span.startedAt.getTime();
            // 存储 LLM 输出内容
            const outputContent = output?.content;
            span.output = typeof outputContent === "string"
              ? outputContent.substring(0, 5000)
              : safeStringify(outputContent, 5000);
            // Token 用量
            const usage = output?.usage_metadata;
            if (usage) {
              span.promptTokens = usage.input_tokens ?? 0;
              span.completionTokens = usage.output_tokens ?? 0;
              totalPromptTokens += span.promptTokens;
              totalCompletionTokens += span.completionTokens;
            }
          }
        }

        // --- Tool 事件 ---
        if (event.event === "on_tool_start") {
          spans.set(event.run_id, {
            runId: event.run_id,
            parentRunId: getCurrentParent(),
            type: "tool",
            name: event.name || "tool",
            input: truncate(event.data?.input),
            output: null,
            promptTokens: 0,
            completionTokens: 0,
            startedAt: new Date(),
            endedAt: null,
            durationMs: null,
            status: "success",
            errorMessage: null,
          });
        }

        if (event.event === "on_tool_end") {
          const span = spans.get(event.run_id);
          if (span) {
            span.endedAt = new Date();
            span.durationMs = span.endedAt.getTime() - span.startedAt.getTime();
            span.output = safeStringify(event.data?.output, 5000);
          }
        }
      }

    } catch (e: any) {
      console.error("Agent error:", e);
      logStatus = "error";
      logError = e?.message ?? String(e);
      await writer.write(encoder.encode(`\n\n[系统提示]: 执行遇到错误，请重试。`));
    } finally {
      // 写入日志和 spans
      const durationMs = Date.now() - startTime;
      try {
        const [{ id: logId }] = await db.insert(chatLogs)
          .values({
            sessionId: sessionId ?? null,
            userInput,
            agentOutput: agentOutput.substring(0, 10000),
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: totalPromptTokens + totalCompletionTokens,
            toolCalls: null, // 不再写入扁平数组，使用 trace_spans
            durationMs,
            status: logStatus,
            errorMessage: logError,
          })
          .returning({ id: chatLogs.id });

        // 批量插入 trace spans
        const spanValues = Array.from(spans.values())
          .filter((s) => s.type === "llm" || s.type === "tool") // 只保留 llm 和 tool span，chain 太多噪音
          .map((s) => ({
            chatLogId: logId,
            runId: s.runId,
            parentRunId: s.parentRunId,
            type: s.type,
            name: s.name,
            input: s.input as any,
            output: s.output as any,
            promptTokens: s.promptTokens || null,
            completionTokens: s.completionTokens || null,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            durationMs: s.durationMs,
            status: s.status,
            errorMessage: s.errorMessage,
          }));

        if (spanValues.length > 0) {
          await db.insert(traceSpans).values(spanValues);
        }

        // 在流末尾写入 logId 标记，供前端解析
        await writer.write(encoder.encode(`\n__LOG_ID__:${logId}`));
        console.log("[LOG] 日志已保存, logId:", logId, "spans:", spanValues.length);
      } catch (err) {
        console.error("[LOG] 日志保存失败:", err);
      }

      await writer.close();
    }
  })();

  return stream.readable;
}