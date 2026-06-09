import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly } from "@/lib/config";
import { readDataset, writeDataset } from "@/lib/data";
import type { ParseResult, ParsedTrade, ParsedDividend, ParsedCashEntry } from "@/lib/statementParser";
import type { TransactionRow, DividendRow, CashLedgerRow } from "@/lib/types";

/**
 * Local-only statement merger.
 * POST { result: ParseResult }
 * Merges parsed trades/dividends/cash into data/*.json with deduplication.
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  let body: { result?: ParseResult } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const result = body.result;
  if (!result) return NextResponse.json({ ok: false, error: "No parse result provided." }, { status: 400 });

  const [existingTx, existingDiv, existingCash] = await Promise.all([
    readDataset("transactions"),
    readDataset("dividends-received"),
    readDataset("cash-ledger"),
  ]);

  // ── Dedup key helpers ────────────────────────────────────────────────────
  const txKey = (t: TransactionRow) => `${t.date}|${t.symbol ?? ""}|${t.type}|${t.units ?? 0}`;
  const divKey = (d: DividendRow) => `${d.payment_date}|${d.symbol ?? ""}|${d.cash_received}`;
  const cashKey = (c: CashLedgerRow) => `${c.date}|${c.description?.slice(0, 40) ?? ""}|${c.debit ?? 0}|${c.credit ?? 0}`;

  const existingTxKeys = new Set(existingTx.map(txKey));
  const existingDivKeys = new Set(existingDiv.map(divKey));
  const existingCashKeys = new Set(existingCash.map(cashKey));

  // ── Merge trades ─────────────────────────────────────────────────────────
  let addedTrades = 0, skippedTrades = 0;
  const newTxRows: TransactionRow[] = [];
  for (const t of result.trades as ParsedTrade[]) {
    const row: TransactionRow = {
      date: t.date,
      portfolio_id: t.portfolio_id as "portfolio_1" | "portfolio_2",
      type: t.type as "buy" | "sell",
      symbol: t.symbol,
      units: t.units,
      price: t.price,
      fees: t.brokerage + t.gst,
      cash_amount: t.total,
      source: result.filename,
    };
    const key = txKey(row);
    if (existingTxKeys.has(key)) { skippedTrades++; continue; }
    existingTxKeys.add(key);
    addedTrades++;
    newTxRows.push(row);
  }

  // ── Merge dividends ──────────────────────────────────────────────────────
  let addedDiv = 0, skippedDiv = 0;
  const newDivRows: DividendRow[] = [];
  for (const d of result.dividends as ParsedDividend[]) {
    const row: DividendRow = {
      payment_date: d.date,
      portfolio_id: d.portfolio_id as "portfolio_1" | "portfolio_2",
      symbol: d.symbol,
      description: d.description,
      cash_received: d.amount,
      gross_amount: d.amount,
      unfranked: d.unfranked,
      franked: d.franked,
      franking_credit: d.franking_credit,
      source: result.filename,
    };
    const key = divKey(row);
    if (existingDivKeys.has(key)) { skippedDiv++; continue; }
    existingDivKeys.add(key);
    addedDiv++;
    newDivRows.push(row);
  }

  // ── Merge cash entries ───────────────────────────────────────────────────
  let addedCash = 0, skippedCash = 0;
  const newCashRows: CashLedgerRow[] = [];
  for (const c of result.cashEntries as ParsedCashEntry[]) {
    const row: CashLedgerRow = {
      date: c.date,
      portfolio_id: c.portfolio_id as "portfolio_1" | "portfolio_2",
      broker: result.source.startsWith("stake") ? "Stake" : result.source.startsWith("commsec") ? "CommSec" : "",
      description: c.description,
      debit: c.debit,
      credit: c.credit,
      balance: c.balance,
      category: c.category,
      source: result.filename,
    };
    const key = cashKey(row);
    if (existingCashKeys.has(key)) { skippedCash++; continue; }
    existingCashKeys.add(key);
    addedCash++;
    newCashRows.push(row);
  }

  // ── Write updated datasets ───────────────────────────────────────────────
  const sortByDate = <T extends { date?: string; payment_date?: string }>(arr: T[]) =>
    [...arr].sort((a, b) => (a.date ?? a.payment_date ?? "").localeCompare(b.date ?? b.payment_date ?? ""));

  const filesWritten: string[] = [];
  if (newTxRows.length > 0) {
    await writeDataset("transactions", sortByDate([...existingTx, ...newTxRows]));
    filesWritten.push("transactions.json");
  }
  if (newDivRows.length > 0) {
    await writeDataset("dividends-received", [...existingDiv, ...newDivRows].sort((a, b) => a.payment_date.localeCompare(b.payment_date)));
    filesWritten.push("dividends-received.json");
  }
  let updatedCashLedger = existingCash;
  if (newCashRows.length > 0) {
    updatedCashLedger = sortByDate([...existingCash, ...newCashRows]);
    await writeDataset("cash-ledger", updatedCashLedger);
    filesWritten.push("cash-ledger.json");
  }

  // ── Recalculate summary closing_cash_total and dividends_received_total ──
  // Do this whenever cash or dividends changed so the dashboard reflects reality.
  if (newCashRows.length > 0 || newDivRows.length > 0) {
    const summary = await readDataset("summary");
    const updatedDiv = newDivRows.length > 0
      ? [...existingDiv, ...newDivRows]
      : existingDiv;

    const portfolioIds = [...new Set([
      ...newCashRows.map((r) => r.portfolio_id),
      ...newDivRows.map((r) => r.portfolio_id),
    ])];

    const updatedSummary = summary.map((s) => {
      if (!portfolioIds.includes(s.portfolio_id) && s.portfolio_id !== "combined") return s;

      const pid = s.portfolio_id;
      const cashRows = (pid === "combined"
        ? updatedCashLedger
        : updatedCashLedger.filter((r) => r.portfolio_id === pid)) as CashLedgerRow[];

      // Use the latest balance from cash ledger rows that have a balance value
      const rowsWithBalance = cashRows.filter((r) => r.balance != null).sort((a, b) => a.date.localeCompare(b.date));
      const latestBalance = rowsWithBalance.length > 0
        ? rowsWithBalance[rowsWithBalance.length - 1].balance!
        : null;

      // Sum dividends received
      const divRows = (pid === "combined"
        ? updatedDiv
        : updatedDiv.filter((r) => r.portfolio_id === pid)) as DividendRow[];
      const divTotal = divRows.reduce((sum, r) => sum + (r.cash_received ?? 0), 0);

      return {
        ...s,
        ...(latestBalance != null ? { closing_cash_total: latestBalance } : {}),
        ...(divRows.length > 0 ? { dividends_received_total: divTotal } : {}),
        as_of_date: new Date().toISOString().slice(0, 10),
      };
    });

    await writeDataset("summary", updatedSummary);
    filesWritten.push("summary.json");
  }

  return NextResponse.json({
    ok: true,
    filesWritten,
    added: { trades: addedTrades, dividends: addedDiv, cash: addedCash },
    skipped: { trades: skippedTrades, dividends: skippedDiv, cash: skippedCash },
  });
}
