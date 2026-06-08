"use client";
import { useState } from "react";
import LlmProviderSelect, { type Provider } from "@/components/LlmProviderSelect";
import { Shell, HostedNotice } from "@/components/LocalPageShell";

const MODE = process.env.NEXT_PUBLIC_APP_MODE ?? "hosted";

interface Msg { role: "user" | "assistant"; content: string; }

export default function ChatPage() {
  const [portfolioId, setPortfolioId] = useState("combined");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  if (MODE !== "local") return <HostedNotice feature="Portfolio chat" />;

  async function send() {
    const q = input.trim();
    if (!q) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portfolioId, provider, messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.ok ? data.reply : `⚠️ ${data.error}` }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${String(e)}` }]);
    }
    setBusy(false);
  }

  return (
    <Shell title="💬 Portfolio Chat" subtitle="Ask about reconciliation outputs, classifications, and warnings. Answers cite the dataset used.">
      <div className="card">
        <div className="table-controls">
          <span style={{ fontSize: 12, fontWeight: 600 }}>Scope:</span>
          <select className="search-input" style={{ width: "auto" }} value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
            <option value="combined">Combined</option>
            <option value="portfolio_1">Portfolio 1 — JSAF</option>
            <option value="portfolio_2">Portfolio 2 — Ind</option>
          </select>
          <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 12 }}>Provider:</span>
          <LlmProviderSelect value={provider} onChange={setProvider} />
        </div>

        <div style={{ minHeight: 200, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
          {messages.length === 0 ? <p className="note">e.g. &quot;Why is the P1 economic return higher than the MTM return?&quot; or &quot;List the delisted holdings and their price source.&quot;</p> : null}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%", padding: "8px 12px", borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap",
              background: m.role === "user" ? "var(--accent)" : "var(--surface2)",
              color: m.role === "user" ? "#fff" : "var(--text)",
              border: m.role === "user" ? "none" : "1px solid var(--border)",
            }}>{m.content}</div>
          ))}
          {busy ? <div className="note">Thinking…</div> : null}
        </div>

        <div className="table-controls">
          <input className="search-input" style={{ flex: 1, width: "auto" }} placeholder="Ask a question…" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <button className="btn" disabled={busy} onClick={send}>Send</button>
        </div>
        <p className="note">Manual mode replies locally without an LLM call. Amendments proposed in chat must go through preview &amp; approval before any JSON changes.</p>
      </div>
    </Shell>
  );
}
