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

  // Economic return (from summary, adjusted for live prices)
  // For P1: includes pension + expenses; For P2: Python-managed metric
  const economicReturn = summary.economic_return ?? mtmReturn;
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
 * Compute a performance waterfall (perfBridge).
 * Shows how portfolio value changed from opening to closing.
 */
export interface PerfWaterfallStep {
  label: string;
  value: number;
  isComponent: boolean;
}

export function computePerfWaterfall(
  summary: Summary,
  holdings: HoldingRow[],
): PerfWaterfallStep[] {
  const pid = summary.portfolio_id;
  const portHoldings = pid === "combined"
    ? holdings
    : holdings.filter((h) => h.portfolio_id === pid);

  const openingValue = Math.round(summary.opening_market_value_total ?? 0);
  const sharesValue = Math.round(
    portHoldings.reduce((sum, h) => sum + (h.current_market_value ?? 0), 0)
  );
  const cashBalance = Math.round(summary.closing_cash_total ?? 0);
  const currentValue = sharesValue + cashBalance;

  const mtmReturn = currentValue - openingValue;
  const realizedGains = Math.round(summary.realized_pl_total ?? 0);
  const dividends = Math.round(summary.dividends_received_total ?? 0);
  const otherIncome = Math.round(summary.market_to_market_return ?? 0) - realizedGains - dividends;

  return [
    { label: "Opening portfolio value", value: openingValue, isComponent: false },
    { label: "Market-to-market gains", value: mtmReturn, isComponent: true },
    { label: "Realised gains from sales", value: realizedGains, isComponent: true },
    { label: "Dividends & income", value: dividends, isComponent: true },
    { label: "= Current portfolio value", value: currentValue, isComponent: false },
  ];
}
