"use client";
import { useState } from "react";
import LlmProviderSelect, { type Provider } from "@/components/LlmProviderSelect";
import { Shell, HostedNotice } from "@/components/LocalPageShell";
import ReconcileAssistant from "@/components/ReconcileAssistant";

const MODE = process.env.NEXT_PUBLIC_APP_MODE ?? "hosted";

const PORTFOLIO_LABELS: Record<string, string> = {
  portfolio_1: "Portfolio 1",
  portfolio_2: "Portfolio 2",
};

interface RunResult {
  ok: boolean;
  portfolioIds?: string[];
  filesWritten?: string[];
  runId?: string;
  error?: string;
}

export default function ReconcilePage() {
  const [p1, setP1] = useState(true);
  const [p2, setP2] = useState(true);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [runPython, setRunPython] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");

  if (MODE !== "local") return <HostedNotice feature="Reconciliation" />;

  const portfolioIds = [p1 ? "portfolio_1" : null, p2 ? "portfolio_2" : null].filter(Boolean) as string[];

  async function run() {
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portfolioIds, provider, runPythonFirst: runPython }),
      });
      const data: RunResult = await res.json();
      if (data.ok) setResult(data);
      else setError(data.error ?? "Reconciliation failed.");
    } catch (e) { setError(String(e)); }
    setBusy(false);
  }

  // Build a human-readable summary of the run to seed the assistant's opening message
  const runSummary = result
    ? `Portfolios processed: ${(result.portfolioIds ?? []).map((id) => PORTFOLIO_LABELS[id] ?? id).join(", ")}. ` +
      `Files written: ${(result.filesWritten ?? []).join(", ") || "none"}.`
    : undefined;

  return (
    <Shell title="🔄 Run Reconciliation" subtitle="Hybrid engine: TypeScript orchestrates the Python reconciliation, then writes the dashboard JSON contract.">
      <div className="card">
        <div className="table-controls">
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={p1} onChange={(e) => setP1(e.target.checked)} /> Portfolio 1</label>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={p2} onChange={(e) => setP2(e.target.checked)} /> Portfolio 2</label>
          <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 600 }}>LLM Provider:</span>
          <LlmProviderSelect value={provider} onChange={setProvider} />
          <label style={{ fontSize: 13, marginLeft: 12 }}>
            <input type="checkbox" checked={runPython} onChange={(e) => setRunPython(e.target.checked)} /> Re-run Python engine first
          </label>
        </div>
        <button className="btn" disabled={busy || portfolioIds.length === 0} onClick={run}>
          {busy ? "Reconciling…" : "Run Reconciliation"}
        </button>
        <p className="note">The LLM ({provider}) powers the assistant below; figures are produced deterministically by the Python engine + adapter.</p>

        {error && (
          <div className="mode-banner mode-warn" style={{ marginTop: 12 }}>⚠️ {error}</div>
        )}

        {result && (
          <div className="mode-banner mode-local" style={{ marginTop: 12 }}>
            ✅ Reconciliation complete — {(result.filesWritten ?? []).length} file(s) written.
            {result.filesWritten && result.filesWritten.length > 0 && (
              <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: 8 }}>
                ({result.filesWritten.join(", ")})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Reconciliation assistant — appears after a successful run */}
      {result && (
        <>
          {portfolioIds.map((pid) => (
            <ReconcileAssistant
              key={pid}
              portfolioId={pid}
              portfolioLabel={PORTFOLIO_LABELS[pid] ?? pid}
              runSummary={runSummary}
            />
          ))}
        </>
      )}

      {/* Also allow opening the assistant without running (to review last reconciliation) */}
      {!result && (
        <div style={{ marginTop: 14 }}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text3)", userSelect: "none" }}>
              📋 Review previous reconciliation with assistant (without re-running)
            </summary>
            <div style={{ marginTop: 10 }}>
              {portfolioIds.map((pid) => (
                <ReconcileAssistant
                  key={pid}
                  portfolioId={pid}
                  portfolioLabel={PORTFOLIO_LABELS[pid] ?? pid}
                />
              ))}
            </div>
          </details>
        </div>
      )}
    </Shell>
  );
}
