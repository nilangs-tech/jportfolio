"use client";
import { useState } from "react";
import LlmProviderSelect, { type Provider } from "@/components/LlmProviderSelect";
import { Shell, HostedNotice } from "@/components/LocalPageShell";

const MODE = process.env.NEXT_PUBLIC_APP_MODE ?? "hosted";

export default function ReconcilePage() {
  const [p1, setP1] = useState(true);
  const [p2, setP2] = useState(true);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [runPython, setRunPython] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  if (MODE !== "local") return <HostedNotice feature="Reconciliation" />;

  async function run() {
    setBusy(true); setError(""); setResult(null);
    const portfolioIds = [p1 ? "portfolio_1" : null, p2 ? "portfolio_2" : null].filter(Boolean);
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portfolioIds, provider, runPythonFirst: runPython }),
      });
      const data = await res.json();
      if (data.ok) setResult(data); else setError(data.error ?? "Reconciliation failed.");
    } catch (e) { setError(String(e)); }
    setBusy(false);
  }

  return (
    <Shell title="🔄 Run Reconciliation" subtitle="Hybrid engine: TypeScript orchestrates the Python reconciliation, then writes the dashboard JSON contract.">
      <div className="card">
        <div className="table-controls">
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={p1} onChange={(e) => setP1(e.target.checked)} /> Portfolio 1</label>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={p2} onChange={(e) => setP2(e.target.checked)} /> Portfolio 2</label>
          <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 600 }}>Provider:</span>
          <LlmProviderSelect value={provider} onChange={setProvider} />
          <label style={{ fontSize: 13, marginLeft: 12 }}><input type="checkbox" checked={runPython} onChange={(e) => setRunPython(e.target.checked)} /> Re-run Python engine first</label>
        </div>
        <button className="btn" disabled={busy} onClick={run}>{busy ? "Reconciling…" : "Run Reconciliation"}</button>
        <p className="note">The LLM ({provider}) powers chat &amp; clarifications; the figures themselves are produced deterministically by the Python engine + adapter.</p>
        {error ? <div className="mode-banner mode-warn" style={{ marginTop: 12 }}>⚠️ {error}</div> : null}
        {result ? <pre style={{ marginTop: 12, fontSize: 11, background: "var(--surface2)", padding: 12, borderRadius: 8, overflowX: "auto" }}>{JSON.stringify(result, null, 2)}</pre> : null}
      </div>
    </Shell>
  );
}
