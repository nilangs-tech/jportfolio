import "server-only";
import { serverConfig, type LlmProvider } from "@/lib/config";

export interface ChatMsg { role: "system" | "user" | "assistant"; content: string; }
export interface LlmResult { ok: boolean; provider: LlmProvider; model?: string; text: string; error?: string; }

/**
 * Unified server-side chat call. Keys are read from env and NEVER exposed to the browser.
 * provider "manual" returns a deterministic local response (no network call).
 */
export async function llmChat(provider: LlmProvider, messages: ChatMsg[]): Promise<LlmResult> {
  if (provider === "manual") {
    return { ok: true, provider, text: "Manual mode: LLM is disabled. Showing local data only — ask me to point you at a specific file or record." };
  }
  if (provider === "openai") return openaiChat(messages);
  if (provider === "anthropic") return anthropicChat(messages);
  return { ok: false, provider, text: "", error: `Unknown provider: ${provider}` };
}

async function openaiChat(messages: ChatMsg[]): Promise<LlmResult> {
  if (!serverConfig.openaiKey) return { ok: false, provider: "openai", text: "", error: "OPENAI_API_KEY not set." };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${serverConfig.openaiKey}` },
      body: JSON.stringify({ model: serverConfig.openaiModel, messages, temperature: 0.2 }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, provider: "openai", model: serverConfig.openaiModel, text: "", error: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, provider: "openai", model: serverConfig.openaiModel, text: json.choices?.[0]?.message?.content ?? "" };
  } catch (e) {
    return { ok: false, provider: "openai", text: "", error: String(e) };
  }
}

async function anthropicChat(messages: ChatMsg[]): Promise<LlmResult> {
  if (!serverConfig.anthropicKey) return { ok: false, provider: "anthropic", text: "", error: "ANTHROPIC_API_KEY not set." };
  try {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const convo = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": serverConfig.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      // Truncate system prompt if it exceeds ~18k chars (~4k tokens) to stay under rate limits
      const safeSystem = system.length > 18000 ? system.slice(0, 18000) + "\n\n[context truncated to fit token limit]" : system;
      body: JSON.stringify({ model: serverConfig.anthropicModel, max_tokens: 1024, system: safeSystem, messages: convo }),
    });
    const raw = await res.text();
    let json: Record<string, unknown>;
    try { json = JSON.parse(raw); } catch { return { ok: false, provider: "anthropic", text: "", error: `Non-JSON response: ${raw.slice(0, 200)}` }; }
    if (!res.ok) return { ok: false, provider: "anthropic", model: serverConfig.anthropicModel, text: "", error: (json?.error as { message?: string })?.message ?? `HTTP ${res.status}` };
    const content = json.content;
    const text = Array.isArray(content) ? (content as { text?: string }[]).map((c) => c.text ?? "").join("") : "";
    return { ok: true, provider: "anthropic", model: serverConfig.anthropicModel, text };
  } catch (e) {
    return { ok: false, provider: "anthropic", text: "", error: String(e) };
  }
}
