// app/actions/ai.ts
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

// 1. 初始化对话模型（支持任意 OpenAI 兼容 API）
export const llm = new ChatOpenAI({
  apiKey: process.env.LLM_API_KEY,
  configuration: {
    baseURL: process.env.LLM_BASE_URL,
  },
  modelName: process.env.LLM_MODEL_NAME || "moonshotai/Kimi-K2.5",
  temperature: 0.3,
  maxTokens: 8192,
});

// 2. 初始化向量模型（支持任意 OpenAI 兼容 API）
export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY,
  modelName: process.env.EMBEDDING_MODEL_NAME || "Qwen/Qwen3-Embedding-8B",
  configuration: {
    baseURL: process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL,
  },
});