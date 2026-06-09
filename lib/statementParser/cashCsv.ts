import type { ParseResult, ParsedCashEntry } from "./types";
import { parseDate, parseMoney, classifyCash } from "./utils";

/**
 * Generic cash account CSV (CommBank, CBA, NAB, etc.)
 * Detects two layouts:
 *   A) Date, Amount, Description, Balance          (CommBank export)
 *   B) Date, Description, Debit, Credit, Balance   (generic)
 */
export function parseCashCsv(
  rows: Record<string, string>[],
  portfolioId: string,
  filename: string,
): ParseResult {
  const cashEntries: ParsedCashEntry[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const dateRaw = row["Date"] ?? row["date"] ?? "";
    const date = parseDate(dateRaw);
    if (!date) { skipped++; continue; }

    const desc = (row["Description"] ?? row["description"] ?? row["Details"] ?? row["details"] ?? "").trim();
    if (!desc) { skipped++; continue; }

    let debit = 0, credit = 0;
    const balance = parseMoney(row["Balance"] ?? row["balance"] ?? 0);

    // Layout A: single Amount column (positive = credit, negative = debit)
    if ("Amount" in row || "amount" in row) {
      const amount = parseMoney(row["Amount"] ?? row["amount"]);
      if (amount >= 0) credit = amount;
      else debit = Math.abs(amount);
    } else {
      // Layout B: separate Debit/Credit columns
      debit = parseMoney(row["Debit"] ?? row["debit"] ?? row["Debit($)"] ?? 0);
      credit = parseMoney(row["Credit"] ?? row["credit"] ?? row["Credit($)"] ?? 0);
    }

    const category = classifyCash(desc);
    cashEntries.push({ date, description: desc, debit, credit, balance, category, portfolio_id: portfolioId });
  }

  return {
    source: "commbank_cash_csv",
    filename, portfolio_id: portfolioId,
    trades: [], dividends: [], cashEntries,
    warnings, skippedRows: skipped,
  };
}
