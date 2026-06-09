"use client";
import { useState } from "react";
import type { ParseResult, ParsedTrade, ParsedDividend, ParsedCashEntry } from "@/lib/statementParser/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ReversalInfo {
  amount: number;
  daysBetween: number;
  reason: string;
  debit:  { date: string; description: string; amount: number };
  credit: { date: string; description: string; amount: number };
}

interface Props {
  result: ParseResult;
  onMerge: (reversals: ReversalInfo[]) => void;
  onDiscard: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  commsec_csv:           "CommSec CSV",
  stake_activity_xlsx:   "Stake – Investment Activity",
  stake_income_xlsx:     "Stake – Investment Income",
  stake_cash_xlsx:       "Stake – Cash Transactions",
  commbank_cash_csv:     "Cash Account CSV",
  unknown_csv:           "Unknown CSV",
  unknown_xlsx:          "Unknown XLSX",
  pdf_llm:               "PDF",
};

const CASH_CATEGORIES: { value: string; label: string }[] = [
  { value: "pension",    label: "Pension payment" },
  { value: "dividend",   label: "Dividend / Distribution" },
  { value: "interest",   label: "Interest income" },
  { value: "fee",        label: "Fee / Expense" },
  { value: "ato_refund", label: "ATO refund / Tax return" },
  { value: "transfer",   label: "Transfer" },
  { value: "trade",      label: "Trade / Brokerage" },
  { value: "other",      label: "Other" },
];

const TRADE_TYPES: { value: string; label: string }[] = [
  { value: "buy",  label: "Buy" },
  { value: "sell", label: "Sell" },
];

const DIV_TYPES: { value: string; label: string }[] = [
  { value: "Dividend",       label: "Dividend" },
  { value: "Distribution",   label: "Distribution" },
  { value: "DRP",            label: "DRP / Reinvestment" },
  { value: "Special",        label: "Special dividend" },
];

const fmt  = (n: number) => "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number | undefined | null) => n != null && n !== 0 ? fmt(n) : "—";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allIdx(len: number) { return new Set(Array.from({ length: len }, (_, i) => i)); }

function SelectAllCheckbox({
  total, selected, onChange,
}: { total: number; selected: Set<number>; onChange: (s: Set<number>) => void }) {
  const all = selected.size === total;
  const some = selected.size > 0 && !all;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", userSelect: "none" }}>
      <input
        type="checkbox"
        checked={all}
        ref={(el) => { if (el) el.indeterminate = some; }}
        onChange={() => onChange(all ? new Set() : allIdx(total))}
      />
      {all ? "Deselect all" : some ? `${selected.size} selected` : "Select all"}
    </label>
  );
}

function RowCheckbox({ idx, selected, onChange }: { idx: number; selected: Set<number>; onChange: (s: Set<number>) => void }) {
  return (
    <input
      type="checkbox"
      checked={selected.has(idx)}
      onChange={(e) => {
        const next = new Set(selected);
        e.target.checked ? next.add(idx) : next.delete(idx);
        onChange(next);
      }}
    />
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="search-input"
      style={{ fontSize: 11, padding: "2px 4px", minWidth: 150 }}
    >
      {CASH_CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StatementReview({ result, onMerge, onDiscard }: Props) {
  const [tab, setTab] = useState<"trades" | "dividends" | "cash">(
    result.trades.length > 0 ? "trades" : result.dividends.length > 0 ? "dividends" : "cash"
  );

  // Selection state — default all selected
  const [selTrades, setSelTrades] = useState<Set<number>>(() => allIdx(result.trades.length));
  const [selDivs,   setSelDivs]   = useState<Set<number>>(() => allIdx(result.dividends.length));
  const [selCash,   setSelCash]   = useState<Set<number>>(() => allIdx(result.cashEntries.length));

  // Editable category/type overrides keyed by row index
  const [cashCats,   setCashCats]   = useState<Record<number, string>>({});
  const [tradeTypes, setTradeTypes] = useState<Record<number, string>>({});
  const [divTypes,   setDivTypes]   = useState<Record<number, string>>({});

  // Merge state
  const [merging,     setMerging]     = useState(false);
  const [mergeResult, setMergeResult] = useState<{
    added: Record<string, number>;
    skipped: Record<string, number>;
    filesWritten: string[];
    reversals: ReversalInfo[];
    statsUpdated?: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState("");

  const totalSelected = selTrades.size + selDivs.size + selCash.size;
  const totalParsed   = result.trades.length + result.dividends.length + result.cashEntries.length;
  const hasNothing    = totalParsed === 0;

  // Build the filtered ParseResult from current selections + edits.
  // Iterate original indices directly so override maps (tradeTypes / cashCats)
  // are looked up with the same key they were stored under — no indexOf needed.
  function buildMergePayload(): ParseResult {
    const trades = Array.from(selTrades)
      .sort((a, b) => a - b)
      .map((i) => {
        const t = result.trades[i];
        return tradeTypes[i] ? { ...t, type: tradeTypes[i] as "buy" | "sell" } : t;
      });

    const dividends = Array.from(selDivs)
      .sort((a, b) => a - b)
      .map((i) => {
        const d = result.dividends[i];
        return divTypes[i] ? { ...d, type: divTypes[i] } : d;
      });

    const cashEntries = Array.from(selCash)
      .sort((a, b) => a - b)
      .map((i) => {
        const c = result.cashEntries[i];
        return cashCats[i] ? { ...c, category: cashCats[i] } : c;
      });

    return { ...result, trades, dividends, cashEntries };
  }

  async function doMerge() {
    if (totalSelected === 0) { setError("Select at least one record to merge."); return; }
    setMerging(true); setError("");
    try {
      const payload = buildMergePayload();
      const res = await fetch("/api/merge-statement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result: payload }),
      });
      const data = await res.json();
      if (data.ok) {
        setMergeResult({ ...data, reversals: data.reversals ?? [] });
        onMerge(data.reversals ?? []);
      } else {
        setError(data.error ?? "Merge failed.");
      }
    } catch (e) { setError(String(e)); }
    setMerging(false);
  }

  // ── Post-merge success view ────────────────────────────────────────────────

  if (mergeResult) {
    const { added, skipped, filesWritten, reversals, statsUpdated } = mergeResult;
    const totalAdded = added.trades + added.dividends + added.cash;
    const fmt2 = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
    // Build stat change lines from recalc output
    type StatRow = { pid: string; closing_cash?: number; dividends?: number; mv?: number };
    const statRows: StatRow[] = Array.isArray(statsUpdated) ? statsUpdated : [];
    return (
      <div style={{ marginTop: 12 }}>
        <div className="mode-banner mode-local">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            ✅ Merged {totalAdded} record{totalAdded !== 1 ? "s" : ""}
            {totalAdded === 0 && " — all entries were duplicates"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            {added.trades > 0    && <span>🔄 {added.trades} trade{added.trades !== 1 ? "s" : ""}</span>}
            {added.dividends > 0 && <span>💰 {added.dividends} dividend{added.dividends !== 1 ? "s" : ""}</span>}
            {added.cash > 0      && <span>🏦 {added.cash} cash entr{added.cash !== 1 ? "ies" : "y"}</span>}
            {(skipped.trades + skipped.dividends + skipped.cash) > 0 &&
              <span style={{ color: "var(--text4)" }}>
                {skipped.trades + skipped.dividends + skipped.cash} duplicate{(skipped.trades + skipped.dividends + skipped.cash) !== 1 ? "s" : ""} skipped
              </span>}
          </div>

          {/* Updated portfolio stats */}
          {statRows.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {statRows.map((s) => (
                <div key={s.pid} style={{ fontSize: 11, color: "var(--text2)" }}>
                  <strong style={{ color: "var(--text3)" }}>{s.pid === "portfolio_1" ? "P1" : "P2"}</strong>
                  {" — "}
                  {s.closing_cash != null && <>💵 Cash: <strong>{fmt2(s.closing_cash)}</strong></>}
                  {s.dividends != null && <> · 💰 Divs: <strong>{fmt2(s.dividends)}</strong></>}
                  {s.mv != null && <> · 📈 MV: <strong>{fmt2(s.mv)}</strong></>}
                </div>
              ))}
            </div>
          )}

          {filesWritten.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--text4)" }}>
              Files updated: {filesWritten.map((f) => f.replace(".json", "")).join(", ")}
            </div>
          )}
        </div>

        {reversals.length > 0 && (
          <div className="mode-banner mode-warn" style={{ marginTop: 8 }}>
            <strong>⚠️ {reversals.length} reversal{reversals.length > 1 ? "s" : ""} detected</strong>
            {" — these debit/credit pairs net to zero and were excluded from the expenses panel."}
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {reversals.map((r, i) => (
                <div key={i} style={{ background: "var(--surface)", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>
                    {fmt(r.amount)} reversal ({r.daysBetween} day{r.daysBetween !== 1 ? "s" : ""} apart)
                  </div>
                  <div style={{ color: "var(--red)", marginBottom: 2 }}>↑ Debit {r.debit.date}: {r.debit.description}</div>
                  <div style={{ color: "var(--green)", marginBottom: 4 }}>↓ Credit {r.credit.date}: {r.credit.description}</div>
                  <div style={{ color: "var(--text3)", fontStyle: "italic" }}>Reason: {r.reason} — ask the assistant below to explain</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Preview view ──────────────────────────────────────────────────────────

  return (
    <div className="card" style={{ marginTop: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📄 {result.filename}</span>
        <span className="badge" style={{ background: "var(--surface2)", fontSize: 11 }}>
          {SOURCE_LABELS[result.source] ?? result.source}
        </span>
        {result.skippedRows > 0 && (
          <span className="badge" style={{ fontSize: 11, color: "var(--text4)" }}>{result.skippedRows} rows skipped during parse</span>
        )}
      </div>

      {/* Parse warnings */}
      {result.warnings.map((w, i) => (
        <div key={i} className="mode-banner mode-warn" style={{ marginBottom: 8, fontSize: 12 }}>⚠️ {w}</div>
      ))}

      {hasNothing ? (
        <p className="note">No data could be extracted from this file. {result.warnings.length === 0 ? "Check the format is supported." : ""}</p>
      ) : (
        <>
          {/* Tab selector chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {result.trades.length > 0 && (
              <button
                className={`btn btn-ghost${tab === "trades" ? " btn-active" : ""}`}
                style={{ fontSize: 12 }}
                onClick={() => setTab("trades")}
              >
                🔄 {result.trades.length} Trades
                {selTrades.size < result.trades.length && (
                  <span style={{ marginLeft: 4, color: "var(--accent)", fontWeight: 700 }}>({selTrades.size} selected)</span>
                )}
              </button>
            )}
            {result.dividends.length > 0 && (
              <button
                className={`btn btn-ghost${tab === "dividends" ? " btn-active" : ""}`}
                style={{ fontSize: 12 }}
                onClick={() => setTab("dividends")}
              >
                💰 {result.dividends.length} Dividends
                {selDivs.size < result.dividends.length && (
                  <span style={{ marginLeft: 4, color: "var(--accent)", fontWeight: 700 }}>({selDivs.size} selected)</span>
                )}
              </button>
            )}
            {result.cashEntries.length > 0 && (
              <button
                className={`btn btn-ghost${tab === "cash" ? " btn-active" : ""}`}
                style={{ fontSize: 12 }}
                onClick={() => setTab("cash")}
              >
                🏦 {result.cashEntries.length} Cash entries
                {selCash.size < result.cashEntries.length && (
                  <span style={{ marginLeft: 4, color: "var(--accent)", fontWeight: 700 }}>({selCash.size} selected)</span>
                )}
              </button>
            )}
          </div>

          {/* ── Trades table ── */}
          {tab === "trades" && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <SelectAllCheckbox total={result.trades.length} selected={selTrades} onChange={setSelTrades} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="holdings-table" style={{ fontSize: 12, width: "100%" }}>
                  <thead><tr>
                    <th style={{ width: 28 }}></th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Symbol</th>
                    <th style={{ textAlign: "right" }}>Units</th>
                    <th style={{ textAlign: "right" }}>Price</th>
                    <th style={{ textAlign: "right" }}>Brokerage</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {(result.trades as ParsedTrade[]).map((t, i) => {
                      const currentType = tradeTypes[i] ?? t.type;
                      return (
                        <tr key={i} style={{ opacity: selTrades.has(i) ? 1 : 0.4 }}>
                          <td><RowCheckbox idx={i} selected={selTrades} onChange={setSelTrades} /></td>
                          <td>{t.date}</td>
                          <td>
                            <select
                              value={currentType}
                              onChange={(e) => setTradeTypes((p) => ({ ...p, [i]: e.target.value }))}
                              className="search-input"
                              style={{ fontSize: 11, padding: "2px 4px", color: currentType === "buy" ? "var(--green)" : "var(--red)", fontWeight: 700 }}
                            >
                              {TRADE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                          <td style={{ textAlign: "right" }}>{t.units.toLocaleString()}</td>
                          <td style={{ textAlign: "right" }}>{fmt(t.price)}</td>
                          <td style={{ textAlign: "right" }}>{fmtN(t.brokerage)}</td>
                          <td style={{ textAlign: "right" }}>{fmt(t.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Dividends table ── */}
          {tab === "dividends" && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <SelectAllCheckbox total={result.dividends.length} selected={selDivs} onChange={setSelDivs} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="holdings-table" style={{ fontSize: 12, width: "100%" }}>
                  <thead><tr>
                    <th style={{ width: 28 }}></th>
                    <th>Pay Date</th>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "right" }}>Franked</th>
                    <th style={{ textAlign: "right" }}>Franking Credit</th>
                  </tr></thead>
                  <tbody>
                    {(result.dividends as ParsedDividend[]).map((d, i) => {
                      const currentType = divTypes[i] ?? d.type ?? "Dividend";
                      return (
                        <tr key={i} style={{ opacity: selDivs.has(i) ? 1 : 0.4 }}>
                          <td><RowCheckbox idx={i} selected={selDivs} onChange={setSelDivs} /></td>
                          <td>{d.date}</td>
                          <td style={{ fontWeight: 600 }}>{d.symbol}</td>
                          <td>
                            <select
                              value={currentType}
                              onChange={(e) => setDivTypes((p) => ({ ...p, [i]: e.target.value }))}
                              className="search-input"
                              style={{ fontSize: 11, padding: "2px 4px" }}
                            >
                              {DIV_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ textAlign: "right" }}>{fmt(d.amount)}</td>
                          <td style={{ textAlign: "right" }}>{fmtN(d.franked)}</td>
                          <td style={{ textAlign: "right" }}>{fmtN(d.franking_credit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Cash table ── */}
          {tab === "cash" && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <SelectAllCheckbox total={result.cashEntries.length} selected={selCash} onChange={setSelCash} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="holdings-table" style={{ fontSize: 12, width: "100%" }}>
                  <thead><tr>
                    <th style={{ width: 28 }}></th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Debit</th>
                    <th style={{ textAlign: "right" }}>Credit</th>
                  </tr></thead>
                  <tbody>
                    {(result.cashEntries as ParsedCashEntry[]).map((c, i) => {
                      const currentCat = cashCats[i] ?? c.category;
                      return (
                        <tr key={i} style={{ opacity: selCash.has(i) ? 1 : 0.4 }}>
                          <td><RowCheckbox idx={i} selected={selCash} onChange={setSelCash} /></td>
                          <td style={{ whiteSpace: "nowrap" }}>{c.date}</td>
                          <td
                            style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={c.description}
                          >
                            {c.description}
                          </td>
                          <td>
                            <CategorySelect
                              value={currentCat}
                              onChange={(v) => setCashCats((p) => ({ ...p, [i]: v }))}
                            />
                          </td>
                          <td style={{ textAlign: "right", color: c.debit > 0 ? "var(--red)" : undefined, whiteSpace: "nowrap" }}>
                            {c.debit > 0 ? fmt(c.debit) : "—"}
                          </td>
                          <td style={{ textAlign: "right", color: c.credit > 0 ? "var(--green)" : undefined, whiteSpace: "nowrap" }}>
                            {c.credit > 0 ? fmt(c.credit) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Selection summary + actions */}
          <div style={{ marginTop: 14, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn" disabled={merging || totalSelected === 0} onClick={doMerge}>
                {merging
                  ? "Merging…"
                  : totalSelected === totalParsed
                  ? `✓ Merge all ${totalSelected} records`
                  : `✓ Merge ${totalSelected} of ${totalParsed} selected records`}
              </button>
              <button className="btn btn-ghost" disabled={merging} onClick={onDiscard}>Discard</button>
              {totalSelected < totalParsed && (
                <span style={{ fontSize: 11, color: "var(--text3)" }}>
                  {totalParsed - totalSelected} record{totalParsed - totalSelected !== 1 ? "s" : ""} will be skipped
                </span>
              )}
              {error && <span style={{ fontSize: 12, color: "var(--red)" }}>⚠️ {error}</span>}
            </div>

            {/* Stats that will update */}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text4)", lineHeight: 1.8 }}>
              <strong style={{ color: "var(--text3)" }}>Stats that will update on merge:</strong>
              {selTrades.size > 0 && " cost basis · market value · MTM return ·"}
              {selDivs.size > 0 && " dividends received ·"}
              {selCash.size > 0 && (() => {
                const cats = new Set(
                  Array.from(selCash).map((i) => cashCats[i] ?? result.cashEntries[i]?.category)
                );
                const labels: string[] = [];
                if (cats.has("pension"))    labels.push("pension distributions");
                if (cats.has("interest"))   labels.push("interest income");
                if (cats.has("ato_refund")) labels.push("ATO refund");
                if (cats.has("fee"))        labels.push("operating expenses");
                if (cats.has("dividend"))   labels.push("cash dividends");
                if (cats.has("trade") || cats.has("transfer")) labels.push("cash balance");
                if (labels.length === 0)    labels.push("cash balance");
                return " " + labels.join(" · ") + " ·";
              })()}
              {" closing cash total · summary"}
            </div>
          </div>
        </>
      )}

      <p className="note" style={{ marginTop: 6 }}>
        Duplicate records (same date + symbol + amount) are automatically skipped during merge.
        Use checkboxes to exclude rows, and dropdowns to correct any misclassified categories before merging.
      </p>
    </div>
  );
}
