import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { readDataset, writeDataset } from "./data";
import type { HoldingRow, TransactionRow, DividendRow, CashLedgerRow, Summary, CashClassRow } from "./types";
import type { ExpenseItem, UiSeries } from "./uiSeries";
import { detectReversals, reversedDebitKeys } from "./statementParser/reversals";

// ─── Safety invariants ────────────────────────────────────────────────────────
//
// These rules prevent the engine from silently corrupting Python-calculated
// values with smaller, incorrect numbers derived from our sparse local files.
//
// CUMULATIVE fields (dividends, realized P&L):
//   These only ever grow. A new value lower than the existing one means we
//   lost history — refuse the update and keep the existing value.
//
// CASH fields (closing_cash_total):
//   Can legitimately go down (money was spent), BUT only if we have a named
//   broker with a positive balance driving the update.  A computed value of
//   zero or lower than 10% of the current value is suspicious — keep existing.
//
// HOLDINGS metrics (cost_base, market_value, MTM):
//   Derived directly from holdings.json which Python keeps authoritative.
//   No extra guard needed — if holdings.json is correct, these will be too.

/** For cumulative totals: never let the new value be lower than the old one. */
function neverDecrease(existing: number | undefined, next: number): number {
  const e = existing ?? 0;
  if (next < e) {
    console.warn(
      `[recalcEngine] Blocked decrease: existing=${e.toFixed(2)}, proposed=${next.toFixed(2)}. Keeping existing.`
    );
    return e;
  }
  return next;
}

/** For cash: only accept the new value if it is plausibly real (> 0 and not
 *  suspiciously smaller than 20% of the existing value). */
function plausibleCash(existing: number | undefined, next: number): number {
  const e = existing ?? 0;
  if (next <= 0) {
    // Computed zero usually means no named-broker rows — don't wipe the real value.
    console.warn(
      `[recalcEngine] Blocked cash update to zero; existing=${e.toFixed(2)}. Keeping existing.`
    );
    return e;
  }
  if (e > 1000 && next < e * 0.2) {
    // More than 80% drop is suspicious — log and keep existing.
    console.warn(
      `[recalcEngine] Suspicious cash drop: ${e.toFixed(2)} → ${next.toFixed(2)} (>80% decrease). Keeping existing.`
    );
    return e;
  }
  return next;
}

/**
 * Recalculation engine — called after every merge operation.
 *
 * Philosophy:
 *  ─ Holdings-based metrics (cost_base_total, market_value_total, MTM) are
 *    always recalculated from holdings.json — Python keeps that file current.
 *  ─ closing_cash_total is summed from the latest balance per broker in
 *    cash-ledger.json.  CommBank (pension account), CommSec (brokerage, usually
 *    zero), and Stake all contribute.  Only updated when new cash rows were added.
 *  ─ dividends_received_total uses a DELTA approach: existing Python value +
 *    newly merged dividend amounts.  We never re-sum the sparse file because
 *    dividends-received.json only has recent Stake rows, not the full history.
 *  ─ Python-managed fields (opening_*, economic_return, realized_pl_total*,
 *    net_transfers_total) are never touched — they need a full Python re-run.
 *    * realized_pl_total gets the Python value plus newly calculated realized P&L
 *      from new sell trades.
 *  ─ Combined row is always rebuilt as P1 + P2 sums.
 */

export interface RecalcResult {
  filesWritten: string[];
  changes: Record<string, unknown>;
}

// ─── Cash balance ─────────────────────────────────────────────────────────────
// For each portfolio: find the latest balance row per broker, then sum them.
// P1 has CommBank (pension account) + Stake + CommSec (usually 0).
// Only rows with a non-null balance and a non-empty broker are counted.

function calcClosingCash(ledger: CashLedgerRow[], portfolioId: string): number {
  const rows = ledger.filter(
    (r) => r.portfolio_id === portfolioId && r.broker && r.balance != null
  );
  if (rows.length === 0) return 0;

  // Latest row per broker
  const byBroker: Record<string, CashLedgerRow> = {};
  for (const r of rows) {
    const existing = byBroker[r.broker];
    // Use >= so that when two entries share the same date, the one that appears
    // later in the file (i.e. the chronologically last transaction of that day)
    // wins — e.g. a reversal credit followed by a pension debit on the same day.
    if (!existing || r.date >= existing.date) byBroker[r.broker] = r;
  }

  return Object.values(byBroker).reduce((sum, r) => sum + (r.balance ?? 0), 0);
}

// ─── Holdings recalculation from a new trade ─────────────────────────────────

export function applyTradeToHoldings(
  holdings: HoldingRow[],
  trade: TransactionRow,
): { holdings: HoldingRow[]; realizedPl: number } {
  const idx = holdings.findIndex(
    (h) => h.symbol === trade.symbol && h.portfolio_id === trade.portfolio_id
  );
  let realizedPl = 0;
  const updated = [...holdings];

  if (trade.type === "buy") {
    const tradeCost = (trade.price ?? 0) * (trade.units ?? 0) + (trade.fees ?? 0);
    if (idx >= 0) {
      const h = { ...updated[idx] };
      const newUnits = (h.units ?? 0) + (trade.units ?? 0);
      const newCostBase = (h.cost_base ?? 0) + tradeCost;
      h.units = newUnits;
      h.cost_base = newCostBase;
      h.avg_cost = newUnits > 0 ? newCostBase / newUnits : 0;
      const mv = (h.current_price ?? 0) * newUnits;
      h.current_market_value = mv;
      h.unrealised_pl = mv - newCostBase;
      const op = h.opening_price ?? null;
      const cu = h.continuing_mtm_units ?? null;
      const refPrice = op ?? (newCostBase > 0 ? newCostBase / newUnits : null);
      const refUnits = op !== null ? (cu ?? newUnits) : newUnits;
      h.market_to_market_gain = (refPrice !== null && h.current_price != null) ? (h.current_price - refPrice) * refUnits : null;
      h.market_to_market_pct = (refPrice !== null && refPrice > 0 && h.current_price != null) ? ((h.current_price - refPrice) / refPrice) * 100 : null;
      updated[idx] = h;
    } else {
      // New position — no FY opening price; MTM is vs avg cost (performance since purchase)
      const newPosUnits = trade.units ?? 0;
      const newPosAvg = newPosUnits > 0 ? tradeCost / newPosUnits : 0;
      const newPosCurrPrice = trade.price ?? 0;
      updated.push({
        portfolio_id: trade.portfolio_id,
        broker: trade.broker ?? "",
        symbol: trade.symbol ?? "",
        name: trade.symbol ?? "",
        units: newPosUnits,
        cost_base: tradeCost,
        avg_cost: newPosAvg,
        current_price: newPosCurrPrice,
        current_market_value: tradeCost,
        unrealised_pl: 0,
        market_to_market_gain: newPosAvg > 0 ? (newPosCurrPrice - newPosAvg) * newPosUnits : null,
        market_to_market_pct: newPosAvg > 0 ? ((newPosCurrPrice - newPosAvg) / newPosAvg) * 100 : null,
        position_status: "new",
        price_status: "unavailable",
        cost_status: "complete",
      } as HoldingRow);
    }
  } else if (trade.type === "sell" && idx >= 0) {
    const h = { ...updated[idx] };
    const soldUnits = trade.units ?? 0;
    const avgCost = (h.units ?? 0) > 0 ? (h.cost_base ?? 0) / h.units : 0;
    const costOfSold = avgCost * soldUnits;
    const proceedsNet = (trade.cash_amount ?? (trade.price ?? 0) * soldUnits) - (trade.fees ?? 0);

    realizedPl = proceedsNet - costOfSold;

    const newUnits = Math.max(0, (h.units ?? 0) - soldUnits);
    const newCostBase = Math.max(0, (h.cost_base ?? 0) - costOfSold);
    h.units = newUnits;
    h.cost_base = newCostBase;
    h.avg_cost = newUnits > 0 ? newCostBase / newUnits : 0;
    const mv = (h.current_price ?? 0) * newUnits;
    h.current_market_value = mv;
    h.unrealised_pl = mv - newCostBase;
    const op2 = h.opening_price ?? null;
    const cu2 = Math.min(h.opening_units ?? newUnits, newUnits);
    h.continuing_mtm_units = cu2;
    const refPrice2 = op2 ?? (newCostBase > 0 ? newCostBase / newUnits : null);
    const refUnits2 = op2 !== null ? cu2 : newUnits;
    h.market_to_market_gain = (refPrice2 !== null && h.current_price != null) ? (h.current_price - refPrice2) * refUnits2 : null;
    h.market_to_market_pct = (refPrice2 !== null && refPrice2 > 0 && h.current_price != null) ? ((h.current_price - refPrice2) / refPrice2) * 100 : null;
    h.position_status = newUnits === 0 ? "closed" : "unchanged";
    updated[idx] = h;
  }

  return { holdings: updated, realizedPl };
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

function sumHoldings(holdings: HoldingRow[], portfolioId: string) {
  const rows = portfolioId === "combined"
    ? holdings
    : holdings.filter((h) => h.portfolio_id === portfolioId);

  const cost_base_total = rows.reduce((s, h) => s + (h.cost_base ?? 0), 0);
  const market_value_total = rows.reduce((s, h) => s + (h.current_market_value ?? 0), 0);
  // unrealised_pl = current_market_value − cost_base (what you'd pocket if you sold everything today)
  const unrealised_pl_total = rows.reduce((s, h) => s + (h.unrealised_pl ?? ((h.current_market_value ?? 0) - (h.cost_base ?? 0))), 0);
  // market_to_market_return = portfolio-level MTM (current value − opening value); use unrealised_pl
  // as a proxy here since opening_market_value_total is not available at this scope.
  const market_to_market_return = unrealised_pl_total;
  const market_to_market_return_pct = cost_base_total > 0
    ? (market_to_market_return / cost_base_total) * 100 : 0;

  return { cost_base_total, market_value_total, market_to_market_return, market_to_market_return_pct };
}

// ─── Cash classification + ui-series expense update ──────────────────────────
//
// When new cash rows are merged, we:
//  1. Update cash-classification-summary.json — add the net outflow delta per
//     category for the affected portfolio.  neverDecrease guards prevent us from
//     clobbering Python's authoritative totals with sparse local data.
//  2. Update ui-series.json expenses — append new individual expense/pension
//     entries for each DEBIT row that is an outflow (pension, fee, operating
//     expense, brokerage).  Reversals/credits are noted but don't create
//     standalone entries (they reduce the delta used for cash-class summary).

// ─── Category mapping ──────────────────────────────────────────────────────────
// classifyCash returns short tokens; CashClassRow uses longer canonical names.

interface CatInfo {
  mapped: CashClassRow["category"];
  direction: "inflow" | "outflow" | "neutral";
  expenseLabel?: string; // if set, a row of this cat → expenses panel entry
}

const CAT_INFO: Record<string, CatInfo> = {
  pension:    { mapped: "pension_distribution", direction: "outflow", expenseLabel: "Pension" },
  fee:        { mapped: "operating_expense",    direction: "outflow", expenseLabel: "Regulatory/Fee" },
  // Brokerage is embedded in net settlement proceeds — showing it as an expense
  // tile is informational only.  Direction "neutral" means the engine tracks the
  // amount in cash-classification-summary for display but does NOT apply a cash
  // delta (which would double-count what is already in the settlement balance).
  brokerage:  { mapped: "brokerage",            direction: "neutral", expenseLabel: "Transaction" },
  trade:      { mapped: "brokerage",            direction: "neutral" },
  interest:   { mapped: "bank_interest",        direction: "inflow" },
  ato_refund: { mapped: "ato_refund",           direction: "inflow" },
  dividend:   { mapped: "dividends",            direction: "inflow" },
  transfer:   { mapped: "transfer",             direction: "neutral" },
  other:      { mapped: "other",                direction: "neutral" },
};

function catInfo(raw: string): CatInfo {
  return CAT_INFO[raw] ?? { mapped: "other", direction: "neutral" };
}

async function updateCashClassAndExpenses(
  newCashRows: CashLedgerRow[],
  allLedger: CashLedgerRow[],
  filesWritten: string[],
): Promise<void> {
  if (newCashRows.length === 0) return;

  // ── Reversal detection ────────────────────────────────────────────────
  // Find debit/credit pairs that cancel each other out.  Reversed rows are:
  //  - excluded from the Expenses panel (net = 0, nothing to show)
  //  - excluded from the cash-classification delta (net contribution = 0)
  const reversals = detectReversals(newCashRows, allLedger);
  const reversedKeys = reversedDebitKeys(reversals);

  // ── 1. cash-classification-summary.json ────────────────────────────────
  const dataPath = path.join(process.cwd(), "data");
  const classPath = path.join(dataPath, "cash-classification-summary.json");
  const seriesPath = path.join(dataPath, "ui-series.json");

  let classRows: CashClassRow[] = [];
  try { classRows = JSON.parse(await fs.readFile(classPath, "utf-8")); } catch { /* no file yet */ }

  let uiSeries: UiSeries | null = null;
  try { uiSeries = JSON.parse(await fs.readFile(seriesPath, "utf-8")); } catch { /* no file yet */ }

  // Group new cash rows by portfolio + mapped-category → net amount
  // OUTFLOW: debit rows add to total; INFLOW: credit rows add to total; reversals skipped.
  // We track:
  //  - deltaByPidCat: { pid: { mappedCat: delta } }  — used to update cash-class-summary
  //  - outflowRowsByPidCat: rows destined for the expenses panel (debit, non-reversed, has expenseLabel)
  const deltaByPidCat: Record<string, Record<string, { delta: number; direction: CatInfo["direction"] }>> = {};
  const outflowRowsByPidCat: Record<string, Record<string, CashLedgerRow[]>> = {};

  for (const r of newCashRows) {
    const rowKey = `${r.date}|${r.description.slice(0, 40)}|${r.debit ?? 0}`;
    const isReversed = reversedKeys.has(rowKey);

    const rawCat = r.category ?? "other";
    const info   = catInfo(rawCat);
    const pid    = r.portfolio_id;
    const mCat   = info.mapped;

    if (!deltaByPidCat[pid]) deltaByPidCat[pid] = {};
    if (!outflowRowsByPidCat[pid]) outflowRowsByPidCat[pid] = {};

    if (!isReversed) {
      if (!deltaByPidCat[pid][mCat]) deltaByPidCat[pid][mCat] = { delta: 0, direction: info.direction };
      if (info.direction === "outflow") {
        // Outflows: debit adds, credit subtracts
        deltaByPidCat[pid][mCat].delta += (r.debit ?? 0) - (r.credit ?? 0);
      } else if (info.direction === "inflow") {
        // Inflows: credit adds, debit subtracts
        deltaByPidCat[pid][mCat].delta += (r.credit ?? 0) - (r.debit ?? 0);
      }
      // neutral (transfer, other) — still track the delta for completeness
      else {
        deltaByPidCat[pid][mCat].delta += (r.credit ?? 0) - (r.debit ?? 0);
      }
    }

    // For expenses panel: only non-reversed OUTFLOW rows with an expense label
    if ((r.debit ?? 0) > 0 && info.direction === "outflow" && info.expenseLabel && !isReversed) {
      if (!outflowRowsByPidCat[pid][rawCat]) outflowRowsByPidCat[pid][rawCat] = [];
      outflowRowsByPidCat[pid][rawCat].push(r);
    }
  }

  // Update cash-classification-summary rows
  let classChanged = false;
  for (const [pid, catMap] of Object.entries(deltaByPidCat)) {
    for (const [mCat, { delta, direction }] of Object.entries(catMap)) {
      if (delta <= 0) continue; // no positive contribution to record
      const existing = classRows.find(
        (r) => r.portfolio_id === pid && r.category === (mCat as CashClassRow["category"])
      );
      if (existing) {
        const newAmt = neverDecrease(existing.amount, existing.amount + delta);
        if (newAmt !== existing.amount) { existing.amount = newAmt; classChanged = true; }
      } else {
        classRows.push({
          portfolio_id: pid as CashClassRow["portfolio_id"],
          category:     mCat as CashClassRow["category"],
          amount:       delta,
          cash_direction: direction,
        });
        classChanged = true;
      }
    }
  }

  if (classChanged) {
    await fs.writeFile(classPath, JSON.stringify(classRows, null, 2));
    if (!filesWritten.includes("cash-classification-summary.json")) filesWritten.push("cash-classification-summary.json");
  }

  // ── 2. ui-series.json expenses ─────────────────────────────────────────
  if (!uiSeries) return;

  let seriesChanged = false;

  // Month-name → 0-based index
  const MONTH_IDX: Record<string, number> = {
    jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
    jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  };

  /**
   * Parse aggregate pension expense entries like "11 × $7,500/mo (Jul 2025 – May 2026)"
   * and return the date ranges they cover.  New pension entries whose date falls
   * WITHIN a covered range are already counted by Python and should be skipped.
   * Entries OUTSIDE these ranges (e.g. Jun 2026 when range ends May 2026) are NEW
   * and must be appended.
   */
  interface AggRange { amount: number; start: Date; end: Date }
  function parsePensionAggRanges(expArr: ExpenseItem[]): AggRange[] {
    const result: AggRange[] = [];
    for (const e of expArr) {
      if (e.cat !== "Pension") continue;
      const text = `${e.name} ${e.detail}`.toLowerCase();
      // Match "(Mon YYYY – Mon YYYY)" or "(Mon YY – Mon YY)"
      const rangeM = text.match(/\(([a-z]{3})\s+(\d{2,4})\s*[–\-]\s*([a-z]{3})\s+(\d{2,4})\)/);
      // Match "$X/mo" or "× $X" to get the per-payment amount
      const amtM   = text.match(/\$?([\d,]+)\s*\/mo/) ?? text.match(/[×x]\s*\$?([\d,]+)/);
      if (!rangeM || !amtM) continue;

      const sm = MONTH_IDX[rangeM[1]];
      const sy = parseInt(rangeM[2]) + (rangeM[2].length === 2 ? 2000 : 0);
      const em = MONTH_IDX[rangeM[3]];
      const ey = parseInt(rangeM[4]) + (rangeM[4].length === 2 ? 2000 : 0);
      const amount = parseFloat(amtM[1].replace(/,/g, ""));

      if (sm !== undefined && em !== undefined && !isNaN(amount)) {
        result.push({
          amount,
          start: new Date(sy, sm, 1),
          end:   new Date(ey, em, 31),  // last day of end-month
        });
      }
    }
    return result;
  }

  for (const [pid, catMap] of Object.entries(outflowRowsByPidCat)) {
    const seriesKey = pid as keyof UiSeries;
    if (!uiSeries[seriesKey]) continue;
    const expArr: ExpenseItem[] = uiSeries[seriesKey].expenses;

    // Build date-range-aware guard for pension aggregate entries.
    // This replaces the old "amount set" guard which was too broad — it prevented
    // ALL future $7,500 pensions including June 2026 which is past the May 2026 range end.
    const pensionAggRanges = parsePensionAggRanges(expArr);

    for (const [rawCat, rows] of Object.entries(catMap)) {
      const info = catInfo(rawCat);
      const catLabel = info.expenseLabel ?? "Operating";

      for (const r of rows) {
        // Dedup: skip if an expense entry with the same date + amount already exists
        if (expArr.some((e) => e.detail.includes(r.date) && e.amt === r.debit)) continue;

        // Pension guard: skip only if this entry's date falls within a known aggregate
        // range AND the per-payment amount matches.
        // CRITICAL: entries AFTER the aggregate end-date (e.g. Jun 2026 when the
        // aggregate covers "Jul 2025 – May 2026") must NOT be skipped.
        if (rawCat === "pension" && pensionAggRanges.length > 0) {
          const entryDate = new Date(r.date);
          const alreadyAggregated = pensionAggRanges.some(
            (rng) =>
              entryDate >= rng.start &&
              entryDate <= rng.end &&
              rng.amount === (r.debit ?? 0)
          );
          if (alreadyAggregated) {
            console.info(
              `[recalcEngine] Skipping pension ${r.debit} on ${r.date} — within aggregate range, already counted`
            );
            continue;
          }
        }

        expArr.push({
          cat:    catLabel,
          name:   r.description.slice(0, 60),
          detail: `${r.date} — ${r.broker ?? "CommBank"} (uploaded)`,
          amt:    r.debit,
        });
        seriesChanged = true;
      }
    }
  }

  if (seriesChanged) {
    await fs.writeFile(seriesPath, JSON.stringify(uiSeries, null, 2));
    if (!filesWritten.includes("ui-series.json")) filesWritten.push("ui-series.json");
  }
}

// ─── Bridge sync: keep costBridge + perfBridge arithmetically correct ────────
//
// Called at the end of every recalcAll().  Reads the freshly-written summary.json
// and cash-classification-summary.json, then patches ui-series.json so that:
//
//  costBridge (both portfolios)
//   ─ Opening cash, Dividends, ATO, Bank interest, Pension, Operating expenses,
//     Closing cash, Closing cost basis, Total portfolio value are set from data.
//   ─ "Net cash into shares" (or "Net deployed into shares" for P2) is DERIVED
//     as the residual so the waterfall always sums to exactly = Closing cash.
//
//  perfBridge (P1 only — P2's "excl. capital added" metric is Python-managed)
//   ─ Bank interest, Pension, Operating expenses updated from cash-class.
//   ─ "New positions & rebalancing (residual)" absorbs all price/data drift.
//   ─ Current portfolio value = market_value_total + closing_cash_total.
//   ─ MTM return = current − opening_market_value_total.
//   ─ Economic return = MTM + pension + operating expenses (with %).

async function updateUiSeriesBridges(
  updatedSummary: Summary[],
  filesWritten: string[],
): Promise<void> {
  const dataPath  = path.join(process.cwd(), "data");
  const classPath = path.join(dataPath, "cash-classification-summary.json");
  const serPath   = path.join(dataPath, "ui-series.json");

  let classRows: CashClassRow[] = [];
  try { classRows = JSON.parse(await fs.readFile(classPath, "utf-8")); } catch { return; }

  let ui: UiSeries | null = null;
  try { ui = JSON.parse(await fs.readFile(serPath, "utf-8")); } catch { return; }
  if (!ui) return;

  const gc = (pid: string, cat: string) =>
    classRows.find((r) => r.portfolio_id === pid && r.category === cat)?.amount ?? 0;

  let changed = false;

  for (const pid of ["portfolio_1", "portfolio_2"] as const) {
    const s = updatedSummary.find((r) => r.portfolio_id === pid);
    if (!s) continue;
    const ser = ui[pid];
    if (!ser) continue;

    const openingCash = Math.round(s.opening_cash_total       ?? 0);
    const closingCash = Math.round(s.closing_cash_total        ?? 0);
    const dividends   = Math.round(s.dividends_received_total  ?? 0);
    const ato         = Math.round(gc(pid, "ato_refund"));
    const interest    = Math.round(gc(pid, "bank_interest"));
    const pension     = Math.round(gc(pid, "pension_distribution"));
    const opExp       = Math.round(gc(pid, "operating_expense"));
    const transfers   = Math.round(gc(pid, "transfer")); // net capital added (P2)
    const costBase    = Math.round(s.cost_base_total           ?? 0);
    const mktVal      = Math.round(s.market_value_total        ?? 0);
    const openMV      = Math.round(s.opening_market_value_total ?? 0);

    // ── costBridge ──────────────────────────────────────────────────────────
    // The residual line ("Net cash into / from shares") is derived so the
    // waterfall sums exactly to = Closing cash.
    // cashResidual > 0 → net outflow (more bought than sold); val = −cashResidual
    // cashResidual < 0 → net inflow  (more sold than bought); val = +|cashResidual|
    const cashResidual =
      openingCash + dividends + ato + interest + transfers
      - pension - opExp - closingCash;

    for (const step of ser.costBridge ?? []) {
      if (!step.label) continue;
      const set = (v: number) => { if (step.val !== v) { step.val = v; changed = true; } };
      const L = step.label;

      if      (L.startsWith("Opening cash"))              set(openingCash);
      else if (L.startsWith("+ Dividends"))               set(dividends);
      else if (L.startsWith("+ ATO"))                     set(ato);
      else if (L.startsWith("+ Bank interest"))           set(interest);
      else if (
        L.includes("Net cash into shares") ||
        L.includes("Net cash from shares") ||
        L.includes("Net deployed into shares")
      ) {
        if (cashResidual >= 0) {
          if (!L.startsWith("−")) {
            step.label = "− Net cash into shares (buys − sale proceeds)";
            changed = true;
          }
          set(-cashResidual);
        } else {
          if (!L.startsWith("+")) {
            step.label = "+ Net cash from shares (sales − purchases)";
            changed = true;
          }
          set(Math.abs(cashResidual));
        }
      }
      else if (L.startsWith("− Pension"))                 set(-pension);
      else if (L.startsWith("− Operating expenses"))      set(-opExp);
      else if (L.startsWith("= Closing cash"))            set(closingCash);
      else if (L.startsWith("= Closing cost basis"))      set(costBase);
      else if (L.startsWith("Total portfolio value"))      set(costBase + closingCash);
    }

    // ── perfBridge (both P1 and P2) ─────────────────────────────────────────
    // P1: full auto-update with residual line to absorb attribution drift
    // P2: just update the final "current portfolio value" (Python manages the gains breakdown)
    const currentPortfolio = mktVal + closingCash;
    const d   = new Date();
    const dayLabel = `${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })} ${d.getFullYear()}`;

    if (pid === "portfolio_1") {
      // P1: Full recalc with net income grouping and residual
      const mtm    = currentPortfolio - openMV;
      const mtmPct = openMV > 0 ? (mtm / openMV) * 100 : 0;
      const econ    = mtm + pension + opExp;
      const econPct = openMV > 0 ? (econ / openMV) * 100 : 0;

      const netIncome = dividends + ato + interest - pension - opExp;

      const PYTHON_PERF_PREFIXES = [
        "+ Continuing positions",
        "+ Realised gains",
      ];
      let pythonFixed = openMV;
      for (const step of ser.perfBridge ?? []) {
        if (!step.label || step.val == null || step.kind === "sub") continue;
        if (PYTHON_PERF_PREFIXES.some((p) => step.label!.startsWith(p))) {
          pythonFixed += step.val;
        }
      }
      const perfResidual = Math.round(currentPortfolio - pythonFixed - netIncome);

      for (const step of ser.perfBridge ?? []) {
        if (!step.label) continue;
        const set = (v: number) => { if (step.val !== v) { step.val = v; changed = true; } };
        const L = step.label.trim();

        if (L.includes("rebalancing") || L.includes("residual") || L.includes("New positions")) {
          set(perfResidual);
        }
        else if (L.startsWith("Net income retained")) {
          set(netIncome);
        }
        else if (L.startsWith("Income earned")) {
          set(dividends + ato + interest);
          const wantLabel = `  Income earned (dividends $${dividends.toLocaleString("en-AU")} + ATO $${ato.toLocaleString("en-AU")} + interest $${interest.toLocaleString("en-AU")})`;
          if (step.label !== wantLabel) { step.label = wantLabel; changed = true; }
        }
        else if (L.startsWith("Less: pension distributions")) {
          set(-pension);
        }
        else if (L.startsWith("Less: operating expenses")) {
          set(-opExp);
        }
        else if (L.startsWith("= Current portfolio value")) {
          set(currentPortfolio);
          const wantLabel = `= Current portfolio value (${dayLabel})`;
          if (step.label !== wantLabel) { step.label = wantLabel; changed = true; }
        }
        else if (L.startsWith("Market-to-market return")) {
          set(Math.round(mtm));
          const wantLabel = `Market-to-market return (+${mtmPct.toFixed(1)}%)`;
          if (step.label !== wantLabel) { step.label = wantLabel; changed = true; }
        }
        else if (L.startsWith("Economic return incl. pension")) {
          set(Math.round(econ));
          const wantLabel = `Economic return incl. pension (+${econPct.toFixed(1)}%)`;
          if (step.label !== wantLabel) { step.label = wantLabel; changed = true; }
        }
      }
    } else if (pid === "portfolio_2") {
      // P2: Only update the final "current portfolio value" line; keep Python-managed gains
      for (const step of ser.perfBridge ?? []) {
        if (!step.label) continue;
        const set = (v: number) => { if (step.val !== v) { step.val = v; changed = true; } };
        const L = step.label.trim();

        if (L.startsWith("= Current portfolio value")) {
          set(currentPortfolio);
          const wantLabel = `= Current portfolio value (${dayLabel})`;
          if (step.label !== wantLabel) { step.label = wantLabel; changed = true; }
        }
      }
    }
  }

  if (changed) {
    await fs.writeFile(serPath, JSON.stringify(ui, null, 2));
    if (!filesWritten.includes("ui-series.json")) filesWritten.push("ui-series.json");
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface RecalcOptions {
  /** New trade rows just merged — applied to holdings */
  newTrades?: TransactionRow[];
  /** New dividend rows just merged — delta added to existing dividends_received_total */
  newDivRows?: DividendRow[];
  /** New cash ledger rows just merged — triggers cash total recalc + expense/pension updates */
  newCashRows?: CashLedgerRow[];
}

export async function recalcAll(
  newTrades: TransactionRow[] = [],
  options: RecalcOptions = {}
): Promise<RecalcResult> {
  const { newDivRows = [], newCashRows = [] } = options;
  const cashUpdated = newCashRows.length > 0;

  const [holdings, cashLedger, summary] = await Promise.all([
    readDataset("holdings"),
    readDataset("cash-ledger"),
    readDataset("summary"),
  ]);

  const filesWritten: string[] = [];
  const changes: Record<string, unknown> = {};

  // ── Apply new trades to holdings ─────────────────────────────────────────
  let updatedHoldings = holdings as HoldingRow[];
  const extraRealizedPl: Record<string, number> = {};

  if (newTrades.length > 0) {
    for (const trade of newTrades) {
      const { holdings: h, realizedPl } = applyTradeToHoldings(updatedHoldings, trade);
      updatedHoldings = h;
      const pid = trade.portfolio_id;
      extraRealizedPl[pid] = (extraRealizedPl[pid] ?? 0) + realizedPl;
    }
    await writeDataset("holdings", updatedHoldings);
    filesWritten.push("holdings.json");
    // average-cost-summary.json is the file the dashboard UI actually reads
    // (see app/page.tsx). It is a strict mirror of holdings.json, so keep the two
    // in lock-step here — otherwise a merged sell (e.g. closing out a position)
    // updates holdings.json but the UI keeps showing the stale prior units.
    await writeDataset("average-cost-summary", updatedHoldings);
    filesWritten.push("average-cost-summary.json");
    changes.holdingsUpdated = newTrades.length;
  }

  // ── Build updated summary rows ────────────────────────────────────────────
  const allLedger = cashLedger as CashLedgerRow[];

  // Calculate delta dividend totals keyed by portfolio_id
  const divDelta: Record<string, number> = {};
  for (const d of newDivRows) {
    divDelta[d.portfolio_id] = (divDelta[d.portfolio_id] ?? 0) + (d.cash_received ?? 0);
  }

  const updatedSummary = (summary as Summary[]).map((s) => {
    const pid = s.portfolio_id;
    if (pid === "combined") return s; // rebuilt below

    // Holdings totals — always recalculate from holdings.json
    const holdingTotals = sumHoldings(updatedHoldings, pid);

    // Dividends: DELTA approach — add newly merged dividends to existing total.
    // Guard: neverDecrease ensures we can't accidentally wipe the Python total
    // by re-summing our sparse local file.
    const divAdd = divDelta[pid] ?? 0;
    const rawDivTotal = (s.dividends_received_total ?? 0) + divAdd;
    const newDivTotal = neverDecrease(s.dividends_received_total, rawDivTotal);

    // Cash: recalculate from cash-ledger ONLY if cash rows were just added.
    // Guard: plausibleCash prevents zeroing or implausible drops.
    // Requires broker to be set on all cash rows (CommBank / Stake / CommSec).
    let newCashTotal = s.closing_cash_total ?? 0;
    if (cashUpdated) {
      const computed = calcClosingCash(allLedger, pid);
      newCashTotal = plausibleCash(s.closing_cash_total, computed);
    }

    // Realized P&L: cumulative — only add the new sell proceeds, never subtract.
    const rawRealizedPl = (s.realized_pl_total ?? 0) + (extraRealizedPl[pid] ?? 0);
    const realizedPl = neverDecrease(s.realized_pl_total, rawRealizedPl);

    return {
      ...s,
      closing_cash_total: newCashTotal,
      dividends_received_total: newDivTotal,
      ...holdingTotals,
      realized_pl_total: realizedPl,
      as_of_date: new Date().toISOString().slice(0, 10),
    };
  });

  // ── Rebuild combined row ──────────────────────────────────────────────────
  const p1 = updatedSummary.find((s) => s.portfolio_id === "portfolio_1");
  const p2 = updatedSummary.find((s) => s.portfolio_id === "portfolio_2");
  const combined = updatedSummary.find((s) => s.portfolio_id === "combined");

  if (p1 && p2 && combined) {
    const combinedHoldings = sumHoldings(updatedHoldings, "combined");
    const combinedIdx = updatedSummary.findIndex((s) => s.portfolio_id === "combined");

    const newCombinedCash = (p1.closing_cash_total ?? 0) + (p2.closing_cash_total ?? 0);
    const newCombinedDiv  = (p1.dividends_received_total ?? 0) + (p2.dividends_received_total ?? 0);
    const newCombinedRPL  = (p1.realized_pl_total ?? 0) + (p2.realized_pl_total ?? 0);

    updatedSummary[combinedIdx] = {
      ...combined,
      ...combinedHoldings,
      // Apply same guards on combined totals
      closing_cash_total:       plausibleCash(combined.closing_cash_total, newCombinedCash),
      dividends_received_total: neverDecrease(combined.dividends_received_total, newCombinedDiv),
      realized_pl_total:        neverDecrease(combined.realized_pl_total, newCombinedRPL),
      opening_cash_total:        (p1.opening_cash_total ?? 0) + (p2.opening_cash_total ?? 0),
      opening_market_value_total:(p1.opening_market_value_total ?? 0) + (p2.opening_market_value_total ?? 0),
      net_transfers_total:       (p1.net_transfers_total ?? 0) + (p2.net_transfers_total ?? 0),
      as_of_date: new Date().toISOString().slice(0, 10),
    };
  }

  // ── Update cash classification + expense panel ────────────────────────────
  if (newCashRows.length > 0) {
    await updateCashClassAndExpenses(newCashRows, allLedger, filesWritten);
  }

  // ── Compute total portfolio value at market (shares + cash) ────────────────
  for (const s of updatedSummary) {
    if (s.portfolio_id !== "combined") {
      s.total_portfolio_value_at_market = Math.round(
        (s.market_value_total ?? 0) + (s.closing_cash_total ?? 0)
      );
    }
  }

  await writeDataset("summary", updatedSummary);
  filesWritten.push("summary.json");

  // ── Sync costBridge + perfBridge in ui-series.json ────────────────────────
  // Always runs after summary is written so the bridges reflect the latest
  // closing cash, dividends, pension, interest, and market values.
  await updateUiSeriesBridges(updatedSummary, filesWritten);

  changes.summaryUpdated = ["portfolio_1", "portfolio_2"].map((pid) => {
    const row = updatedSummary.find((s) => s.portfolio_id === pid);
    return { pid, closing_cash: row?.closing_cash_total, dividends: row?.dividends_received_total, mv: row?.market_value_total };
  });

  return { filesWritten, changes };
}
