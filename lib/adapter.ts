import "server-only";
import type { CashLedgerRow, TransactionRow, DividendRow, PortfolioId } from "./types";

/**
 * Maps the Python reconciliation output (portfolio_balances_data.json) into the
 * dashboard data contract. Defensive: tolerates missing fields/sections.
 */

interface PyCashRow {
  date?: string; broker?: string; description?: string;
  debit?: number; credit?: number; cash_change?: number;
  statement_balance?: number; calculated_running_balance?: number; source?: string;
}
export interface PyOutput {
  summary?: Record<string, unknown>;
  cash_ledger?: PyCashRow[];
  dividends?: Array<Record<string, unknown>>;
  trades?: Array<Record<string, unknown>>;
}

const TRADE_RE = /^([BS])\s+([\d,]+)\s+([A-Z0-9]+)\s+@\s+([\d.]+)/i;

function classify(desc: string): string {
  const d = desc.toLowerCase();
  if (/^[bs]\s+\d/i.test(desc)) return "trade";
  if (/divid|distribution|drp/.test(d)) return "dividend";
  if (/transfer|payee|direct credit|direct debit/.test(d)) return "transfer";
  if (/interest/.test(d)) return "bank_interest";
  if (/fee|brokerage|asic/.test(d)) return "fee";
  if (/refund|ato|tax/.test(d)) return "ato_refund";
  return "other";
}

export interface AdaptResult {
  cashLedger: CashLedgerRow[];
  transactions: TransactionRow[];
  dividends: DividendRow[];
  warnings: string[];
}

export function adaptPythonOutput(py: PyOutput, portfolioId: PortfolioId, brokerHint = ""): AdaptResult {
  const warnings: string[] = [];
  const cashLedger: CashLedgerRow[] = [];
  const transactions: TransactionRow[] = [];
  const dividends: DividendRow[] = [];

  for (const r of py.cash_ledger ?? []) {
    const desc = r.description ?? "";
    const category = classify(desc);
    cashLedger.push({
      date: r.date ?? "",
      portfolio_id: portfolioId,
      broker: r.broker ?? brokerHint,
      description: desc,
      category,
      debit: r.debit ?? 0,
      credit: r.credit ?? 0,
      balance: r.statement_balance ?? r.calculated_running_balance,
      source: r.source,
    });

    const m = desc.match(TRADE_RE);
    if (m) {
      const side = m[1].toUpperCase() === "S" ? "sell" : "buy";
      transactions.push({
        date: r.date ?? "",
        portfolio_id: portfolioId,
        broker: r.broker ?? brokerHint,
        type: side,
        symbol: m[3].toUpperCase(),
        units: Number(m[2].replace(/,/g, "")),
        price: Number(m[4]),
        cash_amount: r.cash_change ?? (r.credit ?? 0) - (r.debit ?? 0),
        currency: "AUD",
        source: r.source,
      });
    } else if (category === "dividend") {
      dividends.push({
        payment_date: r.date ?? "",
        portfolio_id: portfolioId,
        broker: r.broker ?? brokerHint,
        description: desc,
        cash_received: r.credit ?? r.cash_change ?? 0,
        source: r.source,
      });
    }
  }

  // Prefer explicit dividends section if the Python emitted one.
  for (const d of py.dividends ?? []) {
    dividends.push({
      payment_date: String(d.date ?? d.payment_date ?? ""),
      portfolio_id: portfolioId,
      broker: String(d.broker ?? brokerHint),
      symbol: d.symbol ? String(d.symbol) : undefined,
      name: d.name ? String(d.name) : undefined,
      description: d.description ? String(d.description) : undefined,
      gross_amount: typeof d.gross_amount === "number" ? d.gross_amount : undefined,
      cash_received: Number(d.cash_received ?? d.amount ?? 0),
      franked: typeof d.franked === "number" ? d.franked : undefined,
      unfranked: typeof d.unfranked === "number" ? d.unfranked : undefined,
      franking_credit: typeof d.franking_credit === "number" ? d.franking_credit : undefined,
      source: d.source ? String(d.source) : undefined,
    });
  }

  if (cashLedger.length === 0) warnings.push(`No cash_ledger rows found in Python output for ${portfolioId}.`);
  return { cashLedger, transactions, dividends, warnings };
}
