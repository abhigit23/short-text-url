import { NextRequest, NextResponse } from "next/server";
import { deleteExpiredPastes } from "@/lib/paste-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await deleteExpiredPastes();
  return NextResponse.json({ ok: true, deleted });
}
