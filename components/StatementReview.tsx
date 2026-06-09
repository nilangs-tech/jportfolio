"use client";
import { useState } from "react";
import type { ParseResult, ParsedTrade, ParsedDividend, ParsedCashEntry } from "@/lib/statementParser/types";

interface Props {
  result: ParseResult;
  onMerge: () => void;
  onDiscard: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  commsec_csv: "CommSec CSV",
  stake_activity_xlsx: "Stake – Investment Activity",
  stake_income_xlsx: "Stake – Investment Income",
  stake_cash_xlsx: "Stake – Cash Transactions",
  commbank_cash_csv: "Cash Account CSV",
  unknown_csv: "Unknown CSV",
  unknown_xlsx: "Unknown XLSX",
  pdf_llm: "PDF",
};

const fmt = (n: number) => "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatementReview({ result, onMerge, onDiscard }: Props) {
  const [tab, setTab] = useState<"trades" | "dividends" | "cash">(
    result.trades.length > 0 ? "trades" : result.dividends.length > 0 ? "dividends" : "cash"
  );
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ added: Record<string, number>; skipped: Record<string, number>; filesWritten: string[] } | null>(null);
  const [error, setError] = useState("");

  const total = result.trades.length + result.dividends.length + result.cashEntries.length;
  const hasNothing = total === 0;

  async function doMerge() {
    setMerging(true); setError("");
    try {
      const res = await fetch("/api/merge-statement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (data.ok) { setMergeResult(data); onMerge(); }
      else setError(data.error ?? "Merge failed.");
    } catch (e) { setError(String(e)); }
    setMerging(false);
  }

  if (mergeResult) {
    const { added, skipped, filesWritten } = mergeResult;
    return (
      <div className="mode-banner mode-local" style={{ marginTop: 12 }}>
        ✅ <strong>Merged successfully</strong> — {filesWritten.join(", ")}
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text3)" }}>
          Added: {added.trades} trades · {added.dividends} dividends · {added.cash} cash entries
          {(skipped.trades + skipped.dividends + skipped.cash) > 0 &&
            ` · ${skipped.trades + skipped.dividends + skipped.cash} duplicates skipped`}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📄 {result.filename}</span>
        <span className="badge" style={{ background: "var(--surface2)", fontSize: 11 }}>{SOURCE_LABELS[result.source] ?? result.source}</span>
        {result.skippedRows > 0 && <span className="badge" style={{ fontSize: 11, color: "var(--text4)" }}>{result.skippedRows} rows skipped</span>}
      </div>

      {/* Warnings */}
      {result.warnings.map((w, i) => (
        <div key={i} className="mode-banner mode-warn" style={{ marginBottom: 8, fontSize: 12 }}>⚠️ {w}</div>
      ))}

      {hasNothing ? (
        <p className="note">No data could be extracted from this file. {result.warnings.length === 0 ? "Check the format is supported." : ""}</p>
      ) : (
        <>
          {/* Summary chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {result.trades.length > 0 && (
              <button className={`btn btn-ghost${tab === "trades" ? " btn-active" : ""}`} style={{ fontSize: 12 }} onClick={() => setTab("trades")}>
                🔄 {result.trades.length} Trades
              </button>
            )}
            {result.dividends.length > 0 && (
              <button className={`btn btn-ghost${tab === "dividends" ? " btn-active" : ""}`} style={{ fontSize: 12 }} onClick={() => setTab("dividends")}>
                💰 {result.dividends.length} Dividends
              </button>
            )}
            {result.cashEntries.length > 0 && (
              <button className={`btn btn-ghost${tab === "cash" ? " btn-active" : ""}`} style={{ fontSize: 12 }} onClick={() => setTab("cash")}>
                🏦 {result.cashEntries.length} Cash entries
              </button>
            )}
          </div>

          {/* Trades table */}
          {tab === "trades" && (
            <div style={{ overflowX: "auto" }}>
              <table className="holdings-table" style={{ fontSize: 12, width: "100%" }}>
                <thead><tr>
                  <th>Date</th><th>B/S</th><th>Symbol</th><th style={{ textAlign: "right" }}>Units</th>
                  <th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Brokerage</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr></thead>
                <tbody>
                  {(result.trades as ParsedTrade[]).map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td><span style={{ color: t.type === "buy" ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{t.type.toUpperCase()}</span></td>
                      <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                      <td style={{ textAlign: "right" }}>{t.units.toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>{fmt(t.price)}</td>
                      <td style={{ textAlign: "right" }}>{t.brokerage > 0 ? fmt(t.brokerage) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dividends table */}
          {tab === "dividends" && (
            <div style={{ overflowX: "auto" }}>
              <table className="holdings-table" style={{ fontSize: 12, width: "100%" }}>
                <thead><tr>
                  <th>Pay Date</th><th>Symbol</th><th>Type</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Franked</th>
                  <th style={{ textAlign: "right" }}>Franking Credit</th>
                </tr></thead>
                <tbody>
                  {(result.dividends as ParsedDividend[]).map((d, i) => (
                    <tr key={i}>
                      <td>{d.date}</td>
                      <td style={{ fontWeight: 600 }}>{d.symbol}</td>
                      <td style={{ color: "var(--text3)" }}>{d.type ?? "Dividend"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(d.amount)}</td>
                      <td style={{ textAlign: "right" }}>{d.franked != null ? fmt(d.franked) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{d.franking_credit != null ? fmt(d.franking_credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cash table */}
          {tab === "cash" && (
            <div style={{ overflowX: "auto" }}>
              <table className="holdings-table" style={{ fontSize: 12, width: "100%" }}>
                <thead><tr>
                  <th>Date</th><th>Description</th><th>Category</th>
                  <th style={{ textAlign: "right" }}>Debit</th>
                  <th style={{ textAlign: "right" }}>Credit</th>
                </tr></thead>
                <tbody>
                  {(result.cashEntries as ParsedCashEntry[]).map((c, i) => (
                    <tr key={i}>
                      <td>{c.date}</td>
                      <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.description}>{c.description}</td>
                      <td><span className="badge" style={{ fontSize: 10 }}>{c.category}</span></td>
                      <td style={{ textAlign: "right", color: c.debit > 0 ? "var(--red)" : undefined }}>{c.debit > 0 ? fmt(c.debit) : "—"}</td>
                      <td style={{ textAlign: "right", color: c.credit > 0 ? "var(--green)" : undefined }}>{c.credit > 0 ? fmt(c.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {!hasNothing && (
        <div className="table-controls" style={{ marginTop: 12 }}>
          <button className="btn" disabled={merging} onClick={doMerge}>
            {merging ? "Merging…" : `✓ Merge ${total} records into dashboard`}
          </button>
          <button className="btn btn-ghost" disabled={merging} onClick={onDiscard}>Discard</button>
          {error && <span style={{ fontSize: 12, color: "var(--red)" }}>⚠️ {error}</span>}
        </div>
      )}

      <p className="note" style={{ marginTop: 8 }}>
        Duplicate records (same date + symbol + amount) are automatically skipped during merge.
      </p>
    </div>
  );
}
