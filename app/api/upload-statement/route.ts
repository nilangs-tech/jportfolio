import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { saveStatement } from "@/lib/statementStorage";

/**
 * Local-only statement upload. Saves the file into the correct vault folder
 * (Portfolio 1 -> JSAF, Portfolio 2 -> Ind). Multipart form: portfolioId + file(s).
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  try {
    const form = await req.formData();
    const portfolioId = String(form.get("portfolioId") ?? "portfolio_1");
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ ok: false, error: "No files provided." }, { status: 400 });

    const saved: string[] = [];
    for (const f of files) {
      const bytes = Buffer.from(await f.arrayBuffer());
      saved.push(await saveStatement(portfolioId, f.name, bytes));
    }
    return NextResponse.json({ ok: true, saved, count: saved.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
