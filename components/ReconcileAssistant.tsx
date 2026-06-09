"use client";
import { useEffect, useRef, useState } from "react";
import type { Provider } from "@/components/LlmProviderSelect";
import LlmProviderSelect from "@/components/LlmProviderSelect";
import type { ParseResult } from "@/lib/statementParser/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg { role: "user" | "assistant"; content: string; }

interface Amendment {
  id: string;
  description: string;
  dataset: string;
  matchField: string;
  matchValue: string | number;
  changes: Record<string, unknown>;
  reason?: string;
  status: "pending" | "applying" | "approved" | "rejected" | "error";
  resultText?: string;
}

interface MsgWithAmendments {
  role: "user" | "assistant";
  content: string;          // display text (amendment blocks stripped out)
  raw: string;              // original text incl. blocks
  amendments: Amendment[];
}

// ─── Amendment parsing ────────────────────────────────────────────────────────

const AMEND_RE = /---AMENDMENT---\s*([\s\S]*?)\s*---END_AMENDMENT---/g;

function parseAmendments(text: string, msgIdx: number): Amendment[] {
  const results: Amendment[] = [];
  let match;
  AMEND_RE.lastIndex = 0;
  while ((match = AMEND_RE.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[1].trim());
      results.push({
        id: `amend-${msgIdx}-${results.length}`,
        description: obj.description ?? "Proposed change",
        dataset: obj.dataset ?? "",
        matchField: obj.matchField ?? "",
        matchValue: obj.matchValue ?? "",
        changes: obj.changes ?? {},
        reason: obj.reason,
        status: "pending",
      });
    } catch { /* skip malformed */ }
  }
  return results;
}

function stripAmendmentBlocks(text: string): string {
  return text.replace(/---AMENDMENT---[\s\S]*?---END_AMENDMENT---/g, "").trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AmendmentCard({
  amend,
  onApprove,
  onReject,
}: {
  amend: Amendment;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div style={{
      border: `2px solid ${amend.status === "approved" ? "var(--green)" : amend.status === "rejected" ? "var(--border)" : "var(--accent)"}`,
      borderRadius: 10, padding: "12px 14px", marginTop: 8, background: "var(--surface2)", fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{
          background: amend.status === "approved" ? "var(--green)" : amend.status === "rejected" ? "var(--text4)" : "var(--accent)",
          color: "#fff", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        }}>
          {amend.status === "applying" ? "Applying…" : amend.status}
        </span>
        ✏️ {amend.description}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ color: "var(--text3)", paddingRight: 10, width: 110, verticalAlign: "top" }}>Dataset</td>
            <td><code style={{ background: "var(--surface)", padding: "1px 5px", borderRadius: 3 }}>{amend.dataset}</code></td>
          </tr>
          <tr>
            <td style={{ color: "var(--text3)", paddingRight: 10, verticalAlign: "top" }}>Match</td>
            <td><code style={{ background: "var(--surface)", padding: "1px 5px", borderRadius: 3 }}>{amend.matchField} = {String(amend.matchValue)}</code></td>
          </tr>
          <tr>
            <td style={{ color: "var(--text3)", paddingRight: 10, verticalAlign: "top" }}>Changes</td>
            <td>
              {Object.entries(amend.changes).map(([k, v]) => (
                <div key={k}>
                  <code style={{ background: "var(--surface)", padding: "1px 5px", borderRadius: 3 }}>{k}</code>
                  {" → "}
                  <strong>{String(v)}</strong>
                </div>
              ))}
            </td>
          </tr>
          {amend.reason && (
            <tr>
              <td style={{ color: "var(--text3)", paddingRight: 10, verticalAlign: "top" }}>Reason</td>
              <td style={{ color: "var(--text2)", fontStyle: "italic" }}>{amend.reason}</td>
            </tr>
          )}
        </tbody>
      </table>

      {amend.status === "pending" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ background: "var(--green)", fontSize: 12, padding: "5px 14px" }} onClick={onApprove}>
            ✅ Approve &amp; Apply
          </button>
          <button className="btn" style={{ background: "var(--text3)", fontSize: 12, padding: "5px 14px" }} onClick={onReject}>
            ✗ Reject
          </button>
        </div>
      )}
      {amend.resultText && (
        <div style={{ marginTop: 6, fontSize: 11, color: amend.status === "error" ? "var(--red)" : "var(--green)" }}>
          {amend.resultText}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  amendments,
  onApprove,
  onReject,
}: {
  msg: MsgWithAmendments;
  amendments: Amendment[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4, marginBottom: 8 }}>
      <div style={{
        maxWidth: "85%", padding: "9px 13px", borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.55,
        background: isUser ? "var(--accent)" : "var(--surface2)",
        color: isUser ? "#fff" : "var(--text)",
        border: isUser ? "none" : "1px solid var(--border)",
      }}>
        {msg.content || <em style={{ opacity: 0.5 }}>…</em>}
      </div>
      {amendments.map((a) => (
        <div key={a.id} style={{ width: "85%", alignSelf: "flex-start" }}>
          <AmendmentCard amend={a} onApprove={() => onApprove(a.id)} onReject={() => onReject(a.id)} />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  portfolioId: string;
  portfolioLabel: string;
  /** When provided, the assistant reviews only this freshly-merged file (upload-review mode) */
  parseResult?: ParseResult;
}

export default function ReconcileAssistant({ portfolioId, portfolioLabel, parseResult }: Props) {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [messages, setMessages] = useState<MsgWithAmendments[]>([]);
  const [allAmendments, setAllAmendments] = useState<Record<string, Amendment>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-trigger once on mount with a context-specific opening message
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    let initMsg: string;
    if (parseResult) {
      const parts: string[] = [`I just uploaded and merged **${parseResult.filename}** into ${portfolioLabel}.`];
      if (parseResult.trades.length)      parts.push(`${parseResult.trades.length} trade(s)`);
      if (parseResult.dividends.length)   parts.push(`${parseResult.dividends.length} dividend(s)`);
      if (parseResult.cashEntries.length) parts.push(`${parseResult.cashEntries.length} cash entries`);
      initMsg = parts.join(" — ") + " were added.\n\nPlease review these specific records and let me know if anything looks wrong, uncategorised, or needs correction.";
    } else {
      initMsg = `Please analyse the reconciliation data for ${portfolioLabel} and identify any discrepancies, uncategorised entries, or items that need review.`;
    }
    sendMessage(initMsg, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string, isInit = false) {
    const userMsg: MsgWithAmendments = { role: "user", content: text, raw: text, amendments: [] };
    const newMessages = isInit ? [userMsg] : [...messages, userMsg];
    if (!isInit) setMessages(newMessages);
    else setMessages(newMessages);
    setBusy(true);

    // Build messages array for API (role+content only)
    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.raw }));

    try {
      const mode = parseResult ? "upload-review" : "reconcile";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portfolioId, provider, mode, messages: apiMessages, parseResult }),
      });
      const data = await res.json();
      const replyRaw: string = data.ok ? data.reply : `⚠️ ${data.error}`;

      const msgIdx = newMessages.length;
      const parsed = parseAmendments(replyRaw, msgIdx);
      const displayText = stripAmendmentBlocks(replyRaw);

      const assistantMsg: MsgWithAmendments = {
        role: "assistant",
        content: displayText,
        raw: replyRaw,
        amendments: parsed,
      };

      // Register new amendments in global map
      if (parsed.length > 0) {
        setAllAmendments((prev) => {
          const next = { ...prev };
          parsed.forEach((a) => { next[a.id] = a; });
          return next;
        });
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errMsg: MsgWithAmendments = {
        role: "assistant", content: `⚠️ ${String(e)}`, raw: String(e), amendments: [],
      };
      setMessages((prev) => [...prev, errMsg]);
    }
    setBusy(false);
  }

  async function approveAmendment(id: string) {
    const amend = allAmendments[id];
    if (!amend) return;

    // Optimistic: set to applying
    updateAmendStatus(id, "applying");

    try {
      const res = await fetch("/api/amendments/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataset: amend.dataset,
          matchField: amend.matchField,
          matchValue: amend.matchValue,
          changes: amend.changes,
          reason: amend.reason,
          portfolioId,
          approved: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        updateAmendStatus(id, "approved", `✅ Applied — ${data.applied} row(s) updated. Decision ID: ${data.decisionId}`);
        // Add a follow-up user message so the LLM knows it was approved
        const followUp = `Amendment approved and applied: "${amend.description}" (${data.applied} row(s) updated). Please continue the analysis.`;
        await sendMessage(followUp);
      } else {
        updateAmendStatus(id, "error", `Error: ${data.error}`);
      }
    } catch (e) {
      updateAmendStatus(id, "error", `Network error: ${String(e)}`);
    }
  }

  function rejectAmendment(id: string) {
    updateAmendStatus(id, "rejected", "Rejected by user.");
    const amend = allAmendments[id];
    if (amend) {
      sendMessage(`Amendment rejected: "${amend.description}". Please note this decision and continue the analysis.`);
    }
  }

  function updateAmendStatus(id: string, status: Amendment["status"], resultText?: string) {
    setAllAmendments((prev) => ({
      ...prev,
      [id]: { ...prev[id], status, ...(resultText ? { resultText } : {}) },
    }));
    // Also update inside message list
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        amendments: m.amendments.map((a) =>
          a.id === id ? { ...a, status, ...(resultText ? { resultText } : {}) } : a
        ),
      }))
    );
  }

  function handleSend() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    sendMessage(q);
  }

  const pendingCount = Object.values(allAmendments).filter((a) => a.status === "pending").length;
  const approvedCount = Object.values(allAmendments).filter((a) => a.status === "approved").length;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            <span className="dot" style={{ background: "#7c3aed" }} />
            🤖 Reconciliation Assistant — {portfolioLabel}
          </div>
          <div style={{ fontSize: 11, color: "var(--text4)" }}>
            Analyses reconciliation output · Proposes corrections · Requires your approval before any change is written
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pendingCount > 0 && (
            <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
              {pendingCount} pending
            </span>
          )}
          {approvedCount > 0 && (
            <span style={{ background: "var(--green)", color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
              {approvedCount} approved
            </span>
          )}
          <LlmProviderSelect value={provider} onChange={setProvider} />
        </div>
      </div>

      {/* Message thread */}
      <div style={{
        minHeight: 220, maxHeight: 520, overflowY: "auto",
        padding: "4px 0", display: "flex", flexDirection: "column",
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
        marginBottom: 10,
      }}>
        {messages.length === 0 && !busy && (
          <p className="note" style={{ padding: "12px 0" }}>Starting analysis…</p>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            msg={m}
            amendments={m.amendments.map((a) => allAmendments[a.id] ?? a)}
            onApprove={approveAmendment}
            onReject={rejectAmendment}
          />
        ))}
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s infinite" }} />
            <span className="note">Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="table-controls">
        <input
          className="search-input"
          style={{ flex: 1, width: "auto" }}
          placeholder="Ask a follow-up question or give more context…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          disabled={busy}
        />
        <button className="btn" onClick={handleSend} disabled={busy || !input.trim()}>Send</button>
      </div>
      <p className="note" style={{ marginTop: 6 }}>
        ⚠️ No data is changed until you click <strong>Approve &amp; Apply</strong> on each proposed amendment.
        All approvals are recorded in reconciliation-decisions.json.
      </p>
    </div>
  );
}
