/**
 * Reversal detection for cash ledger entries.
 *
 * A reversal pair is two cash rows where:
 *  - One has a debit and the other has an equal credit for the same amount
 *  - The dates are within 45 days of each other
 *  - At least one row looks like a reversal (explicit keyword) OR the
 *    descriptions are highly similar after stripping "reversal" / "cancelled"
 *
 * The result is used to:
 *  - Skip reversed entries from the Expenses & Distributions panel (net = 0)
 *  - Surface them to the LLM reconcile assistant for explanation
 *  - Warn the user in the upload review UI
 */

import type { CashLedgerRow } from "../types";

export interface ReversalPair {
  /** The original debit (outflow) */
  debit: CashLedgerRow;
  /** The credit that reverses it */
  credit: CashLedgerRow;
  amount: number;
  daysBetween: number;
  /** Human-readable reason we matched these two rows */
  reason: string;
}

const REVERSAL_KEYWORDS = /reversal|reversed|reversal|cancelled|cancel|incorrect|invalid|error|recalled/i;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

/** Strip common reversal prefixes so we can compare the meaningful part */
function normaliseDesc(d: string): string {
  return d.toLowerCase()
    .replace(/^reversal\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similarity: what fraction of the shorter string's words appear in the longer */
function wordSimilarity(a: string, b: string): number {
  const wa = new Set(normaliseDesc(a).split(" ").filter((w) => w.length > 3));
  const wb = new Set(normaliseDesc(b).split(" ").filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  const shorter = wa.size < wb.size ? wa : wb;
  const longer  = wa.size < wb.size ? wb : wa;
  let matches = 0;
  for (const w of shorter) if (longer.has(w)) matches++;
  return matches / shorter.size;
}

/**
 * Detect reversal pairs within a list of cash rows.
 * Scans both the `rows` array and a set of `contextRows` (e.g. existing ledger)
 * so cross-file reversals are caught too.
 *
 * @param rows        The newly merged rows to check
 * @param contextRows All rows (existing + new) for cross-file matching
 * @param windowDays  Max days between the debit and its reversal credit (default 45)
 */
export function detectReversals(
  rows: CashLedgerRow[],
  contextRows: CashLedgerRow[] = [],
  windowDays = 45,
): ReversalPair[] {
  const allRows = contextRows.length > 0 ? contextRows : rows;
  const pairs: ReversalPair[] = [];
  const usedIndices = new Set<number>();

  // Only look at rows in `rows` (newly merged) as the debit side
  for (const debitRow of rows) {
    const debitAmt = debitRow.debit ?? 0;
    if (debitAmt <= 0) continue;

    // Find a matching credit row in allRows
    allRows.forEach((creditRow, idx) => {
      if (usedIndices.has(idx)) return;
      const creditAmt = creditRow.credit ?? 0;
      if (creditAmt !== debitAmt) return;
      if (creditRow === debitRow) return;
      if (daysBetween(debitRow.date, creditRow.date) > windowDays) return;

      // Determine why we think this is a reversal
      let reason = "";
      if (REVERSAL_KEYWORDS.test(creditRow.description)) {
        reason = `Credit row description contains reversal keyword ("${creditRow.description.slice(0, 60)}")`;
      } else if (REVERSAL_KEYWORDS.test(debitRow.description)) {
        reason = `Debit row description contains reversal keyword`;
      } else {
        const sim = wordSimilarity(debitRow.description, creditRow.description);
        if (sim >= 0.6) {
          reason = `Descriptions are ${Math.round(sim * 100)}% similar`;
        }
      }

      if (!reason) return; // not a reversal

      pairs.push({
        debit: debitRow,
        credit: creditRow,
        amount: debitAmt,
        daysBetween: Math.round(daysBetween(debitRow.date, creditRow.date)),
        reason,
      });
      usedIndices.add(idx);
    });
  }

  return pairs;
}

/** Convenience: set of debit row keys that are fully reversed */
export function reversedDebitKeys(pairs: ReversalPair[]): Set<string> {
  return new Set(
    pairs.map((p) => `${p.debit.date}|${p.debit.description.slice(0, 40)}|${p.debit.debit ?? 0}`)
  );
}
