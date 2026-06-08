import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { previewAmendment, type AmendmentRequest } from "@/lib/amendmentPreview";

/** Local-only: preview a proposed reconciliation amendment (no writes). */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;
  try {
    const body = (await req.json()) as AmendmentRequest;
    const preview = await previewAmendment(body);
    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
