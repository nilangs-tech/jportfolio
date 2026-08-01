import { readDataset } from "@/lib/data";
import { readUiSeries, type UiSeries } from "@/lib/uiSeries";
import { APP_MODE } from "@/lib/config";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic"; // always read latest JSON

const EMPTY_SERIES: UiSeries["portfolio_1"] = {
  divByMonth: {}, topDivPayers: [], months: [], buys: [], sells: [], costBridge: [], perfBridge: [], expenses: [],
};

/** Latest transaction date actually affecting cash, per portfolio — not the statement/reconciliation cutoff. */
function latestCashDates(
  cashLedger: { portfolio_id: string; date: string }[],
  transactions: { portfolio_id: string; date: string }[],
  dividends: { portfolio_id: string; payment_date: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const bump = (pid: string, d: string | undefined) => {
    if (d && (!out[pid] || d > out[pid])) out[pid] = d;
  };
  for (const r of cashLedger) bump(r.portfolio_id, r.date);
  for (const r of transactions) bump(r.portfolio_id, r.date);
  for (const r of dividends) bump(r.portfolio_id, r.payment_date);
  return out;
}

export default async function Home() {
  const [summary, performance, holdings, positions, ui, cashClass, cashLedger, transactions, dividends, fy2026Final] = await Promise.all([
    readDataset("summary"),
    readDataset("performance-summary"),
    readDataset("average-cost-summary"),
    readDataset("position-changes"),
    readUiSeries(),
    readDataset("cash-classification-summary"),
    readDataset("cash-ledger"),
    readDataset("transactions"),
    readDataset("dividends-received"),
    readDataset("fy2026-final"),
  ]);

  const asOf = summary.find((s) => s.portfolio_id === "combined")?.as_of_date ?? "—";
  const uiSeries: UiSeries = ui ?? { portfolio_1: EMPTY_SERIES, portfolio_2: EMPTY_SERIES };
  const lastCashDate = latestCashDates(cashLedger, transactions, dividends);

  return (
    <Dashboard
      summary={summary}
      performance={performance}
      holdings={holdings}
      positions={positions}
      uiSeries={uiSeries}
      asOf={asOf}
      mode={APP_MODE}
      cashClassification={cashClass}
      lastCashDate={lastCashDate}
      fy2026Final={fy2026Final}
    />
  );
}
