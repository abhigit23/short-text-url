import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Paste, NewPaste } from "@/db/schema";
import { generateUniqueCode, shortId } from "./ids";

const EXPIRY_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export type CreatePasteArgs = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyWrapped: Buffer;
  salt?: Buffer | null;
  kdfIterations?: number | null;
  burnAfterRead: boolean;
  expiresIn: string;
};

export function getExpiryDate(expiresIn: string): Date | null {
  const ms = EXPIRY_MS[expiresIn];
  return ms ? new Date(Date.now() + ms) : null;
}

export async function createPaste(args: CreatePasteArgs): Promise<Paste> {
  if (!db) throw new Error("Database not configured");
  const d = db;
  const expiresAt = getExpiryDate(args.expiresIn);

  const code = await generateUniqueCode(async (c) => {
    const rows = await d
      .select({ code: schema.pastes.code })
      .from(schema.pastes)
      .where(eq(schema.pastes.code, c))
      .limit(1);
    return rows.length > 0;
  });

  const row: NewPaste = {
    code,
    ciphertext: args.ciphertext,
    iv: args.iv,
    authTag: args.authTag,
    keyWrapped: args.keyWrapped,
    salt: args.salt ?? null,
    kdfIterations: args.kdfIterations ?? null,
    burnAfterRead: args.burnAfterRead,
    consumed: false,
    expiresAt,
    views: 0,
  };

  await d.insert(schema.pastes).values(row);
  return (await getPasteByCode(code))!;
}

export async function getPasteByCode(code: string): Promise<Paste | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.pastes)
    .where(eq(schema.pastes.code, code))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Deletes a paste row. Returns true if a row was removed.
 */
export async function deletePaste(code: string): Promise<boolean> {
  if (!db) return false;
  const res = await db
    .delete(schema.pastes)
    .where(eq(schema.pastes.code, code));
  return Number(res.count) > 0;
}

/**
 * Increments the view counter for a paste.
 */
export async function incrementViews(code: string): Promise<void> {
  if (!db) return;
  await db
    .update(schema.pastes)
    .set({ views: sql`${schema.pastes.views} + 1` })
    .where(eq(schema.pastes.code, code));
}

/**
 * Removes all expired pastes. Used by the cleanup job.
 */
export async function deleteExpiredPastes(): Promise<number> {
  if (!db) return 0;
  const res = await db
    .delete(schema.pastes)
    .where(sql`${schema.pastes.expiresAt} < now()`);
  return Number(res.count);
}
