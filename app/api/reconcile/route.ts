import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly, type LlmProvider } from "@/lib/config";
import { runReconciliation } from "@/lib/reconciliation";
import type { PortfolioId } from "@/lib/types";

/**
 * Local-only reconciliation trigger (hybrid: TS orchestrates the Python engine).
 * POST { portfolioIds?, provider?, runPythonFirst? }
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  let body: { portfolioIds?: PortfolioId[]; provider?: LlmProvider; runPythonFirst?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  try {
    const result = await runReconciliation({
      portfolioIds: body.portfolioIds,
      provider: body.provider,
      runPythonFirst: body.runPythonFirst ?? false,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
