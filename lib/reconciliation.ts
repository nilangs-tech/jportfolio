import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { serverConfig, folderForPortfolio, type LlmProvider } from "./config";
import { runPython } from "./pythonRunner";
import { adaptPythonOutput, type PyOutput } from "./adapter";
import { readDataset, writeDataset } from "./data";
import type { CashLedgerRow, TransactionRow, DividendRow, ReconciliationRun, DataQualityRow, PortfolioId } from "./types";

export interface ReconcileOptions {
  portfolioIds?: PortfolioId[];
  provider?: LlmProvider;
  runPythonFirst?: boolean;
}
export interface ReconcileResult {
  run: ReconciliationRun;
  perPortfolio: { portfolio_id: PortfolioId; cash: number; trades: number; dividends: number; warnings: string[]; pythonOk: boolean }[];
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")) as T; } catch { return null; }
}

/**
 * Hybrid reconciliation: (optionally) run the existing Python engine per portfolio,
 * adapt its JSON output into the dashboard contract, merge, and persist.
 * Deterministic — the LLM is not used here (it powers chat/clarifications separately).
 */
export async function runReconciliation(opts: ReconcileOptions = {}): Promise<ReconcileResult> {
  const portfolioIds = opts.portfolioIds ?? ["portfolio_1", "portfolio_2"];
  const startedAt = new Date().toISOString();
  const runId = `run-${Date.now()}`;

  const cashAll: CashLedgerRow[] = [];
  const txAll: TransactionRow[] = [];
  const divAll: DividendRow[] = [];
  const dqAll: DataQualityRow[] = [];
  const generated: string[] = [];
  const perPortfolio: ReconcileResult["perPortfolio"] = [];

  for (const pid of portfolioIds) {
    const folder = folderForPortfolio(pid);
    const baseDir = path.join(serverConfig.vaultPath, folder);
    const scriptPath = path.join(baseDir, "tools", "build_portfolio_balances.py");
    const outputsJson = path.join(baseDir, "outputs", "portfolio_balances_data.json");
    let pythonOk = true;
    const warnings: string[] = [];

    if (opts.runPythonFirst) {
      const exists = await fs.stat(scriptPath).then(() => true).catch(() => false);
      if (exists) {
        const r = await runPython(scriptPath, [], baseDir);
        pythonOk = r.ok;
        if (!r.ok) warnings.push(`Python engine exited ${r.code}: ${r.stderr.slice(0, 300)}`);
      } else {
        warnings.push(`No reconciliation script at ${scriptPath} — using existing outputs.`);
      }
    }

    const py = await readJsonIfExists<PyOutput>(outputsJson);
    if (!py) {
      warnings.push(`No Python output found at ${outputsJson}.`);
      perPortfolio.push({ portfolio_id: pid, cash: 0, trades: 0, dividends: 0, warnings, pythonOk: false });
      continue;
    }

    const adapted = adaptPythonOutput(py, pid, folder === "JSAF" ? "CommSec/Stake" : "Stake");
    cashAll.push(...adapted.cashLedger);
    txAll.push(...adapted.transactions);
    divAll.push(...adapted.dividends);
    warnings.push(...adapted.warnings);

    for (const w of warnings) {
      dqAll.push({ portfolio_id: pid, severity: "warning", area: "source", message: w, resolution_status: "open" });
    }
    perPortfolio.push({
      portfolio_id: pid,
      cash: adapted.cashLedger.length,
      trades: adapted.transactions.length,
      dividends: adapted.dividends.length,
      warnings,
      pythonOk,
    });
  }

  // Persist contract datasets (replace cash/tx/dividends with freshly reconciled rows).
  await writeDataset("cash-ledger", cashAll); generated.push("cash-ledger.json");
  await writeDataset("transactions", txAll); generated.push("transactions.json");
  if (divAll.length) { await writeDataset("dividends-received", divAll); generated.push("dividends-received.json"); }

  // Append new data-quality warnings to existing ones.
  if (dqAll.length) {
    const existing = await readDataset("data-quality");
    await writeDataset("data-quality", [...existing, ...dqAll]);
    generated.push("data-quality.json");
  }

  const warningCount = perPortfolio.reduce((s, p) => s + p.warnings.length, 0);
  const run: ReconciliationRun = {
    run_id: runId,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    portfolio_id: portfolioIds.length > 1 ? "combined" : portfolioIds[0],
    llm_provider: (opts.provider as ReconciliationRun["llm_provider"]) ?? "none",
    uploaded_files: [],
    generated_outputs: generated,
    status: warningCount > 0 ? "warning" : "success",
    warning_count: warningCount,
  };
  const runs = await readDataset("reconciliation-runs");
  await writeDataset("reconciliation-runs", [...runs, run]);

  return { run, perPortfolio };
}
