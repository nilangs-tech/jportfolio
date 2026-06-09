import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { parseStatement } from "@/lib/statementParser";

/**
 * Local-only statement parser.
 * POST multipart/form-data: portfolioId + file
 * Returns { ok, result: ParseResult } — preview only, nothing written yet.
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  try {
    const form = await req.formData();
    const portfolioId = String(form.get("portfolioId") ?? "portfolio_1");
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseStatement(buffer, file.name, portfolioId);

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
