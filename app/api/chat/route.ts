import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly, serverConfig, type LlmProvider } from "@/lib/config";
import { llmChat, type ChatMsg } from "@/lib/llm/providers";
import { buildChatContext, buildReconcileContext, buildUploadReviewContext } from "@/lib/chatContext";
import type { ParseResult } from "@/lib/statementParser";

const RECONCILE_SYSTEM = `\
You are the JPortfolio reconciliation assistant. Your job is to help the user verify and correct the \
reconciliation output after a new statement has been processed.

You have access to:
- CASH_LEDGER: the adapted cash entries that appear in the dashboard
- TRANSACTIONS: buy/sell trades extracted from statements
- DIVIDENDS_RECEIVED: dividend payments extracted
- CASH_CLASSIFICATION: how cash flows are categorised
- DATA_QUALITY_WARNINGS: issues flagged during reconciliation
- RECENT_RECONCILIATION_RUNS: metadata about the last run(s)
- PYTHON_ENGINE_RAW: the raw output before adaptation (use this to spot discrepancies)
- STATEMENT_FILES_IN_VAULT: files available for reference

Your tasks:
1. Proactively identify discrepancies, uncategorised entries, missing items, or classification errors
2. Ask targeted questions to clarify ambiguous entries
3. Propose specific data corrections using the AMENDMENT format below

When you want to correct a data record, output this block (one per correction, never batched):

---AMENDMENT---
{"description":"short human-readable title","dataset":"cash-ledger","matchField":"date","matchValue":"2025-07-01","changes":{"category":"transfer_in","notes":"Capital injection"},"reason":"Detailed explanation of why this correction is needed"}
---END_AMENDMENT---

Valid datasets: cash-ledger, transactions, dividends-received, holdings, cash-classification-summary
Valid matchFields: any field name visible in the dataset rows above.

Rules:
- Never invent figures. All values must come from the context provided.
- One amendment per change. If multiple rows need fixing, propose them one at a time.
- Explain your reasoning before each amendment proposal.
- If you are unsure, ask a clarifying question first — do not propose an amendment.
- After the user approves or rejects, continue analysing.`;

const GENERAL_SYSTEM = `\
You are the JPortfolio reconciliation assistant. Answer using ONLY the structured context provided. \
Cite which dataset (e.g. SUMMARY, CASH_CLASSIFICATION) supports each claim. If a transaction is ambiguous, \
ask a single clarifying question. Never invent figures. Never request raw statement text. \
If asked to change reconciled data, explain that it must go through the amendment preview/approve flow.`;

/**
 * Local-only portfolio chat.
 * POST { portfolioId, provider?, mode?, messages: {role,content}[] }
 * mode: "general" (default) | "reconcile" — reconcile uses richer context + amendment proposals
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  let body: {
    portfolioId?: string;
    provider?: LlmProvider;
    mode?: "general" | "reconcile" | "upload-review";
    messages?: ChatMsg[];
    parseResult?: ParseResult;
  } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const provider = body.provider ?? serverConfig.defaultProvider;
  const portfolioId = body.portfolioId ?? "combined";
  const mode = body.mode ?? "general";
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  let context: string;
  if (mode === "upload-review" && body.parseResult) {
    context = buildUploadReviewContext(body.parseResult);
  } else if (mode === "reconcile") {
    context = await buildReconcileContext(portfolioId);
  } else {
    context = await buildChatContext(portfolioId, lastUser);
  }

  const systemContent = (mode === "reconcile" ? RECONCILE_SYSTEM : GENERAL_SYSTEM) +
    "\n\nCONTEXT:\n" + context;

  const system: ChatMsg = { role: "system", content: systemContent };
  const result = await llmChat(provider, [system, ...messages]);

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, provider }, { status: 502 });
  return NextResponse.json({ ok: true, provider: result.provider, model: result.model, reply: result.text });
}
