import type { ParseResult, ParsedTrade, ParsedDividend, ParsedCashEntry } from "./types";
import { parseDate, parseMoney, classifyCash, TRADE_RE, normSymbol } from "./utils";

/**
 * CommSec brokerage account CSV.
 * Headers: Date, Reference, Details, Debit($), Credit($), Balance($)
 */
export function parseCommSecCsv(
  rows: Record<string, string>[],
  portfolioId: string,
  filename: string,
): ParseResult {
  const trades: ParsedTrade[] = [];
  const dividends: ParsedDividend[] = [];
  const cashEntries: ParsedCashEntry[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  // Brokerage rows reference the trade row — collect by reference
  const brokerageByRef: Record<string, number> = {};
  const gstByRef: Record<string, number> = {};

  for (const row of rows) {
    const details = (row["Details"] ?? row["details"] ?? "").trim();
    const ref = (row["Reference"] ?? row["reference"] ?? "").trim();
    const debit = parseMoney(row["Debit($)"] ?? row["Debit"] ?? 0);
    const credit = parseMoney(row["Credit($)"] ?? row["Credit"] ?? 0);

    // Brokerage fee row
    if (/^brokerage/i.test(details)) {
      brokerageByRef[ref] = debit;
      continue;
    }
    if (/^gst/i.test(details)) {
      gstByRef[ref] = debit;
      continue;
    }
  }

  for (const row of rows) {
    const details = (row["Details"] ?? row["details"] ?? "").trim();
    if (!details) { skipped++; continue; }

    const ref = (row["Reference"] ?? row["reference"] ?? "").trim();
    const dateRaw = row["Date"] ?? row["date"] ?? "";
    const date = parseDate(dateRaw);
    if (!date) { skipped++; continue; }

    const debit = parseMoney(row["Debit($)"] ?? row["Debit"] ?? 0);
    const credit = parseMoney(row["Credit($)"] ?? row["Credit"] ?? 0);
    const balance = parseMoney(row["Balance($)"] ?? row["Balance"] ?? 0);

    // Skip brokerage/GST — already captured above
    if (/^(brokerage|gst)/i.test(details)) continue;

    // Trade row: "B 100 BHP @ 45.23" or "S 200 WDS @ 30.91"
    const tradeMatch = details.match(TRADE_RE);
    if (tradeMatch) {
      const side = tradeMatch[1].toUpperCase() as "B" | "S";
      const units = parseFloat(tradeMatch[2].replace(/,/g, ""));
      const symbol = normSymbol(tradeMatch[3]);
      const price = parseFloat(tradeMatch[4]);
      const brokerage = brokerageByRef[ref] ?? 0;
      const gst = gstByRef[ref] ?? 0;
      const total = side === "B" ? debit || (units * price + brokerage + gst) : credit || (units * price - brokerage - gst);

      trades.push({
        date, type: side === "B" ? "buy" : "sell",
        symbol, units, price, brokerage, gst, total,
        reference: ref, portfolio_id: portfolioId,
      });
      continue;
    }

    // Dividend row
    if (/divid|distribution|drp/i.test(details)) {
      const symMatch = details.match(/([A-Z]{2,6})\s+(?:DIVIDEND|DISTRIBUTION)/i);
      dividends.push({
        date, symbol: symMatch ? normSymbol(symMatch[1]) : "",
        amount: credit || debit,
        description: details,
        portfolio_id: portfolioId,
      });
      continue;
    }

    // Cash entry
    const category = classifyCash(details);
    cashEntries.push({
      date, description: details,
      debit, credit, balance,
      category, reference: ref,
      portfolio_id: portfolioId,
    });
  }

  return { source: "commsec_csv", filename, portfolio_id: portfolioId, trades, dividends, cashEntries, warnings, skippedRows: skipped };
}
