import { NextRequest, NextResponse } from "next/server";
import { createPasteSchema } from "@/lib/validation";
import {
  encryptContent,
  generateContentKey,
  wrapKey,
  deriveKeyFromPassword,
} from "@/lib/crypto";
import { createPaste } from "@/lib/paste-service";
import { checkCreateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { result, active } = await checkCreateLimit(req);
  if (active && !result.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPasteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  let contentKey: Buffer;
  let salt: Buffer | null = null;
  let kdfIterations: number | null = null;
  const password = input.password?.trim() ?? "";

  if (password) {
    const derived = deriveKeyFromPassword(password);
    contentKey = derived.key;
    salt = derived.salt;
    kdfIterations = 210_000;
  } else {
    contentKey = generateContentKey();
  }

  const { ciphertext, iv, authTag } = encryptContent(
    contentKey,
    Buffer.from(input.content, "utf8")
  );

  const keyWrapped = wrapKey(contentKey);

  let paste;
  try {
    paste = await createPaste({
      ciphertext,
      iv,
      authTag,
      keyWrapped,
      salt,
      kdfIterations,
      burnAfterRead: input.burnAfterRead,
      expiresIn: input.expiresIn,
    });
  } catch (e) {
    console.error("createPaste failed", e);
    return NextResponse.json({ error: "Failed to create paste" }, { status: 500 });
  }

  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return NextResponse.json(
    { code: paste.code, url: `${base}/${paste.code}` },
    { status: 201 }
  );
}
