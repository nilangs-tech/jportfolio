import type { ParseResult, ParsedTrade, ParsedDividend, ParsedCashEntry } from "./types";
import { parseDate, parseMoney, classifyCash, normSymbol } from "./utils";

// ─── Stake Investment Activity (trades) ──────────────────────────────────────
// Headers: Trade Date | Settlement Date | Symbol | Name | Side | Trade Identifier | Units | Avg. Price | Value | Fees | GST | Total Value | Currency

export function parseStakeActivity(
  rows: Record<string, unknown>[],
  portfolioId: string,
  filename: string,
): ParseResult {
  const trades: ParsedTrade[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const dateRaw = row["Trade Date"] ?? row["trade date"] ?? "";
    const date = parseDate(dateRaw);
    if (!date) { skipped++; continue; }

    const symbol = normSymbol(String(row["Symbol"] ?? row["symbol"] ?? ""));
    if (!symbol) { skipped++; continue; }

    const side = String(row["Side"] ?? row["side"] ?? "").toLowerCase();
    const units = parseMoney(row["Units"] ?? row["units"]);
    const price = parseMoney(row["Avg. Price"] ?? row["avg. price"] ?? row["Price"]);
    const brokerage = parseMoney(row["Fees"] ?? row["fees"] ?? 0);
    const gst = parseMoney(row["GST"] ?? row["gst"] ?? 0);
    const total = parseMoney(row["Total Value"] ?? row["total value"] ?? row["Value"]);

    if (!units || !price) { skipped++; continue; }

    trades.push({
      date,
      type: side === "sell" ? "sell" : "buy",
      symbol, units, price, brokerage, gst, total,
      reference: String(row["Trade Identifier"] ?? ""),
      portfolio_id: portfolioId,
    });
  }

  return { source: "stake_activity_xlsx", filename, portfolio_id: portfolioId, trades, dividends: [], cashEntries: [], warnings, skippedRows: skipped };
}

// ─── Stake Investment Income (dividends) ─────────────────────────────────────
// Headers: Ex-Dividend Date | Payment Date | Symbol | Name | Type | Units | Dividend/Share | Total Amount | Unfranked | Franked | Franking Credit

export function parseStakeIncome(
  rows: Record<string, unknown>[],
  portfolioId: string,
  filename: string,
): ParseResult {
  const dividends: ParsedDividend[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const payDate = parseDate(row["Payment Date"] ?? row["payment date"]);
    const exDate = parseDate(row["Ex-Dividend Date"] ?? row["ex-dividend date"]);
    if (!payDate) { skipped++; continue; }

    const symbol = normSymbol(String(row["Symbol"] ?? row["symbol"] ?? ""));
    if (!symbol) { skipped++; continue; }

    const amount = parseMoney(row["Total Amount"] ?? row["total amount"]);
    const perShare = parseMoney(row["Dividend/Share"] ?? row["dividend/share"] ?? 0);
    const units = parseMoney(row["Units"] ?? row["units"] ?? 0);
    const franked = parseMoney(row["Franked"] ?? row["franked"] ?? 0);
    const unfranked = parseMoney(row["Unfranked"] ?? row["unfranked"] ?? 0);
    const frankingCredit = parseMoney(row["Franking Credit"] ?? row["franking credit"] ?? 0);
    const type = String(row["Type"] ?? row["type"] ?? "Dividend");

    dividends.push({
      date: payDate, ex_date: exDate ?? undefined,
      symbol, amount, units, per_share: perShare,
      franked, unfranked, franking_credit: frankingCredit,
      type, description: `${type} - ${symbol}`,
      portfolio_id: portfolioId,
    });
  }

  return { source: "stake_income_xlsx", filename, portfolio_id: portfolioId, trades: [], dividends, cashEntries: [], warnings, skippedRows: skipped };
}

// ─── Stake Cash Transaction (cash + dividend payments) ───────────────────────
// Headers: Date | Transaction | Debit | Credit | Balance | Currency

export function parseStakeCash(
  rows: Record<string, unknown>[],
  portfolioId: string,
  filename: string,
): ParseResult {
  const cashEntries: ParsedCashEntry[] = [];
  const dividends: ParsedDividend[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const date = parseDate(row["Date"] ?? row["date"]);
    if (!date) { skipped++; continue; }

    const desc = String(row["Transaction"] ?? row["transaction"] ?? "").trim();
    const debit = parseMoney(row["Debit"] ?? row["debit"] ?? 0);
    const credit = parseMoney(row["Credit"] ?? row["credit"] ?? 0);
    const balance = parseMoney(row["Balance"] ?? row["balance"] ?? 0);

    // Dividend payments — also capture as dividends
    const divMatch = desc.match(/^Dividend\s*[-–]\s*([A-Z]{2,6})/i);
    if (divMatch) {
      dividends.push({
        date, symbol: normSymbol(divMatch[1]),
        amount: credit, description: desc,
        portfolio_id: portfolioId,
      });
    }

    const category = classifyCash(desc);
    cashEntries.push({
      date, description: desc,
      debit, credit, balance,
      category,
      portfolio_id: portfolioId,
    });
  }

  return { source: "stake_cash_xlsx", filename, portfolio_id: portfolioId, trades: [], dividends, cashEntries, warnings, skippedRows: skipped };
}
