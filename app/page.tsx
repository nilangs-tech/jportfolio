import { readDataset } from "@/lib/data";
import { readUiSeries, type UiSeries } from "@/lib/uiSeries";
import { APP_MODE } from "@/lib/config";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic"; // always read latest JSON

const EMPTY_SERIES: UiSeries["portfolio_1"] = {
  divByMonth: {}, topDivPayers: [], months: [], buys: [], sells: [], costBridge: [], perfBridge: [], expenses: [],
};

export default async function Home() {
  const [summary, performance, holdings, positions, ui] = await Promise.all([
    readDataset("summary"),
    readDataset("performance-summary"),
    readDataset("average-cost-summary"),
    readDataset("position-changes"),
    readUiSeries(),
  ]);

  const asOf = summary.find((s) => s.portfolio_id === "combined")?.as_of_date ?? "—";
  const uiSeries: UiSeries = ui ?? { portfolio_1: EMPTY_SERIES, portfolio_2: EMPTY_SERIES };

  return (
    <Dashboard
      summary={summary}
      performance={performance}
      holdings={holdings}
      positions={positions}
      uiSeries={uiSeries}
      asOf={asOf}
      mode={APP_MODE}
    />
  );
}
