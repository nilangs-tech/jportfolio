import "server-only";
import { readDataset, writeDataset } from "./data";
import type { DataBundle, ReconciliationDecision } from "./types";

/**
 * Amendment preview/apply. A chat-requested change is NEVER written directly.
 * preview() returns a before/after diff; apply() persists only after explicit approval
 * and records a decision in reconciliation-decisions.json.
 */

export interface AmendmentRequest {
  dataset: keyof DataBundle;
  matchField: string;
  matchValue: string | number;
  changes: Record<string, unknown>;
  portfolioId?: string;
  reason?: string;
}

export interface AmendmentPreview {
  dataset: keyof DataBundle;
  affected: { before: Record<string, unknown>; after: Record<string, unknown> }[];
  count: number;
}

export async function previewAmendment(req: AmendmentRequest): Promise<AmendmentPreview> {
  const rows = (await readDataset(req.dataset)) as unknown as Record<string, unknown>[];
  const affected = rows
    .filter((r) => String(r[req.matchField]) === String(req.matchValue))
    .map((before) => ({ before, after: { ...before, ...req.changes } }));
  return { dataset: req.dataset, affected, count: affected.length };
}

export async function applyAmendment(req: AmendmentRequest): Promise<{ applied: number; decisionId: string }> {
  const rows = (await readDataset(req.dataset)) as unknown as Record<string, unknown>[];
  let applied = 0;
  const next = rows.map((r) => {
    if (String(r[req.matchField]) === String(req.matchValue)) { applied++; return { ...r, ...req.changes }; }
    return r;
  });
  await writeDataset(req.dataset, next as unknown as DataBundle[typeof req.dataset]);

  const decisionId = `dec-${Date.now()}`;
  const decision: ReconciliationDecision = {
    decision_id: decisionId,
    created_at: new Date().toISOString(),
    portfolio_id: (req.portfolioId as ReconciliationDecision["portfolio_id"]) ?? "combined",
    source: "chat",
    related_file: `${req.dataset}.json`,
    question: req.reason,
    answer: JSON.stringify(req.changes),
    decision_type: "amendment",
    approved_by_user: true,
    applied_at: new Date().toISOString(),
    notes: `Matched ${req.matchField}=${req.matchValue}; ${applied} row(s) updated.`,
  };
  const decisions = await readDataset("reconciliation-decisions");
  await writeDataset("reconciliation-decisions", [...decisions, decision]);
  return { applied, decisionId };
}
