import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { Readable } from "node:stream";
import { createDecipheriv } from "node:crypto";
import { createInflate } from "node:zlib";
import {
  getPasteByCode,
  getAttachmentById,
  deletePaste,
  deleteAttachmentsBlobs,
} from "@/lib/paste-service";
import { unwrapKey, deriveKeyFromPassword } from "@/lib/crypto";
import { checkReadLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALGO = "aes-256-gcm";

function safeFilename(name: string): string {
  return name.replace(/["\r\n]/g, "_");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await params;

  const { result, active } = await checkReadLimit(req);
  if (active && !result.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const paste = await getPasteByCode(code);
  if (!paste) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (paste.expiresAt && paste.expiresAt.getTime() < Date.now()) {
    await deletePaste(code);
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }

  if (paste.burnAfterRead && paste.consumed) {
    return NextResponse.json({ error: "Gone" }, { status: 410 });
  }

  const attachment = await getAttachmentById(code, id);
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let contentKey: Buffer;
  try {
    if (paste.salt) {
      const password = req.headers.get("x-paste-password") ?? "";
      contentKey = deriveKeyFromPassword(password, Buffer.from(paste.salt)).key;
    } else {
      contentKey = unwrapKey(Buffer.from(paste.keyWrapped));
    }
  } catch {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const blob = await get(attachment.blobPath, { access: "private" });
  if (!blob || !blob.stream) {
    return NextResponse.json({ error: "File unavailable" }, { status: 500 });
  }
  const blobStream: ReadableStream = blob.stream;

  const decipher = createDecipheriv(
    ALGO,
    contentKey,
    Buffer.from(attachment.iv)
  );
  decipher.setAuthTag(Buffer.from(attachment.authTag));

  try {
    const decrypted = Readable.fromWeb(
      blobStream as Parameters<typeof Readable.fromWeb>[0]
    ).pipe(decipher);
    const plain =
      attachment.compression === "deflate"
        ? decrypted.pipe(createInflate())
        : decrypted;

    const isBurn = paste.burnAfterRead;
    if (isBurn) {
      await deleteAttachmentsBlobs(code);
      await deletePaste(code);
    }

    const headers = new Headers();
    headers.set("Content-Type", attachment.mime);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeFilename(attachment.filename)}"`
    );
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(
      Readable.toWeb(plain) as unknown as BodyInit,
      { headers }
    );
  } catch {
    return NextResponse.json({ error: "Decryption failed" }, { status: 500 });
  }
}