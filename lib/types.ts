/**
 * Dashboard data contract — TypeScript types for the 17 JSON outputs.
 * Mirrors "App/02 Data Contract.md". These are the single seam between the
 * reconciliation pipeline (Python + TS adapter) and the dashboard UI.
 */

export type PortfolioId = "portfolio_1" | "portfolio_2" | "combined";
export type Confidence = "high" | "medium" | "low";
export type PriceStatus = "live" | "cached" | "stale" | "unavailable" | "delisted" | "fallback";

export interface CommonFields {
  portfolio_id: PortfolioId;
  portfolio_name?: string;
  source_file?: string;
  source_folder?: string;
  confidence?: Confidence;
  notes?: string;
}

// 1. summary.json
export interface Summary {
  portfolio_id: PortfolioId;
  period_start: string;
  as_of_date: string;
  opening_cash_total: number;
  closing_cash_total: number;
  dividends_received_total: number;
  dividend_gross_statement_total?: number;
  net_transfers_total?: number;
  total_credits?: number;
  total_payments_out?: number;
  opening_market_value_total: number;
  market_value_total: number;
  cost_base_total?: number;
  realized_pl_total?: number;
  market_to_market_return: number;
  market_to_market_return_pct: number;
  economic_return?: number;
  economic_return_pct?: number;
  cash_bridge_check?: number;
  price_as_of_date?: string;
  price_refreshed_at?: string;
}

// 2. portfolios.json
export interface PortfolioMeta {
  portfolio_id: PortfolioId;
  portfolio_name: string;
  statement_folder: string;
  accounts: string[];
  as_of_date: string;
  status: "active" | "inactive" | "review_required";
}

// 3. cash-ledger.json
export interface CashLedgerRow {
  date: string;
  portfolio_id: PortfolioId;
  broker: string;
  account?: string;
  description: string;
  category?: string;
  debit: number;
  credit: number;
  balance?: number;
  source?: string;
}

// 4. cash-bridge.json (rendered bridge steps)
export interface CashBridgeStep {
  portfolio_id: PortfolioId;
  label: string;
  value: number;
  kind: "line" | "subtotal" | "grand" | "sub" | "spacer";
}

// 5. cash-classification-summary.json
export interface CashClassRow {
  portfolio_id: PortfolioId;
  period_start?: string;
  period_end?: string;
  category:
    | "dividends" | "bank_interest" | "ato_refund" | "pension_distribution"
    | "transfer" | "operating_expense" | "brokerage" | "tax" | "other";
  amount: number;
  cash_direction: "inflow" | "outflow" | "neutral";
  source_count?: number;
  notes?: string;
}

// 6. transactions.json
export interface TransactionRow {
  date: string;
  portfolio_id: PortfolioId;
  broker?: string;
  account?: string;
  type: "buy" | "sell" | "transfer" | "dividend" | "distribution" | "fee" | "tax" | "corporate_action" | "adjustment";
  symbol?: string;
  original_symbol?: string;
  name?: string;
  units?: number;
  price?: number;
  gross_amount?: number;
  fees?: number;
  tax_amount?: number;
  cash_amount?: number;
  currency?: string;
  source?: string;
}

// 7. dividends-received.json
export interface DividendRow {
  payment_date: string;
  portfolio_id: PortfolioId;
  broker?: string;
  symbol?: string;
  name?: string;
  description?: string;
  gross_amount?: number;
  cash_received: number;
  unfranked?: number;
  franked?: number;
  franking_credit?: number;
  source?: string;
}

// 8. holdings.json (lightweight current holdings) + 9. average-cost-summary.json (rich)
export interface HoldingRow {
  portfolio_id: PortfolioId;
  broker?: string;
  symbol: string;
  original_symbol?: string;
  provider_symbol?: string;
  name?: string;
  units: number;
  cost_base?: number;
  avg_cost?: number;
  opening_price?: number | null;
  opening_market_value?: number | null;
  current_price?: number | null;
  current_market_value?: number | null;
  price_status?: PriceStatus;
  opening_units?: number | null;
  continuing_mtm_units?: number | null;
  /** FY price movement: (current_price − opening_price) × continuing_mtm_units */
  market_to_market_gain?: number | null;
  market_to_market_pct?: number | null;
  /** Unrealised P&L vs cost base: current_market_value − cost_base */
  unrealised_pl?: number | null;
  portfolio_weight?: number;
  position_status?: "new" | "closed" | "changed" | "unchanged" | "delisted" | "review";
  realized_pl?: number | null;
  unmatched_sold_units?: number;
  cost_status?: "complete" | "missing";
}

// 10. market-prices.json
export interface MarketPriceRow {
  portfolio_id: PortfolioId;
  symbol: string;
  provider_symbol?: string;
  price_type: "opening" | "current" | "fallback" | "manual";
  quote_date?: string;
  price: number;
  currency?: string;
  provider?: string;
  recorded_at?: string;
  fetched_at?: string;
  status: PriceStatus;
  source_note?: string;
}

// 11. performance-summary.json
export interface PerformanceSummary {
  portfolio_id: PortfolioId;
  opening_market_value: number;
  current_market_value: number;
  market_to_market_return: number;
  market_to_market_return_pct: number;
  continuing_position_mtm_gain?: number;
  new_positions_rebalancing_residual?: number;
  dividends_received?: number;
  realized_pl?: number;
  ato_refund?: number;
  bank_interest?: number;
  pension_distributions?: number;
  operating_expenses?: number;
  economic_return?: number;
  economic_return_pct?: number;
}

// 12. position-changes.json
export interface PositionChangeRow {
  portfolio_id: PortfolioId;
  symbol: string;
  change_type: "new" | "closed" | "changed_avg_cost" | "changed_units" | "unchanged" | "delisted";
  opening_units?: number | null;
  current_units?: number | null;
  opening_avg_cost?: number | null;
  current_avg_cost?: number | null;
  opening_price?: number | null;
  current_price?: number | null;
  market_to_market_gain?: number | null;
  market_to_market_pct?: number | null;
  notes?: string;
}

// 13. corporate-actions.json
export interface CorporateActionRow {
  effective_date: string;
  portfolio_id: PortfolioId;
  action_type: "merger" | "acquisition" | "demerger" | "split" | "consolidation" | "ticker_change" | "name_change" | "transfer" | "adjustment";
  from_symbol?: string;
  to_symbol?: string;
  from_units?: number;
  to_units?: number;
  cash_component?: number;
  cost_base_treatment?: string;
  source?: string;
}

// 14. data-quality.json
export interface DataQualityRow {
  portfolio_id: PortfolioId;
  severity: "info" | "warning" | "error";
  area: "cash" | "holdings" | "dividends" | "cost_base" | "market_price" | "transfer" | "corporate_action" | "source";
  message: string;
  affected_symbol?: string;
  source?: string;
  resolution_status: "open" | "reviewed" | "resolved";
}

// 15. reconciliation-runs.json
export interface ReconciliationRun {
  run_id: string;
  started_at: string;
  finished_at?: string;
  portfolio_id: PortfolioId;
  llm_provider: "openai" | "anthropic" | "manual" | "none";
  llm_model?: string;
  uploaded_files: string[];
  generated_outputs: string[];
  status: "success" | "warning" | "failed" | "cancelled";
  warning_count: number;
  error_message?: string;
}

// 16. reconciliation-decisions.json
export interface ReconciliationDecision {
  decision_id: string;
  created_at: string;
  portfolio_id: PortfolioId;
  source: "chat" | "clarification" | "manual_review" | "reconciliation";
  related_run_id?: string;
  related_file?: string;
  related_transaction_id?: string;
  question?: string;
  answer?: string;
  decision_type: "classification" | "amendment" | "ignore" | "transfer_match" | "corporate_action" | "cost_base" | "other";
  approved_by_user: boolean;
  applied_at?: string;
  notes?: string;
}

// 17. chat-history.json
export interface ChatMessage {
  message_id: string;
  session_id: string;
  created_at: string;
  portfolio_id: PortfolioId;
  role: "user" | "assistant" | "system" | "tool" | "clarification";
  llm_provider: "openai" | "anthropic" | "manual" | "none";
  llm_model?: string;
  message: string;
  referenced_files?: string[];
  referenced_records?: string[];
  proposed_action?: "none" | "clarification_request" | "amendment_preview" | "apply_amendment" | "rerun_reconciliation";
  status?: "open" | "answered" | "approved" | "applied" | "rejected" | "informational";
}

/** Map of all dataset file names → their row/object type. */
export interface DataBundle {
  summary: Summary[];
  portfolios: PortfolioMeta[];
  "cash-ledger": CashLedgerRow[];
  "cash-bridge": CashBridgeStep[];
  "cash-classification-summary": CashClassRow[];
  transactions: TransactionRow[];
  "dividends-received": DividendRow[];
  holdings: HoldingRow[];
  "average-cost-summary": HoldingRow[];
  "market-prices": MarketPriceRow[];
  "performance-summary": PerformanceSummary[];
  "position-changes": PositionChangeRow[];
  "corporate-actions": CorporateActionRow[];
  "data-quality": DataQualityRow[];
  "reconciliation-runs": ReconciliationRun[];
  "reconciliation-decisions": ReconciliationDecision[];
  "chat-history": ChatMessage[];
}
