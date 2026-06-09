"use client";
import { useState } from "react";
import { Shell, HostedNotice } from "@/components/LocalPageShell";
import StatementReview from "@/components/StatementReview";
import type { ParseResult } from "@/lib/statementParser/types";

const MODE = process.env.NEXT_PUBLIC_APP_MODE ?? "hosted";

type Stage = "pick" | "parsing" | "review";

export default function UploadPage() {
  const [portfolioId, setPortfolioId] = useState("portfolio_1");
  const [files, setFiles] = useState<FileList | null>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [results, setResults] = useState<ParseResult[]>([]);
  const [mergedCount, setMergedCount] = useState(0);
  const [error, setError] = useState("");

  if (MODE !== "local") return <HostedNotice feature="Statement upload" />;

  async function parseFiles() {
    if (!files || files.length === 0) { setError("Choose one or more files first."); return; }
    setError(""); setStage("parsing"); setResults([]);

    const parsed: ParseResult[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("portfolioId", portfolioId);
      fd.append("file", file);
      try {
        const res = await fetch("/api/parse-statement", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) parsed.push(data.result);
        else setError((e) => e + `\n${file.name}: ${data.error}`);
      } catch (e) {
        setError((prev) => prev + `\n${file.name}: ${String(e)}`);
      }
    }

    setResults(parsed);
    setStage("review");
  }

  function onMerged() {
    setMergedCount((c) => c + 1);
  }

  function discard(idx: number) {
    setResults((r) => r.filter((_, i) => i !== idx));
  }

  function reset() {
    setStage("pick"); setFiles(null); setResults([]); setMergedCount(0); setError("");
  }

  return (
    <Shell
      title="📤 Upload Statements"
      subtitle="Upload CommSec CSV, Stake XLSX (Activity / Income / Cash), or CommBank CSV. Data is parsed locally — review before merging."
    >
      {/* Step 1: Pick files */}
      <div className="card">
        <div className="table-controls">
          <label style={{ fontSize: 12, fontWeight: 600 }}>Portfolio:</label>
          <select
            className="search-input" style={{ width: "auto" }}
            value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}
            disabled={stage === "parsing"}
          >
            <option value="portfolio_1">Portfolio 1</option>
            <option value="portfolio_2">Portfolio 2</option>
          </select>
        </div>

        <input
          type="file" multiple accept=".csv,.xlsx,.xls,.pdf"
          onChange={(e) => { setFiles(e.target.files); setStage("pick"); setResults([]); setError(""); }}
          style={{ margin: "10px 0" }}
          disabled={stage === "parsing"}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={parseFiles} disabled={stage === "parsing" || !files || files.length === 0}>
            {stage === "parsing" ? "Parsing…" : "Parse & Preview"}
          </button>
          {(stage === "review" || mergedCount > 0) && (
            <button className="btn btn-ghost" onClick={reset}>Start over</button>
          )}
        </div>

        {error && <pre className="note" style={{ color: "var(--red)", whiteSpace: "pre-wrap", fontSize: 12 }}>{error.trim()}</pre>}

        {/* Supported formats hint */}
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text4)", lineHeight: 1.6 }}>
          <strong>Supported formats:</strong><br />
          • <strong>CommSec CSV</strong> — brokerage account transactions (trades + cash)<br />
          • <strong>Stake XLSX</strong> — Investment Activity, Investment Income, Cash Transactions<br />
          • <strong>CommBank / cash CSV</strong> — any Date + Amount + Description format<br />
          • <strong>PDF</strong> — not yet supported (convert to CSV first)
        </div>
      </div>

      {/* Step 2: Review each parsed file */}
      {results.map((result, i) => (
        <StatementReview
          key={`${result.filename}-${i}`}
          result={result}
          onMerge={onMerged}
          onDiscard={() => discard(i)}
        />
      ))}

      {/* Step 3: Done banner */}
      {mergedCount > 0 && (
        <div className="mode-banner mode-local" style={{ marginTop: 12 }}>
          ✅ {mergedCount} file(s) merged into the dashboard.{" "}
          <a className="tool-link" href="/reconcile">Run Reconciliation</a> to review and correct the data.
        </div>
      )}
    </Shell>
  );
}
