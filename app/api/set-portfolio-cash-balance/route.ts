import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { readDataset, writeDataset } from "@/lib/data";
import { recalcAll } from "@/lib/recalcEngine";

/** Apply a statement-confirmed closing cash balance in local mode only. */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  let body: { portfolioId?: string; closingCash?: number; asOfDate?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const { portfolioId, closingCash, asOfDate } = body;
  if (
    (portfolioId !== "portfolio_1" && portfolioId !== "portfolio_2") ||
    typeof closingCash !== "number" ||
    !Number.isFinite(closingCash) ||
    closingCash < 0
  ) {
    return NextResponse.json({ ok: false, error: "A portfolio ID and non-negative closing cash balance are required." }, { status: 400 });
  }

  const summary = await readDataset("summary");
  const updated = summary.map((row) =>
    row.portfolio_id === portfolioId
      ? {
          ...row,
          closing_cash_total: closingCash,
          total_portfolio_value_at_market: (row.market_value_total ?? 0) + closingCash,
          as_of_date: asOfDate ?? row.as_of_date,
        }
      : row,
  );

  const portfolio1 = updated.find((row) => row.portfolio_id === "portfolio_1");
  const portfolio2 = updated.find((row) => row.portfolio_id === "portfolio_2");
  const combined = updated.find((row) => row.portfolio_id === "combined");
  if (portfolio1 && portfolio2 && combined) {
    const combinedCash = (portfolio1.closing_cash_total ?? 0) + (portfolio2.closing_cash_total ?? 0);
    combined.closing_cash_total = combinedCash;
    combined.total_portfolio_value_at_market = (combined.market_value_total ?? 0) + combinedCash;
    combined.as_of_date = asOfDate ?? combined.as_of_date;
  }

  await writeDataset("summary", updated);
  const recalc = await recalcAll();
  return NextResponse.json({
    ok: true,
    portfolioId,
    closingCash,
    filesWritten: ["summary.json", ...recalc.filesWritten],
  });
}
