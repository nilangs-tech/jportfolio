"use client";
import { useMemo, useState } from "react";
import type { HoldingRow } from "@/lib/types";

type SortKey = "code" | "units" | "avg" | "basis" | "oprice" | "price" | "mtmgain" | "mtmpct" | "mktval" | "unr" | "unrpct" | "weight";
type FilterKey = "all" | "new" | "changed" | "hold" | "gain" | "loss";

const n = (v: number, d = 0) => v.toLocaleString("en-AU", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function HoldingsTable({ holdings, showStatus = true }: { holdings: HoldingRow[]; showStatus?: boolean }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortCol, setSortCol] = useState<SortKey>("basis");
  const [sortDir, setSortDir] = useState(-1);

  const totalMkt = useMemo(() => holdings.reduce((s, h) => s + (h.current_market_value ?? 0), 0), [holdings]);
  const maxMkt = useMemo(() => Math.max(1, ...holdings.map((h) => h.current_market_value ?? 0)), [holdings]);

  const rows = useMemo(() => {
    const unr = (h: HoldingRow) => (h.current_market_value ?? 0) - (h.cost_base ?? 0);
    let r = holdings.filter((h) => {
      if (q && !h.symbol.toUpperCase().includes(q.toUpperCase())) return false;
      if (filter === "new") return h.position_status === "new";
      if (filter === "changed") return h.position_status === "changed";
      if (filter === "hold") return h.position_status === "unchanged";
      if (filter === "gain") return unr(h) > 0;
      if (filter === "loss") return unr(h) < 0;
      return true;
    });
    const key = (h: HoldingRow): number | string => {
      switch (sortCol) {
        case "code": return h.symbol;
        case "units": return h.units;
        case "avg": return h.avg_cost ?? 0;
        case "basis": case "weight": return h.cost_base ?? 0;
        case "oprice": return h.opening_price ?? 0;
        case "price": return h.current_price ?? 0;
        case "mtmgain": return h.market_to_market_gain ?? 0;
        case "mtmpct": return h.market_to_market_pct ?? 0;
        case "mktval": return h.current_market_value ?? 0;
        case "unr": return unr(h);
        case "unrpct": return (h.cost_base ?? 0) > 0 ? (unr(h) / (h.cost_base ?? 1)) * 100 : 0;
      }
    };
    r = [...r].sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (typeof ka === "string" || typeof kb === "string") return sortDir * (ka < kb ? -1 : 1);
      return sortDir * (ka - kb);
    });
    return r;
  }, [holdings, q, filter, sortCol, sortDir]);

  const sortBy = (col: SortKey) => {
    if (sortCol === col) setSortDir((d) => -d);
    else { setSortCol(col); setSortDir(-1); }
  };
  const th = (col: SortKey, label: string, right = true) => (
    <th onClick={() => sortBy(col)} className={`${right ? "right" : ""} ${sortCol === col ? "sorted" : ""}`}>{label}{sortCol === col ? (sortDir < 0 ? " ↓" : " ↑") : ""}</th>
  );

  const filters: [FilterKey, string][] = [["all", `All (${holdings.length})`], ["new", "New"], ["changed", "Changed"], ["hold", "Unchanged"], ["gain", "Gainers"], ["loss", "Losers"]];

  return (
    <div>
      <div className="table-controls">
        <input className="search-input" placeholder="Search ticker…" value={q} onChange={(e) => setQ(e.target.value)} />
        {filters.map(([f, lbl]) => (
          <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{lbl}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text4)" }}>{rows.length} positions</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("code", "Code", false)}
              {th("units", "Units")}
              {th("avg", "Avg Cost")}
              {th("basis", "Cost Basis")}
              {th("oprice", "Open Px")}
              {th("price", "Curr Px")}
              {th("mtmgain", "FY26 Mkt Δ $")}
              {th("mtmpct", "FY26 Mkt Δ %")}
              {th("mktval", "Mkt Value")}
              {th("unr", "Unr. P&L $")}
              {th("unrpct", "Unr. P&L %")}
              {showStatus ? <th>Status</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const mkt = h.current_market_value ?? 0;
              const unr = mkt - (h.cost_base ?? 0);
              const unrpct = (h.cost_base ?? 0) > 0 ? (unr / (h.cost_base ?? 1)) * 100 : 0;
              const bW = Math.round((mkt / maxMkt) * 80);
              const unrColor = unr >= 0 ? "var(--green)" : "var(--red)";
              const tag = h.position_status === "delisted" ? <span className="tag tag-delisted">Delisted</span>
                : h.position_status === "new" ? <span className="tag tag-new">New</span>
                  : h.position_status === "changed" ? <span className="tag tag-changed">Changed</span>
                    : <span className="tag tag-hold">Hold</span>;
              return (
                <tr key={h.symbol}>
                  <td style={{ fontWeight: 700 }}>{h.symbol}</td>
                  <td className="right">{n(h.units)}</td>
                  <td className="right">${(h.avg_cost ?? 0).toFixed(4)}</td>
                  <td className="right"><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: bW, background: "#bfdbfe" }} />${n(h.cost_base ?? 0)}</div></td>
                  <td className="right">{h.opening_price != null ? `$${h.opening_price.toFixed(3)}` : <span style={{ color: "#d1d5db" }}>New</span>}</td>
                  <td className="right" style={{ fontWeight: 600 }}>{h.current_price != null ? `$${h.current_price.toFixed(3)}` : "—"}</td>
                  <td className="right">{h.market_to_market_gain != null ? <span style={{ color: h.market_to_market_gain >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{h.market_to_market_gain >= 0 ? "+" : "−"}${n(Math.abs(h.market_to_market_gain))}</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td className="right">{h.market_to_market_pct != null ? <span style={{ color: h.market_to_market_pct >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{h.market_to_market_pct >= 0 ? "+" : ""}{h.market_to_market_pct.toFixed(1)}%</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td className="right"><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: bW, background: unr >= 0 ? "#bbf7d0" : "#fecaca" }} />${n(mkt)}</div></td>
                  <td className="right" style={{ color: unrColor, fontWeight: 700 }}>{unr >= 0 ? "+" : "−"}${n(Math.abs(unr))}</td>
                  <td className="right" style={{ color: unrColor, fontWeight: 700 }}>{unrpct >= 0 ? "+" : ""}{unrpct.toFixed(1)}%</td>
                  {showStatus ? <td>{tag}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
