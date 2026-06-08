import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { applyAmendment, type AmendmentRequest } from "@/lib/amendmentPreview";

/**
 * Local-only: apply a previously previewed amendment. Requires explicit approved=true.
 * Records a decision in reconciliation-decisions.json.
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;
  try {
    const body = (await req.json()) as AmendmentRequest & { approved?: boolean };
    if (!body.approved) {
      return NextResponse.json({ ok: false, error: "Amendment must be explicitly approved (approved:true)." }, { status: 400 });
    }
    const result = await applyAmendment(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
