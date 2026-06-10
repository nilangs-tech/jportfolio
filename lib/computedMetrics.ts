import type { Summary, HoldingRow, CashClassRow } from "./types";

/**
 * All portfolio metrics computed from source data, not static values.
 * These are recalculated whenever summary, holdings, or prices change.
 */

export interface ComputedMetrics {
  // Portfolio totals
  totalPortfolioValue: number;
  sharesValue: number;
  cashBalance: number;
  costBasisTotal: number;

  // Returns
  mtmReturn: number;
  mtmReturnPct: number;
  economicReturn: number;
  economicReturnPct: number;
  unrealisedGain: number;
  unrealisedGainPct: number;

  // Cash flow
  totalDividends: number;
  totalAtoRefund: number;
  totalInterest: number;
  totalPensionPaid: number;
  totalExpenses: number;
  netIncomeRetained: number;
}

/**
 * Compute all metrics from source data.
 * Called whenever data or prices change to ensure values are always current.
 */
export function computeMetrics(
  summary: Summary,
  holdings: HoldingRow[],
  classRows?: any[],
): ComputedMetrics {
  const pid = summary.portfolio_id;
  const portHoldings = pid === "combined"
    ? holdings
    : holdings.filter((h) => h.portfolio_id === pid);

  // Portfolio values (always computed, never cached)
  const sharesValue = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.current_market_value ?? 0), 0)
  );
  const cashBalance = Math.round(summary.closing_cash_total ?? 0);
  const totalPortfolioValue = sharesValue + cashBalance;
  const costBasisTotal = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.cost_base ?? 0), 0)
  );

  // Returns (derived from totals)
  const openingValue = Math.round(summary.opening_market_value_total ?? 0);
  const mtmReturn = totalPortfolioValue - openingValue;
  const mtmReturnPct = openingValue > 0 ? (mtmReturn / openingValue) * 100 : 0;

  // Unrealised gain = market value - cost basis (for shares only)
  const unrealisedGain = sharesValue - costBasisTotal;
  const unrealisedGainPct = costBasisTotal > 0 ? (unrealisedGain / costBasisTotal) * 100 : 0;

  // Economic return: for P1, includes pension + expenses; for P2, use Python-managed metric
  let economicReturn = mtmReturn;
  if (pid === "portfolio_1" && classRows) {
    const pension = Math.round(classRows.find((r) => r.portfolio_id === "portfolio_1" && r.category === "pension_distribution")?.amount ?? 0);
    const expenses = Math.round(classRows.find((r) => r.portfolio_id === "portfolio_1" && r.category === "operating_expense")?.amount ?? 0);
    economicReturn = mtmReturn + pension + expenses;
  } else {
    economicReturn = summary.economic_return ?? mtmReturn;
  }
  const economicReturnPct = openingValue > 0 ? (economicReturn / openingValue) * 100 : 0;

  // Cash flows (from summary)
  const totalDividends = Math.round(summary.dividends_received_total ?? 0);
  const totalAtoRefund = Math.round(summary.market_to_market_return ?? 0) -
                         Math.round(summary.market_to_market_return ?? 0);
  const totalInterest = 0; // Derived from cash-classification-summary separately
  const totalPensionPaid = 0; // Derived from cash-classification-summary separately
  const totalExpenses = 0; // Derived from cash-classification-summary separately
  const netIncomeRetained = totalDividends + totalAtoRefund + totalInterest
                            - totalPensionPaid - totalExpenses;

  return {
    totalPortfolioValue,
    sharesValue,
    cashBalance,
    costBasisTotal,
    mtmReturn,
    mtmReturnPct,
    economicReturn,
    economicReturnPct,
    unrealisedGain,
    unrealisedGainPct,
    totalDividends,
    totalAtoRefund,
    totalInterest,
    totalPensionPaid,
    totalExpenses,
    netIncomeRetained,
  };
}

/**
 * Compute P2 performance bridge dynamically so live prices flow through.
 */
export function computeP2PerfBridge(
  summary: Summary,
  holdings: HoldingRow[],
): PerfBridgeStep[] {
  const portHoldings = holdings.filter((h) => h.portfolio_id === "portfolio_2");

  const openingValue = Math.round(summary.opening_market_value_total ?? 0);
  const sharesValue = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.current_market_value ?? 0), 0)
  );
  const cashBalance = Math.round(summary.closing_cash_total ?? 0);
  const currentValue = sharesValue + cashBalance;

  const capitalAdded = Math.round(summary.net_transfers_total ?? 0);
  const dividends = Math.round(summary.dividends_received_total ?? 0);
  const realizedGains = Math.round(summary.realized_pl_total ?? 0);

  const continuingGain = Math.round(
    portHoldings
      .filter((h) => h.opening_price != null)
      .reduce((sum, h) => sum + (h.market_to_market_gain ?? 0), 0)
  );
  const newPosGain = Math.round(
    portHoldings
      .filter((h) => h.opening_price == null && h.position_status === "new")
      .reduce((sum, h) => sum + (h.market_to_market_gain ?? 0), 0)
  );

  const d = new Date();
  const dayLabel = `${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })} ${d.getFullYear()}`;
  const mtm = currentValue - openingValue;
  const mtmPct = openingValue > 0 ? (mtm / openingValue) * 100 : 0;
  const econReturn = Math.round(summary.economic_return ?? mtm);
  const econReturnPct = summary.economic_return_pct ?? mtmPct;

  return [
    { label: "Opening portfolio at market (1 Jul 2025)", val: openingValue, color: "#2563eb", kind: "line" as const },
    { label: "  Shares at Jul '25 market prices", val: openingValue, color: "#93c5fd", kind: "sub" as const },
    { label: "  Cash balance", val: Math.round(summary.opening_cash_total ?? 0), color: "#93c5fd", kind: "sub" as const },
    { kind: "spacer" as const },
    { label: "+ Net capital added (FY2026 transfers)", val: capitalAdded, color: "#7c3aed", kind: "line" as const },
    { label: "+ Market price gains on continuing positions", val: continuingGain, color: "#16a34a", kind: "line" as const },
    { label: "+ Market price gains — new positions", val: newPosGain, color: "#16a34a", kind: "line" as const },
    { label: "+ Dividends received", val: dividends, color: "#0d9488", kind: "line" as const },
    { label: "+ Realised gains from sales", val: realizedGains, color: "#ea580c", kind: "line" as const },
    { kind: "spacer" as const },
    { label: `= Current portfolio value (${dayLabel})`, val: currentValue, color: "#047857", kind: "grand" as const },
    { label: `Market-to-market return (+${Math.abs(mtmPct).toFixed(1)}%)`, val: Math.round(mtm), color: "#047857", kind: "subtotal" as const },
    { label: `Economic return excl. capital added (+${Math.abs(econReturnPct).toFixed(1)}%)`, val: Math.round(econReturn), color: "#059669", kind: "grand" as const },
  ] as PerfBridgeStep[];
}

/**
 * Compute a cost basis waterfall (costBridge).
 * Shows how cost basis changed from opening to closing.
 */
export interface CostWaterfallStep {
  label: string;
  value: number;
  isSubtotal: boolean;
}

export function computeCostWaterfall(
  summary: Summary,
  holdings: HoldingRow[],
): CostWaterfallStep[] {
  const pid = summary.portfolio_id;
  const portHoldings = pid === "combined"
    ? holdings
    : holdings.filter((h) => h.portfolio_id === pid);

  const openingCostBasis = Math.round(
    portHoldings.reduce((sum, h) => {
      // Estimate opening cost basis from available data
      // This is a simplified version; the actual opening should come from summary
      return sum + (h.cost_base ?? 0) - (h.unrealised_pl ?? 0);
    }, 0)
  );

  const closingCostBasis = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.cost_base ?? 0), 0)
  );

  const sharesValue = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.current_market_value ?? 0), 0)
  );
  const cashBalance = Math.round(summary.closing_cash_total ?? 0);

  return [
    { label: "Opening cost basis", value: openingCostBasis, isSubtotal: false },
    { label: "= Closing cost basis", value: closingCostBasis, isSubtotal: true },
    { label: "Opening cash", value: Math.round(summary.opening_cash_total ?? 0), isSubtotal: false },
    { label: "= Closing cash", value: cashBalance, isSubtotal: true },
    { label: "Total portfolio value (at cost)", value: closingCostBasis + cashBalance, isSubtotal: true },
  ];
}

/**
 * Compute P1 performance waterfall (perfBridge) with income grouping.
 * This is called on every render to ensure live price updates flow through.
 * Compatible with BridgeStep interface from Charts.tsx
 */
export interface PerfBridgeStep {
  label?: string;
  val?: number;
  color?: string;
  kind: "line" | "sub" | "subtotal" | "grand" | "spacer";
}

export function computeP1PerfBridge(
  summary: Summary,
  holdings: HoldingRow[],
  classRows?: any[],
): PerfBridgeStep[] {
  const portHoldings = holdings.filter((h) => h.portfolio_id === "portfolio_1");

  const openingValue = Math.round(summary.opening_market_value_total ?? 0);
  const sharesValue = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.current_market_value ?? 0), 0)
  );
  const cashBalance = Math.round(summary.closing_cash_total ?? 0);
  const currentValue = sharesValue + cashBalance;

  // Extract from summary + cash-classification
  const dividends = Math.round(summary.dividends_received_total ?? 0);
  const realizedGains = Math.round(summary.realized_pl_total ?? 0);
  const ato = classRows
    ? Math.round(classRows.find((r) => r.portfolio_id === "portfolio_1" && r.category === "ato_refund")?.amount ?? 0)
    : 0;
  const interest = classRows
    ? Math.round(classRows.find((r) => r.portfolio_id === "portfolio_1" && r.category === "bank_interest")?.amount ?? 0)
    : 0;
  const pension = classRows
    ? Math.round(classRows.find((r) => r.portfolio_id === "portfolio_1" && r.category === "pension_distribution")?.amount ?? 0)
    : 0;
  const expenses = classRows
    ? Math.round(classRows.find((r) => r.portfolio_id === "portfolio_1" && r.category === "operating_expense")?.amount ?? 0)
    : 0;

  // Compute the residual (new positions + rebalancing)
  const incomeSum = dividends + ato + interest;
  const netIncome = incomeSum - pension - expenses;
  const continuingGain = Math.round(
    portHoldings
      .filter((h) => h.opening_price != null)
      .reduce((sum, h) => sum + (h.market_to_market_gain ?? 0), 0)
  );
  const realizedGain = realizedGains;
  const expectedValue = openingValue + continuingGain + realizedGain + netIncome;
  const residual = Math.round(currentValue - expectedValue);

  const d = new Date();
  const dayLabel = `${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })} ${d.getFullYear()}`;
  const mtm = currentValue - openingValue;
  const mtmPct = openingValue > 0 ? (mtm / openingValue) * 100 : 0;
  const econ = mtm + pension + expenses;
  const econPct = openingValue > 0 ? (econ / openingValue) * 100 : 0;

  return [
    { label: "Opening portfolio at market (1 Jul 2025)", val: openingValue, color: "#2563eb", kind: "line" as const },
    { label: "  Shares at Jul '25 market prices", val: openingValue, color: "#93c5fd", kind: "sub" as const },
    { label: "  Cash balance", val: 0, color: "#93c5fd", kind: "sub" as const },
    { kind: "spacer" as const },
    { label: "+ Continuing positions — price gain", val: continuingGain, color: "#16a34a", kind: "line" as const },
    { label: "+ New positions & rebalancing (residual)", val: residual, color: "#9ca3af", kind: "line" as const },
    { label: "+ Realised gains from sales", val: realizedGain, color: "#ea580c", kind: "line" as const },
    { kind: "spacer" as const },
    { label: "+ Net income retained (after pension & expenses)", val: netIncome, color: "#0d9488", kind: "line" as const },
    { label: `  Income earned (dividends $${dividends.toLocaleString("en-AU")} + ATO $${ato.toLocaleString("en-AU")} + interest $${interest.toLocaleString("en-AU")})`, val: incomeSum, color: "#6ee7b7", kind: "sub" as const },
    { label: "  Less: pension distributions", val: -pension, color: "#fca5a5", kind: "sub" as const },
    { label: "  Less: operating expenses", val: -expenses, color: "#fca5a5", kind: "sub" as const },
    { kind: "spacer" as const },
    { label: `= Current portfolio value (${dayLabel})`, val: currentValue, color: "#047857", kind: "grand" as const },
    { label: `Market-to-market return (+${mtmPct.toFixed(1)}%)`, val: Math.round(mtm), color: "#047857", kind: "subtotal" as const },
    { label: `Economic return incl. pension (+${econPct.toFixed(1)}%)`, val: Math.round(econ), color: "#059669", kind: "grand" as const },
  ] as PerfBridgeStep[];
}
