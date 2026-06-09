"use client";
import { useState } from "react";
import { Shell, HostedNotice } from "@/components/LocalPageShell";

const MODE = process.env.NEXT_PUBLIC_APP_MODE ?? "hosted";

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
        body: JSON.stringify({ portfolioIds, runPythonFirst: runPython }),
      });
      const data: RunResult = await res.json();
      if (data.ok) setResult(data);
      else setError(data.error ?? "Reconciliation failed.");
    } catch (e) { setError(String(e)); }
    setBusy(false);
  }

  return (
    <Shell
      title="🔄 Run Reconciliation"
      subtitle="Re-runs the Python engine and refreshes the dashboard JSON from vault data."
    >
      <div className="card">
        <p className="note" style={{ marginBottom: 10 }}>
          Use this to re-process all existing vault data through the Python engine.
          To upload a new statement, go to <a className="tool-link" href="/upload">Upload</a> — the review assistant runs automatically after upload.
        </p>

        <div className="table-controls">
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={p1} onChange={(e) => setP1(e.target.checked)} /> Portfolio 1
          </label>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={p2} onChange={(e) => setP2(e.target.checked)} /> Portfolio 2
          </label>
          <label style={{ fontSize: 13, marginLeft: 12 }}>
            <input type="checkbox" checked={runPython} onChange={(e) => setRunPython(e.target.checked)} /> Re-run Python engine first
          </label>
        </div>

        <button className="btn" disabled={busy || portfolioIds.length === 0} onClick={run} style={{ marginTop: 8 }}>
          {busy ? "Reconciling…" : "Run Reconciliation"}
        </button>

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
    </Shell>
  );
}
