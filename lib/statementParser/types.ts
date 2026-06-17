/** Shared types for the statement parser pipeline. */

export type BrokerSource =
  | "commsec_csv"
  | "stake_activity_xlsx"
  | "stake_income_xlsx"
  | "stake_cash_xlsx"
  | "commbank_cash_csv"
  | "unknown_csv"
  | "unknown_xlsx"
  | "commsec_pdf"
  | "pdf_llm";

export interface ParsedTrade {
  date: string;                // ISO date YYYY-MM-DD
  type: "buy" | "sell";
  symbol: string;
  units: number;
  price: number;
  brokerage: number;
  gst: number;
  total: number;              // net cash impact (positive = cost for buy, negative = proceeds for sell)
  reference?: string;
  portfolio_id: string;
}

export interface ParsedDividend {
  date: string;               // payment date
  ex_date?: string;           // ex-dividend date
  symbol: string;
  amount: number;
  units?: number;
  per_share?: number;
  franked?: number;
  unfranked?: number;
  franking_credit?: number;
  type?: string;              // "Interim Dividend", "Final Dividend" etc.
  description: string;
  portfolio_id: string;
}

export interface ParsedCashEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  category: string;           // trade | dividend | transfer | interest | fee | other
  reference?: string;
  portfolio_id: string;
}

export interface ParseResult {
  source: BrokerSource;
  filename: string;
  portfolio_id: string;
  trades: ParsedTrade[];
  dividends: ParsedDividend[];
  cashEntries: ParsedCashEntry[];
  warnings: string[];
  skippedRows: number;
}
