// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts', // 告诉它蓝图在哪
  out: './drizzle',         // 自动生成的迁移文件放哪
  dialect: 'postgresql',    // 数据库类型
  dbCredentials: {
    // 这里会读取你 .env.local 里的 DATABASE_URL
    url: process.env.DATABASE_URL!,
  },
});