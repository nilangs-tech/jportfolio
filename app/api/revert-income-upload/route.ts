import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { readDataset, writeDataset } from "@/lib/data";
import { recalcAll } from "@/lib/recalcEngine";

/**
 * Local-only rollback for one merged income statement. It removes only the
 * dividends associated with the requested source file and reverses their
 * effect on the affected portfolio's dividend total.
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  let body: { portfolioId?: string; source?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const { portfolioId, source } = body;
  if ((portfolioId !== "portfolio_1" && portfolioId !== "portfolio_2") || !source) {
    return NextResponse.json({ ok: false, error: "A portfolio ID and source filename are required." }, { status: 400 });
  }

  const dividends = await readDataset("dividends-received");
  const removed = dividends.filter((row) => row.portfolio_id === portfolioId && row.source === source);
  if (removed.length === 0) {
    return NextResponse.json({ ok: false, error: "No matching income records were found." }, { status: 404 });
  }

  const removedTotal = removed.reduce((sum, row) => sum + (row.cash_received ?? 0), 0);
  const remaining = dividends.filter((row) => row.portfolio_id !== portfolioId || row.source !== source);
  await writeDataset("dividends-received", remaining);

  const summary = await readDataset("summary");
  const updatedSummary = summary.map((row) =>
    row.portfolio_id === portfolioId
      ? { ...row, dividends_received_total: Math.max(0, (row.dividends_received_total ?? 0) - removedTotal) }
      : row,
  );
  const portfolio1 = updatedSummary.find((row) => row.portfolio_id === "portfolio_1");
  const portfolio2 = updatedSummary.find((row) => row.portfolio_id === "portfolio_2");
  const combined = updatedSummary.find((row) => row.portfolio_id === "combined");
  if (portfolio1 && portfolio2 && combined) {
    combined.dividends_received_total =
      (portfolio1.dividends_received_total ?? 0) + (portfolio2.dividends_received_total ?? 0);
  }
  await writeDataset("summary", updatedSummary);

  // Refresh dependent bridge data without applying any new transactions.
  const recalc = await recalcAll();
  return NextResponse.json({
    ok: true,
    removed: { dividends: removed.length, total: removedTotal },
    filesWritten: ["dividends-received.json", ...recalc.filesWritten],
  });
}
