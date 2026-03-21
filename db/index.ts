// db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 这里的 DATABASE_URL 依然读取你 .env.local 里的那个
const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });