import "server-only";
import * as XLSX from "xlsx";
import type { ParseResult, BrokerSource } from "./types";
import { parseCommSecCsv } from "./commsecCsv";
import { parseStakeActivity, parseStakeIncome, parseStakeCash } from "./stakeXlsx";
import { parseCashCsv } from "./cashCsv";

export type { ParseResult, ParsedTrade, ParsedDividend, ParsedCashEntry, BrokerSource } from "./types";

// ─── Format detection ─────────────────────────────────────────────────────────

function detectSource(filename: string, headers: string[]): BrokerSource {
  const fn = filename.toLowerCase();
  const h = headers.map((s) => s.toLowerCase().trim());

  // Stake file name patterns
  if (fn.includes("investment_activity")) return "stake_activity_xlsx";
  if (fn.includes("investment_income")) return "stake_income_xlsx";
  if (fn.includes("cash_transaction")) return "stake_cash_xlsx";

  // CommSec CSV: has Reference + Details + Debit($) columns
  if (h.includes("reference") && h.includes("details") && h.some((c) => c.includes("debit"))) return "commsec_csv";

  // Stake activity: has "trade date" + "side"
  if (h.includes("trade date") && h.includes("side")) return "stake_activity_xlsx";

  // Stake income: has "ex-dividend date" + "payment date"
  if (h.some((c) => c.includes("ex-dividend")) && h.includes("payment date")) return "stake_income_xlsx";

  // Stake cash: has "transaction" column
  if (h.includes("transaction") && h.includes("debit") && h.includes("credit")) return "stake_cash_xlsx";

  // Generic cash CSV: Date + Amount or Date + Debit/Credit + Description
  if (h.includes("date") && (h.includes("amount") || (h.includes("debit") && h.includes("credit")))) return "commbank_cash_csv";

  return filename.endsWith(".xlsx") || filename.endsWith(".xls") ? "unknown_xlsx" : "unknown_csv";
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsvBuffer(buf: Buffer): Record<string, string>[] {
  const wb = XLSX.read(buf, { type: "buffer", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

// ─── XLSX parser ──────────────────────────────────────────────────────────────

function parseXlsxBuffer(buf: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false, raw: false });
  // Try each sheet until we find one with data rows
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length > 0) return rows;
  }
  return [];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function parseStatement(
  buffer: Buffer,
  filename: string,
  portfolioId: string,
): Promise<ParseResult> {
  const lower = filename.toLowerCase();

  // PDF: not yet supported via this path (handled by LLM route)
  if (lower.endsWith(".pdf")) {
    return {
      source: "pdf_llm", filename, portfolio_id: portfolioId,
      trades: [], dividends: [], cashEntries: [],
      warnings: ["PDF parsing is not yet supported — please convert to CSV or XLSX first."],
      skippedRows: 0,
    };
  }

  try {
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const rows = parseXlsxBuffer(buffer);
      if (rows.length === 0) {
        return { source: "unknown_xlsx", filename, portfolio_id: portfolioId, trades: [], dividends: [], cashEntries: [], warnings: ["File appears empty."], skippedRows: 0 };
      }
      const headers = Object.keys(rows[0]);
      const source = detectSource(filename, headers);

      if (source === "stake_activity_xlsx") return parseStakeActivity(rows, portfolioId, filename);
      if (source === "stake_income_xlsx")   return parseStakeIncome(rows, portfolioId, filename);
      if (source === "stake_cash_xlsx")     return parseStakeCash(rows, portfolioId, filename);

      // Unknown XLSX — try cash layout
      return parseCashCsv(rows as Record<string, string>[], portfolioId, filename);
    }

    // CSV
    const rows = parseCsvBuffer(buffer);
    if (rows.length === 0) {
      return { source: "unknown_csv", filename, portfolio_id: portfolioId, trades: [], dividends: [], cashEntries: [], warnings: ["File appears empty."], skippedRows: 0 };
    }
    const headers = Object.keys(rows[0]);
    const source = detectSource(filename, headers);

    if (source === "commsec_csv")       return parseCommSecCsv(rows, portfolioId, filename);
    if (source === "commbank_cash_csv") return parseCashCsv(rows, portfolioId, filename);

    // Fallback: treat as cash CSV
    return parseCashCsv(rows, portfolioId, filename);

  } catch (e) {
    return {
      source: "unknown_csv", filename, portfolio_id: portfolioId,
      trades: [], dividends: [], cashEntries: [],
      warnings: [`Parse error: ${String(e)}`],
      skippedRows: 0,
    };
  }
}
