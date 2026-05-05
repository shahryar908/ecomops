import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { CREATE_TABLES_SQL } from './schema.js';

const client = postgres(process.env.DATABASE_URL, { max: 10 });
export const db = drizzle(client);

export async function ensureTables() {
  await client.unsafe(CREATE_TABLES_SQL);
}
