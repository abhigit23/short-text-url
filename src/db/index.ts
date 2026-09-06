import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return undefined;
  }

  if (globalForDb.client) return globalForDb.client;

  const client = postgres(connectionString, {
    ssl: connectionString.includes("sslmode=require") ? false : undefined,
    max: 10,
  });

  if (process.env.NODE_ENV !== "production") globalForDb.client = client;
  return client;
}

const client = getClient();

export const db = client ? drizzle(client, { schema }) : null;
export { schema };
