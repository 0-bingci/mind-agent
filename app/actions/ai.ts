// app/actions/ai.ts
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

// 1. 初始化对话模型 (Kimi)
export const llm = new ChatOpenAI({
  apiKey: process.env.MODELSCOPE_API_KEY,
  configuration: {
    baseURL: "https://api-inference.modelscope.cn/v1",
  },
  modelName: "moonshotai/Kimi-K2.5",
  temperature: 0.3, // 总结任务建议低随机性
  maxTokens: 8192,
});

// 2. 初始化向量模型 (4096维)
export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.MODELSCOPE_API_KEY,
  modelName: "Qwen/Qwen3-Embedding-8B",
  configuration: {
    baseURL: "https://api-inference.modelscope.cn/v1",
  },
});