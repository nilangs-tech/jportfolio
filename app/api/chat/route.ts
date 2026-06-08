import { NextRequest, NextResponse } from "next/server";
import { ensureLocalOnly, serverConfig, type LlmProvider } from "@/lib/config";
import { llmChat, type ChatMsg } from "@/lib/llm/providers";
import { buildChatContext } from "@/lib/chatContext";

/**
 * Local-only portfolio chat. Uses the selected provider server-side.
 * POST { portfolioId, provider?, messages: {role,content}[] }
 */
export async function POST(req: NextRequest) {
  const blocked = ensureLocalOnly();
  if (blocked) return blocked;

  let body: { portfolioId?: string; provider?: LlmProvider; messages?: ChatMsg[] } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const provider = body.provider ?? serverConfig.defaultProvider;
  const portfolioId = body.portfolioId ?? "combined";
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const context = await buildChatContext(portfolioId, lastUser);
  const system: ChatMsg = {
    role: "system",
    content:
      "You are the JPortfolio reconciliation assistant. Answer using ONLY the structured context provided. " +
      "Cite which dataset (e.g. SUMMARY, CASH_CLASSIFICATION) supports each claim. If a transaction is ambiguous, " +
      "ask a single clarifying question. Never invent figures. Never request raw statement text. " +
      "If asked to change reconciled data, explain that it must go through the amendment preview/approve flow.\n\n" +
      "CONTEXT:\n" + context,
  };

  const result = await llmChat(provider, [system, ...messages]);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, provider }, { status: 502 });

  return NextResponse.json({ ok: true, provider: result.provider, model: result.model, reply: result.text });
}
