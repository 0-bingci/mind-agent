"use server";
// app/action/chat.ts
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createAgent } from "langchain";
import { z } from "zod";
import { llm, embeddings } from "./ai";
import { DynamicTool, tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { TavilySearchAPIWrapper, TavilyExtractAPIWrapper } from "@langchain/tavily";

// 初始化 Wrapper
const searchWrapper = new TavilySearchAPIWrapper({
  tavilyApiKey: process.env.TAVILY_API_KEY!,
});
const extractWrapper = new TavilyExtractAPIWrapper({
  tavilyApiKey: process.env.TAVILY_API_KEY!,
});

const checkpointer = new MemorySaver();

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
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabaseClient,
      tableName: "notes",
      queryName: "match_notes",
    });
    const docs = await vectorStore.similaritySearch(query, 3);
    return docs.map(d => `标题: ${d.metadata.title}\n内容: ${d.pageContent}`).join("\n\n");
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

## 强制约束
- 如果第一次搜索结果不理想，你**必须**进行至少第二次不同角度的搜索尝试。
- 在输出最终答案前，检查是否满足了用户所有的潜在需求（如：不仅找到了软件，还确认了它的图标特征）。
`;

// 在模块级别维护会话历史（生产环境建议存 Redis/DB）
const sessionHistories = new Map<string, BaseMessage[]>();

export async function askAgent(userInput: string, threadId: string = "default-user") {

  // ✅ 不传 checkpointer，完全手动管理
  const agent = createAgent({
    model: llm,
    tools: [searchNotesTool, searchWebTool, webExtractTool],
    systemPrompt: instructions,
    // checkpointer: checkpointer,  ← 删掉这行
  });

  // 读取当前会话的历史
  const history = sessionHistories.get(threadId) || [];

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      // 收集本轮产生的新消息，用于回写历史
      const newMessages: BaseMessage[] = [];

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
        if (event.event === "on_chat_model_stream") {
          const content = event.data.chunk?.content;
          if (content && typeof content === "string") {
            console.log("[STREAM CHUNK]:", content);
            await writer.write(encoder.encode(content));
          }
        }
        if (event.event === "on_chat_model_end") {
          const output = event.data?.output;
          console.log("[MODEL FULL OUTPUT]:", JSON.stringify(output, null, 2));
        }
        if (event.event === "on_tool_start") {
          console.log("[TOOL CALL]:", event.name, JSON.stringify(event.data?.input, null, 2));
        }

        if (event.event === "on_tool_end") {
          console.log("[TOOL RESULT]:", event.name, JSON.stringify(event.data?.output, null, 2));
        }

        // ✅ 捕获最终的 AI 回答消息，用于下轮历史
        if (event.event === "on_chain_end" && event.name === "agent") {
          const outputMessages = event.data?.output?.messages as BaseMessage[] | undefined;
          if (outputMessages) {
            // 只保留 HumanMessage 和无 tool_calls 的 AIMessage
            for (const msg of outputMessages) {
              if (msg instanceof AIMessage && !(msg.tool_calls?.length)) {
                newMessages.push(msg);
              }
            }
          }
        }
      }

      // ✅ 回写历史：旧历史 + 本轮用户输入 + 本轮 AI 最终回答
      sessionHistories.set(threadId, [
        ...history,
        new HumanMessage(userInput),
        ...newMessages,
      ]);

    } catch (e: any) {
      console.error("Agent error:", e);
      await writer.write(encoder.encode(`\n\n[系统提示]: 执行遇到错误，请重试。`));
    } finally {
      await writer.close();
    }
  })();

  return stream.readable;
}