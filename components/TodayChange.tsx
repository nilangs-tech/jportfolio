"use client";
import { useMemo } from "react";
import type { HoldingRow } from "@/lib/types";
import type { LivePrices } from "./PriceRefresh";
import { getMarketStatus, isAsxTradingDay, sydneyDateStr, sydneyTimeStr } from "@/lib/marketSession";

interface Props {
  holdings: HoldingRow[];
  livePrices: LivePrices | null;
  /** Filter to a specific portfolio, or undefined/"combined" for all holdings */
  portfolioId?: string;
  /** Compact card layout for side-by-side display */
  compact?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtAbs = (v: number) =>
  "$" + Math.abs(v).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const sign = (v: number) => (v >= 0 ? "+" : "−");

export function calcDailyChange(
  holdings: HoldingRow[],
  prices: LivePrices | null,
  portfolioId?: string,
): { change: number; pct: number; count: number } | null {
  if (!prices) return null;
  const rows =
    !portfolioId || portfolioId === "combined"
      ? holdings
      : holdings.filter((h) => h.portfolio_id === portfolioId);

  let changeSum = 0, prevSum = 0, count = 0;
  for (const h of rows) {
    const lp = prices[h.symbol];
    if (!lp || lp.dailyChange == null || lp.previousClose == null) continue;
    changeSum += lp.dailyChange * h.units;
    prevSum   += lp.previousClose * h.units;
    count++;
  }
  if (count === 0) return null;
  return { change: changeSum, pct: prevSum > 0 ? (changeSum / prevSum) * 100 : 0, count };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayChange({ holdings, livePrices, portfolioId, compact = false }: Props) {
  const now = new Date();
  const status = getMarketStatus(now);
  const tradingDay = isAsxTradingDay(now);
  const dateStr = sydneyDateStr(now);
  const timeStr = sydneyTimeStr(now);

  const result = useMemo(
    () => calcDailyChange(holdings, livePrices, portfolioId),
    [holdings, livePrices, portfolioId],
  );

  const statusMeta: Record<typeof status, { label: string; dot: string }> = {
    open:          { label: "ASX Open",       dot: "#16a34a" },
    "pre-market":  { label: "Pre-market",     dot: "#ca8a04" },
    "after-hours": { label: "After hours",    dot: "#7c3aed" },
    weekend:       { label: "Weekend",        dot: "#9ca3af" },
    holiday:       { label: "Market holiday", dot: "#9ca3af" },
  };
  const { label: statusLabel, dot: dotColor } = statusMeta[status];

  const changeColor = !result
    ? "var(--text4)"
    : result.change >= 0 ? "var(--green)" : "var(--red)";

  // ── Compact card (for Summary side-by-side) ──────────────────────────────
  if (compact) {
    return (
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Today&apos;s Change
          </span>
        </div>
        {result ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
                {sign(result.change)}{fmtAbs(result.change)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
                ({sign(result.pct)}{Math.abs(result.pct).toFixed(2)}%)
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text4)" }}>
              {result.count} holdings · vs prev close
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text4)" }}>
            {!livePrices ? "↻ Refresh prices" : "—"}
          </div>
        )}
      </div>
    );
  }

  // ── Full-width bar (for Portfolio tabs) ──────────────────────────────────
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 16px", marginTop: 8,
    }}>
      {/* Status dot + date/time */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
          {statusLabel} · {dateStr} · {timeStr} AEDT/AEST
        </span>
      </div>

      <div style={{ width: 1, height: 28, background: "var(--border)", flexShrink: 0 }} />

      {/* Change figures */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Today&apos;s Change
        </span>
        {!livePrices ? (
          <span style={{ fontSize: 13, color: "var(--text4)" }}>
            ↻ Refresh prices to see today&apos;s change
          </span>
        ) : result ? (
          <>
            <span style={{ fontSize: 22, fontWeight: 800, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
              {sign(result.change)}{fmtAbs(result.change)}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
              ({sign(result.pct)}{Math.abs(result.pct).toFixed(2)}%)
            </span>
            <span style={{ fontSize: 11, color: "var(--text4)" }}>
              {result.count} holdings · vs prev close
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text4)" }}>—</span>
        )}
      </div>

      {tradingDay && (
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text4)", whiteSpace: "nowrap" }}>
          Resets 9 AM Sydney each trading day
        </span>
      )}
    </div>
  );
}
