import "server-only";
import { readDataset } from "./data";
import { readPythonOutput, listStatements } from "./statementReader";

/**
 * Builds a compact, privacy-aware context for the general portfolio chat LLM.
 * Sends only structured JSON summaries relevant to the question.
 */
export async function buildChatContext(portfolioId: string, question: string): Promise<string> {
  const [summary, perf, dq, positions, corp, cashClass] = await Promise.all([
    readDataset("summary"),
    readDataset("performance-summary"),
    readDataset("data-quality"),
    readDataset("position-changes"),
    readDataset("corporate-actions"),
    readDataset("cash-classification-summary"),
  ]);

  const wanted = (id: string) => portfolioId === "combined" || id === portfolioId || id === "combined";
  const q = question.toLowerCase();

  const parts: string[] = [];
  parts.push("SUMMARY:\n" + JSON.stringify(summary.filter((s) => wanted(s.portfolio_id)), null, 0));
  parts.push("PERFORMANCE:\n" + JSON.stringify(perf.filter((p) => wanted(p.portfolio_id)), null, 0));
  if (/divid|cash|transfer|refund|pension|expense|interest/.test(q))
    parts.push("CASH_CLASSIFICATION:\n" + JSON.stringify(cashClass.filter((c) => wanted(c.portfolio_id)), null, 0));
  if (/new|closed|position|holding|sold|bought/.test(q))
    parts.push("POSITION_CHANGES:\n" + JSON.stringify(positions.filter((p) => wanted(p.portfolio_id)), null, 0));
  if (/corporate|merger|acqui|delist|split|ticker|demerger/.test(q))
    parts.push("CORPORATE_ACTIONS:\n" + JSON.stringify(corp.filter((c) => wanted(c.portfolio_id)), null, 0));
  parts.push("DATA_QUALITY_WARNINGS:\n" + JSON.stringify(dq.filter((d) => wanted(d.portfolio_id)), null, 0));

  return parts.join("\n\n");
}

/**
 * Builds a rich reconciliation-focused context:
 * adapted dashboard data + Python raw output (for discrepancy comparison) + statement list.
 * Used by the reconciliation assistant chat mode.
 */
export async function buildReconcileContext(portfolioId: string): Promise<string> {
  const [cashLedger, transactions, dividends, dq, reconRuns, cashClass, summary] = await Promise.all([
    readDataset("cash-ledger"),
    readDataset("transactions"),
    readDataset("dividends-received"),
    readDataset("data-quality"),
    readDataset("reconciliation-runs"),
    readDataset("cash-classification-summary"),
    readDataset("summary"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wanted = (id: string) => portfolioId === "combined" || id === portfolioId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cl = (cashLedger as any[]).filter((r) => wanted(r.portfolio_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (transactions as any[]).filter((r) => wanted(r.portfolio_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const div = (dividends as any[]).filter((r) => wanted(r.portfolio_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dqW = (dq as any[]).filter((d) => wanted(d.portfolio_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runs = (reconRuns as any[]).filter((r) => wanted(r.portfolio_id)).slice(-3);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cc = (cashClass as any[]).filter((c) => wanted(c.portfolio_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sum = (summary as any[]).filter((s) => wanted(s.portfolio_id));

  const parts: string[] = [];

  parts.push(`PORTFOLIO_SUMMARY:\n` + JSON.stringify(sum, null, 0));
  parts.push(`CASH_LEDGER (${cl.length} rows — what dashboard shows):\n` + JSON.stringify(cl, null, 0));
  parts.push(`TRANSACTIONS (${Math.min(tx.length, 60)} of ${tx.length} rows):\n` + JSON.stringify(tx.slice(0, 60), null, 0));
  parts.push(`DIVIDENDS_RECEIVED (${div.length} rows):\n` + JSON.stringify(div, null, 0));
  parts.push(`CASH_CLASSIFICATION:\n` + JSON.stringify(cc, null, 0));
  parts.push(`DATA_QUALITY_WARNINGS:\n` + JSON.stringify(dqW, null, 0));
  parts.push(`RECENT_RECONCILIATION_RUNS:\n` + JSON.stringify(runs, null, 0));

  // For single-portfolio mode: include Python raw output for comparison
  if (portfolioId !== "combined") {
    const py = await readPythonOutput(portfolioId);
    if (py) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cashSample = Array.isArray(py.cash_ledger) ? (py.cash_ledger as any[]).slice(0, 40) : [];
      parts.push(
        `PYTHON_ENGINE_RAW (for comparison — summary + first 40 cash_ledger entries before adaptation):\n` +
        JSON.stringify({ summary: py.summary, cash_ledger_sample: cashSample }, null, 0)
      );
    }
    const stmts = await listStatements(portfolioId);
    if (stmts.length > 0) {
      parts.push(`STATEMENT_FILES_IN_VAULT:\n` + stmts.join("\n"));
    }
  }

  return parts.join("\n\n");
}
