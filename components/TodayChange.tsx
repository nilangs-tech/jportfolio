"use client";
import { useMemo } from "react";
import type { HoldingRow } from "@/lib/types";
import type { LivePrices } from "./PriceRefresh";
import { getMarketStatus, isAsxTradingDay, sydneyDateStr, sydneyTimeStr } from "@/lib/marketSession";

interface Props {
  holdings: HoldingRow[];
  livePrices: LivePrices | null;
}

const fmt = (v: number) =>
  (v >= 0 ? "+" : "−") + "$" +
  Math.abs(v).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (v: number) =>
  (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";

export default function TodayChange({ holdings, livePrices }: Props) {
  const now = new Date();
  const status = getMarketStatus(now);
  const tradingDay = isAsxTradingDay(now);
  const dateStr = sydneyDateStr(now);
  const timeStr = sydneyTimeStr(now);

  // Compute today's portfolio $ change from live prices
  const { totalChange, totalChangePct, coveredCount } = useMemo(() => {
    if (!livePrices) return { totalChange: null, totalChangePct: null, coveredCount: 0 };

    let changeSum = 0;
    let prevSum = 0;
    let covered = 0;

    for (const h of holdings) {
      const lp = livePrices[h.symbol];
      if (!lp || lp.dailyChange == null || lp.previousClose == null) continue;
      changeSum += lp.dailyChange * h.units;
      prevSum   += lp.previousClose * h.units;
      covered++;
    }

    if (covered === 0) return { totalChange: null, totalChangePct: null, coveredCount: 0 };
    const pct = prevSum > 0 ? (changeSum / prevSum) * 100 : 0;
    return { totalChange: changeSum, totalChangePct: pct, coveredCount: covered };
  }, [holdings, livePrices]);

  // Status label + colour
  const statusMeta: Record<typeof status, { label: string; dot: string }> = {
    open:        { label: "ASX Open",       dot: "#16a34a" },
    "pre-market":{ label: "Pre-market",     dot: "#ca8a04" },
    "after-hours":{ label: "After hours",   dot: "#7c3aed" },
    weekend:     { label: "Weekend",        dot: "#9ca3af" },
    holiday:     { label: "Market holiday", dot: "#9ca3af" },
  };
  const { label: statusLabel, dot: dotColor } = statusMeta[status];

  // Before 9 AM on a trading day — too early to show meaningful change
  const tooEarly = tradingDay && status === "pre-market" && !livePrices;

  const hasChange = totalChange != null;
  const changeColor = !hasChange ? "var(--text4)"
    : totalChange >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 16px", marginTop: 8,
    }}>
      {/* Status dot + date */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
          {statusLabel} · {dateStr} · {timeStr} AEST/AEDT
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: "var(--border)", flexShrink: 0 }} />

      {/* Today's change */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Today&apos;s Change
        </span>
        {!livePrices ? (
          <span style={{ fontSize: 13, color: "var(--text4)" }}>
            {tooEarly ? "Pre-market — refresh after 9 AM Sydney" : "↻ Refresh prices to see today's change"}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 20, fontWeight: 800, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
              {hasChange ? fmt(totalChange!) : "—"}
            </span>
            {hasChange && (
              <span style={{ fontSize: 14, fontWeight: 700, color: changeColor, fontVariantNumeric: "tabular-nums" }}>
                ({fmtPct(totalChangePct!)})
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--text4)" }}>
              {coveredCount} holdings · vs prev close
            </span>
          </>
        )}
      </div>

      {/* Reset note */}
      {tradingDay && (
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text4)", whiteSpace: "nowrap" }}>
          Resets 9 AM Sydney each trading day
        </span>
      )}
    </div>
  );
}
