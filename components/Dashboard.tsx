"use client";
import { useCallback, useMemo, useState } from "react";
import type { Summary, PerformanceSummary, HoldingRow, PositionChangeRow } from "@/lib/types";
import type { UiSeries, PortfolioSeries } from "@/lib/uiSeries";
import { fmtK, money, moneyS, pctFmt } from "@/lib/format";
import { computeMetrics, computeP1PerfBridge, type ComputedMetrics } from "@/lib/computedMetrics";
import { KpiGrid, Bridge, HBarChart, MonthlyBars, MonthlyActivity } from "./Charts";
import HoldingsTable from "./HoldingsTable";
import PriceRefresh, { type LivePrices } from "./PriceRefresh";
import TodayChange, { calcDailyChange } from "./TodayChange";

interface Props {
  summary: Summary[];
  performance: PerformanceSummary[];
  holdings: HoldingRow[];
  positions: PositionChangeRow[];
  uiSeries: UiSeries;
  asOf: string;
  mode: "local" | "hosted";
}

const by = <T extends { portfolio_id: string }>(rows: T[], id: string) => rows.find((r) => r.portfolio_id === id);

// ─── Live-price helpers ───────────────────────────────────────────────────────

function applyPricesToHoldings(holdings: HoldingRow[], prices: LivePrices): HoldingRow[] {
  return holdings.map((h) => {
    const lp = prices[h.symbol];
    if (!lp) return h;
    const newPrice = lp.price;
    const newMktVal = h.units * newPrice;
    // Unrealised P&L: how much you're up/down vs what you paid
    const unrealisedPl = newMktVal - (h.cost_base ?? 0);
    // FY MTM: vs opening price for existing positions; vs avg cost for new FY positions
    const op = h.opening_price ?? null;
    const refPrice = op ?? h.avg_cost ?? null;
    const contUnits = op !== null
      ? (h.continuing_mtm_units ?? Math.min(h.opening_units ?? h.units, h.units))
      : h.units;
    const mtmGain = refPrice != null ? (newPrice - refPrice) * contUnits : null;
    const mtmPct = refPrice != null && refPrice > 0 ? ((newPrice - refPrice) / refPrice) * 100 : null;
    return { ...h, current_price: newPrice, current_market_value: newMktVal, unrealised_pl: unrealisedPl, market_to_market_gain: mtmGain, market_to_market_pct: mtmPct };
  });
}

function recalcSummary(base: Summary, holdings: HoldingRow[]): Summary {
  const pid = base.portfolio_id;
  const portHoldings = pid === "combined" ? holdings : holdings.filter((h) => h.portfolio_id === pid);
  const newSharesValue = portHoldings.reduce((s, h) => s + (h.current_market_value ?? 0), 0);
  const newTotal = newSharesValue + base.closing_cash_total;
  const mtmReturn = newTotal - base.opening_market_value_total;
  const mtmPct = base.opening_market_value_total > 0 ? (mtmReturn / base.opening_market_value_total) * 100 : 0;

  // P1: recalculate economic return by preserving the delta (pension + expenses contribution)
  // P2: keep economic_return as-is (it's Python-managed "excl. capital added" metric)
  if (pid === "portfolio_1") {
    const econDelta = (base.economic_return ?? 0) - base.market_to_market_return;
    return {
      ...base,
      market_value_total: newTotal,
      market_to_market_return: mtmReturn,
      market_to_market_return_pct: mtmPct,
      economic_return: mtmReturn + econDelta,
      economic_return_pct: base.opening_market_value_total > 0 ? ((mtmReturn + econDelta) / base.opening_market_value_total) * 100 : 0,
    };
  }

  // P2 & combined: only update MTM, keep economic_return from summary
  return {
    ...base,
    market_value_total: newTotal,
    market_to_market_return: mtmReturn,
    market_to_market_return_pct: mtmPct,
  };
}

const fmtChange = (v: number) =>
  (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toLocaleString("en-AU", { maximumFractionDigits: 0 });
const fmtChangePct = (v: number) =>
  (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";

// ─── Get computed metrics (always derived, never cached) ────────────────────
function getComputedMetrics(summary: Summary[], holdings: HoldingRow[], pid: string): ComputedMetrics | null {
  const summaryRec = summary.find((s) => s.portfolio_id === pid);
  if (!summaryRec) return null;
  return computeMetrics(summaryRec, holdings);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ summary, performance, holdings, positions, uiSeries, asOf, mode }: Props) {
  const [tab, setTab] = useState<"summary" | "portfolio_1" | "portfolio_2">("summary");
  const [livePrices, setLivePrices] = useState<LivePrices | null>(null);
  const [priceAsOf, setPriceAsOf] = useState<string>(asOf);

  const allSymbols = useMemo(() => Array.from(new Set(holdings.map((h) => h.symbol))), [holdings]);

  const handlePrices = useCallback((prices: LivePrices) => {
    setLivePrices(prices);
    setPriceAsOf(new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }));
  }, []);

  const liveHoldings = useMemo(
    () => livePrices ? applyPricesToHoldings(holdings, livePrices) : holdings,
    [holdings, livePrices],
  );
  const liveSummary = useMemo(
    () => livePrices ? summary.map((s) => recalcSummary(s, liveHoldings)) : summary,
    [summary, liveHoldings, livePrices],
  );

  const displayAsOf = livePrices ? `Live · ${priceAsOf}` : asOf;

  return (
    <>
      <div className="header">
        <div>
          <h1>📊 Portfolio Dashboard</h1>
          <p>FY2026 · Portfolio 1 &amp; Portfolio 2</p>
        </div>
        <div className="toolbar">
          <PriceRefresh symbols={allSymbols} asOf={asOf} onPrices={handlePrices} />
        </div>
      </div>

      {mode === "local" ? (
        <div className="mode-banner mode-local">
          🖥️ Local mode — upload &amp; reconciliation enabled.
          <span className="toolbar" style={{ marginLeft: "auto" }}>
            <a className="tool-link" href="/upload">Upload</a>
            <a className="tool-link" href="/reconcile">Reconcile</a>
            <a className="tool-link" href="/chat">Chat</a>
          </span>
        </div>
      ) : (
        <div className="mode-banner mode-hosted">🌐 Hosted dashboard — read-only. Upload, reconciliation &amp; chat run in the local app.</div>
      )}

      <div className="tab-nav">
        <button className={`tab-btn ${tab === "summary" ? "active" : ""}`} onClick={() => setTab("summary")}>📈 Summary</button>
        <button className={`tab-btn ${tab === "portfolio_1" ? "active" : ""}`} onClick={() => setTab("portfolio_1")}>📊 Portfolio 1</button>
        <button className={`tab-btn ${tab === "portfolio_2" ? "active" : ""}`} onClick={() => setTab("portfolio_2")}>🏦 Portfolio 2</button>
      </div>

      {tab === "summary" && (
        <SummaryTab
          summary={liveSummary}
          holdings={liveHoldings}
          livePrices={livePrices}
        />
      )}
      {tab === "portfolio_1" && (
        <PortfolioTab
          pid="portfolio_1" summary={liveSummary} performance={performance}
          holdings={liveHoldings} positions={positions}
          series={uiSeries.portfolio_1} asOf={displayAsOf} accent="#064e3b"
          livePrices={livePrices}
        />
      )}
      {tab === "portfolio_2" && (
        <PortfolioTab
          pid="portfolio_2" summary={liveSummary} performance={performance}
          holdings={liveHoldings} positions={positions}
          series={uiSeries.portfolio_2} asOf={displayAsOf} accent="#0f4c81"
          livePrices={livePrices}
        />
      )}

      <footer>JPortfolio Dashboard · FY2026 · Market prices as at {displayAsOf} · Delisted holdings (BKW/PAI/RUL) priced from scheme/acquisition announcements</footer>
    </>
  );
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────

function SummaryTab({
  summary, holdings, livePrices,
}: {
  summary: Summary[];
  holdings: HoldingRow[];
  livePrices: LivePrices | null;
}) {
  const c = by(summary, "combined")!, p1 = by(summary, "portfolio_1")!, p2 = by(summary, "portfolio_2")!;

  const dc = {
    combined: calcDailyChange(holdings, livePrices, "combined"),
    p1:       calcDailyChange(holdings, livePrices, "portfolio_1"),
    p2:       calcDailyChange(holdings, livePrices, "portfolio_2"),
  };

  const dcLabel = (d: ReturnType<typeof calcDailyChange>) =>
    d ? `${fmtChange(d.change)}  (${fmtChangePct(d.pct)})` : "—";
  const dcColor = (d: ReturnType<typeof calcDailyChange>) =>
    !d ? "var(--text4)" : d.change >= 0 ? "var(--green)" : "var(--red)";

  const items = [
    { l: "Combined Market Value", v: money(c.market_value_total), s: "All shares + cash both portfolios", c: "#1d4ed8" },
    { l: "Combined Opening",       v: money(c.opening_market_value_total), s: "30 Jun 2025 at market", c: "#7c3aed" },
    { l: "Combined Dividends",     v: money(c.dividends_received_total), s: `P1 ${money(p1.dividends_received_total)} + P2 ${money(p2.dividends_received_total)}`, c: "#0d9488" },
    { l: "P1 Economic Return",     v: pctFmt(p1.economic_return_pct ?? 0), s: "MTM + dividends on opening", c: "#16a34a" },
    { l: "P2 Economic Return",     v: pctFmt(p2.economic_return_pct ?? 0), s: "On opening capital (net flows)", c: "#059669" },
    { l: "P1 Realised Gains",      v: money(p1.realized_pl_total ?? 0), s: "Sells above avg cost", c: "#ea580c" },
    { l: "Combined Realised",      v: money(c.realized_pl_total ?? 0), s: "P1 + P2 sell proceeds vs cost", c: "#2563eb" },
    { l: "MTM Return (combined)",  v: moneyS(c.market_to_market_return), s: pctFmt(c.market_to_market_return_pct), c: "#16a34a" },
  ];
  const shares = (s: Summary) => money(s.market_value_total - s.closing_cash_total);

  return (
    <div>
      {/* Combined banner */}
      <div className="combined-banner">
        <h2>COMBINED PORTFOLIO VALUE</h2>
        <div className="cb-val">{money(c.market_value_total)}</div>
        <div className="cb-sub">Portfolio 1 + Portfolio 2 · As at {c.as_of_date}</div>
        <div className="cb-stats">
          <div className="cb-stat"><div className="label">Portfolio 1</div><div className="value">{money(p1.market_value_total)}</div></div>
          <div className="cb-stat"><div className="label">Portfolio 2</div><div className="value">{money(p2.market_value_total)}</div></div>
          <div className="cb-stat"><div className="label">Combined Dividends</div><div className="value">{money(c.dividends_received_total)}</div></div>
          <div className="cb-stat"><div className="label">Combined Opening</div><div className="value">{money(c.opening_market_value_total)}</div></div>
        </div>
      </div>

      {/* Today's change — 3 compact tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text4)", marginBottom: 4 }}>Combined</div>
          <TodayChange holdings={holdings} livePrices={livePrices} portfolioId="combined" compact />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text4)", marginBottom: 4 }}>Portfolio 1</div>
          <TodayChange holdings={holdings} livePrices={livePrices} portfolioId="portfolio_1" compact />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text4)", marginBottom: 4 }}>Portfolio 2</div>
          <TodayChange holdings={holdings} livePrices={livePrices} portfolioId="portfolio_2" compact />
        </div>
      </div>

      {/* Port cards */}
      <div className="summary-grid" style={{ marginTop: 14 }}>
        <div className="port-card">
          <h3 style={{ color: "#2563eb" }}>📊 Portfolio 1</h3>
          <div className="pc-val">{money(p1.market_value_total)}</div>
          <div className="pc-sub" style={{ marginBottom: 14 }}>Shares {shares(p1)} + Cash {money(p1.closing_cash_total)}</div>
          <PcRow label={`Opening (${p1.period_start})`} value={money(p1.opening_market_value_total)} />
          <PcRow label="Today's Change" value={dcLabel(dc.p1)} color={dcColor(dc.p1)} />
          <PcRow label="MTM Return FY2026" value={pctFmt(p1.market_to_market_return_pct)} color="var(--green)" />
          <PcRow label="Dividends FY2026" value={money(p1.dividends_received_total)} color="var(--teal)" />
          <PcRow label="Economic Return" value={pctFmt(p1.economic_return_pct ?? 0)} color="var(--green)" />
          <PcRow label="Realised Gains" value={money(p1.realized_pl_total ?? 0)} color="var(--orange)" />
        </div>
        <div className="port-card">
          <h3 style={{ color: "#0f4c81" }}>🏦 Portfolio 2</h3>
          <div className="pc-val">{money(p2.market_value_total)}</div>
          <div className="pc-sub" style={{ marginBottom: 14 }}>Shares {shares(p2)} + Cash {money(p2.closing_cash_total)}</div>
          <PcRow label={`Opening (${p2.period_start})`} value={money(p2.opening_market_value_total)} />
          <PcRow label="Today's Change" value={dcLabel(dc.p2)} color={dcColor(dc.p2)} />
          <PcRow label="Growth FY2026" value={pctFmt(p2.market_to_market_return_pct)} color="var(--green)" />
          <PcRow label="Dividends FY2026" value={money(p2.dividends_received_total)} color="var(--teal)" />
          <PcRow label="Economic Return" value={pctFmt(p2.economic_return_pct ?? 0)} color="var(--green)" />
          <PcRow label="Net Capital Added" value={money(p2.net_transfers_total ?? 0)} color="var(--accent)" />
        </div>
      </div>

      <div className="section-label">Combined Overview</div>
      <KpiGrid items={items} />
    </div>
  );
}

function PcRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="pc-row"><span>{label}</span><span style={{ fontWeight: 700, color }}>{value}</span></div>;
}

// ─── Portfolio Tab ────────────────────────────────────────────────────────────

function PortfolioTab({ pid, summary, performance, holdings, positions, series, asOf, accent, livePrices }: {
  pid: "portfolio_1" | "portfolio_2"; summary: Summary[]; performance: PerformanceSummary[];
  holdings: HoldingRow[]; positions: PositionChangeRow[]; series: PortfolioSeries;
  asOf: string; accent: string; livePrices: LivePrices | null;
}) {
  const s = by(summary, pid)!, perf = by(performance, pid)!;
  const hold = useMemo(() => holdings.filter((h) => h.portfolio_id === pid), [holdings, pid]);
  const newPos = positions.filter((p) => p.portfolio_id === pid && p.change_type === "new").map((p) => p.symbol);
  const closedPos = positions.filter((p) => p.portfolio_id === pid && p.change_type === "closed").map((p) => p.symbol);

  // ─── Computed metrics (always derived from source data, never static) ───
  const metrics = useMemo(() => computeMetrics(s, hold), [s, hold]);

  // For P1, compute perfBridge dynamically to match KPI tiles
  const computedPerfBridge = useMemo(
    () => pid === "portfolio_1" ? (computeP1PerfBridge(s, hold) as any) : null,
    [pid, s, hold]
  );

  // Use computed perfBridge for P1, fallback to static series for P2
  const perfBridgeSteps = computedPerfBridge ?? series.perfBridge;

  const dc = useMemo(() => calcDailyChange(holdings, livePrices, pid), [holdings, livePrices, pid]);

  const totalUnr = useMemo(
    () => hold.reduce((acc, h) => acc + ((h.current_market_value ?? 0) - (h.cost_base ?? 0)), 0),
    [hold]
  );
  const withMtm = useMemo(() => hold.filter((h) => h.market_to_market_gain != null), [hold]);
  const gainers = useMemo(() => [...withMtm].sort((a, b) => (b.market_to_market_gain ?? 0) - (a.market_to_market_gain ?? 0)).slice(0, 10)
    .map((h) => ({ code: h.symbol, v: h.market_to_market_gain ?? 0, pct: h.market_to_market_pct ?? undefined })), [withMtm]);
  const losers = useMemo(() => [...withMtm].sort((a, b) => (a.market_to_market_gain ?? 0) - (b.market_to_market_gain ?? 0)).slice(0, 10)
    .map((h) => ({ code: h.symbol, v: h.market_to_market_gain ?? 0, pct: h.market_to_market_pct ?? undefined })), [withMtm]);
  const top20 = useMemo(() => [...hold].sort((a, b) => (b.current_market_value ?? 0) - (a.current_market_value ?? 0)).slice(0, 20)
    .map((h) => ({ code: h.symbol, v: h.current_market_value ?? 0 })), [hold]);
  const topDiv = useMemo(() => series.topDivPayers.map(([code, v]) => ({ code, v })), [series.topDivPayers]);
  const shares = useMemo(() => money(metrics.sharesValue), [metrics.sharesValue]);

  const dcColor = !dc ? undefined : dc.change >= 0 ? "#16a34a" : "#dc2626";
  const dcLabel = dc
    ? `${fmtChange(dc.change)}  (${fmtChangePct(dc.pct)})`
    : livePrices ? "—" : "Refresh prices";

  return (
    <div>
      {/* Banner */}
      <div className="banner" style={{ background: `linear-gradient(135deg, ${accent}, #1e3a8a)` }}>
        <div className="banner-main">
          <div className="label">Total Portfolio Value — At Market</div>
          <div className="value">{money(metrics.totalPortfolioValue)}</div>
          <div className="sub">{asOf} · Shares {shares} + Cash {money(metrics.cashBalance)} · <span style={{ color: "#6ee7b7" }}>▲ {moneyS(metrics.mtmReturn)} ({pctFmt(metrics.mtmReturnPct)})</span></div>
        </div>
        <div className="banner-stats">
          <Bstat val={money(s.opening_market_value_total)} lbl={`Opening (${s.period_start})`} />
          <Bstat val={pctFmt(metrics.mtmReturnPct)} lbl="MTM / Growth" color="#6ee7b7" />
          <Bstat val={pctFmt(metrics.economicReturnPct)} lbl="Economic Return" color="#6ee7b7" />
          <Bstat val={money(metrics.totalDividends)} lbl="Dividends" />
        </div>
      </div>

      {/* Today's change bar */}
      <TodayChange holdings={holdings} livePrices={livePrices} portfolioId={pid} />

      <div className="section-label">Market Performance — As at {asOf}</div>
      <KpiGrid items={[
        { l: "Opening (Market)",       v: fmtK(s.opening_market_value_total), s: s.period_start, c: "#2563eb" },
        { l: "Current (Market)",       v: fmtK(metrics.sharesValue), s: asOf, c: "#047857" },
        { l: "Today's Change",         v: dcLabel, s: dc ? `${dc.count} holdings vs prev close` : "—", c: dcColor ?? "#9ca3af" },
        { l: "MTM Return",             v: moneyS(metrics.mtmReturn), s: pctFmt(metrics.mtmReturnPct), c: "#16a34a" },
        { l: "Economic Return",        v: pctFmt(metrics.economicReturnPct), s: moneyS(metrics.economicReturn), c: "#047857" },
        { l: "Dividends Received",     v: money(metrics.totalDividends), s: "FY2026", c: "#0d9488" },
        { l: "Realised Gains",         v: money(s.realized_pl_total ?? 0), s: "Sells above avg cost", c: "#ea580c" },
        { l: "Unrealised P&L vs Cost", v: moneyS(metrics.unrealisedGain), s: "vs avg cost", c: metrics.unrealisedGain >= 0 ? "#16a34a" : "#dc2626" },
        { l: "Cost Basis",             v: fmtK(metrics.costBasisTotal), s: `Closing · ${asOf}`, c: "#7c3aed" },
        { l: "Closing Cash",           v: money(metrics.cashBalance), s: asOf, c: "#2563eb" },
      ]} />

      <div className="row row-2">
        <Card dot="#2563eb" title="How Cost Basis Changed"><Bridge steps={series.costBridge} /></Card>
        <Card dot="#16a34a" title="Monthly Dividend Income"><MonthlyBars data={series.divByMonth} /></Card>
      </div>

      <div className="row row-2">
        <Card dot="#047857" title="True Portfolio Performance — FY2026"><Bridge steps={perfBridgeSteps} /></Card>
        <Card dot="#dc2626" title={pid === "portfolio_1" ? "Expenses & Distributions FY2026" : "Capital Added & Brokerage"}>
          <ExpensePanel series={series} />
        </Card>
      </div>

      <div className="row row-2">
        <Card dot="#0d9488" title="Top Dividend Payers FY2026"><HBarChart data={topDiv} color="#0d9488" /></Card>
        <Card dot="#ca8a04" title="Monthly Trade Activity"><MonthlyActivity months={series.months} buys={series.buys} sells={series.sells} /></Card>
      </div>

      <div className="row row-2">
        <Card dot="#16a34a" title="FY2026 Top Market Gainers"><HBarChart data={gainers} color="#22c55e" signed /></Card>
        <Card dot="#dc2626" title="FY2026 Top Market Losers"><HBarChart data={losers} color="#f87171" signed /></Card>
      </div>

      <div className="row row-2">
        <Card dot="#7c3aed" title="Top 20 Holdings by Market Value">
          <HBarChart data={top20} valueFmt={fmtK} colorFor={() => "#a78bfa"} />
        </Card>
        <Card dot="#16a34a" title="Position Changes FY2026">
          <div style={{ marginBottom: 10 }}>
            <div className="card-title"><span className="dot" style={{ background: "#16a34a" }} />New Positions ({newPos.length})</div>
            <div className="pill-grid">{newPos.map((c) => <span key={c} className="pill pill-new">{c}</span>)}</div>
          </div>
          <div>
            <div className="card-title"><span className="dot" style={{ background: "#dc2626" }} />Closed Positions ({closedPos.length})</div>
            <div className="pill-grid">{closedPos.map((c) => <span key={c} className="pill pill-closed">{c}</span>)}</div>
          </div>
        </Card>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title"><span className="dot" style={{ background: "#16a34a" }} />All Holdings — {asOf}</div>
        <HoldingsTable holdings={hold} />
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ExpensePanel({ series }: { series: PortfolioSeries }) {
  const total = series.expenses.reduce((sum, e) => sum + e.amt, 0);
  return (
    <div>
      {series.capitalAdded ? (
        <div style={{ marginBottom: 12 }}>
          {series.capitalAdded.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--text2)" }}><b style={{ color: "var(--accent)" }}>{c.period}</b> — {c.detail}</span>
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>{money(c.amt)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {series.expenses.map((e, i) => (
        <div key={i} className="expense-row">
          <div>
            <div className="expense-cat">{e.cat}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</div>
            <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 2 }}>{e.detail}</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--red)", whiteSpace: "nowrap" }}>−{money(e.amt)}</div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "2px solid var(--text)", fontWeight: 800, fontSize: 14, marginTop: 6 }}>
        <span>Total</span><span style={{ color: "var(--red)" }}>−{money(total)}</span>
      </div>
    </div>
  );
}

function Card({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-title"><span className="dot" style={{ background: dot }} />{title}</div>
      {children}
    </div>
  );
}
function Bstat({ val, lbl, color }: { val: string; lbl: string; color?: string }) {
  return <div className="bstat"><div className="bs-val" style={color ? { color } : undefined}>{val}</div><div className="bs-lbl">{lbl}</div></div>;
}
