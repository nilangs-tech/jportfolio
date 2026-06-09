"use client";
import { useEffect, useRef, useState } from "react";

export interface LivePrice {
  price: number;
  previousClose: number | null;
  dailyChange: number | null;    // $ per share vs previous close
  dailyChangePct: number | null; // % vs previous close
  status: string;
}
export type LivePrices = Record<string, LivePrice>;

interface Props {
  symbols: string[];
  asOf: string;
  onPrices?: (prices: LivePrices) => void;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches current market prices on mount, then enforces a 5-minute cooldown
 * between refreshes. Manual button is disabled during cooldown; a countdown
 * shows how long until the next refresh is available.
 */
export default function PriceRefresh({ symbols, asOf, onPrices }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error" | "disabled">("idle");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown() {
    setSecondsLeft(COOLDOWN_MS / 1000);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function refresh(auto = false) {
    if (secondsLeft > 0 && !auto) return; // block manual during cooldown
    setStatus("loading");
    try {
      const res = await fetch("/api/market-prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbols }),
      });
      const data = await res.json();
      if (data.disabled) { setStatus("disabled"); return; }

      const prices: LivePrices = data.prices ?? {};
      setCount(Object.keys(prices).length);
      setFetchedAt(data.fetched_at ?? new Date().toISOString());
      setStatus("ok");

      if (onPrices && Object.keys(prices).length > 0) onPrices(prices);
      startCooldown();
    } catch {
      setStatus(auto ? "idle" : "error");
    }
  }

  // Auto-refresh on mount only
  useEffect(() => {
    refresh(true);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCooldown = secondsLeft > 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const cooldownLabel = mins > 0
    ? `Next refresh in ${mins}m ${secs.toString().padStart(2, "0")}s`
    : `Next refresh in ${secs}s`;

  const label =
    status === "loading"    ? "Refreshing…"
    : status === "ok"       ? `Prices · ${count} live · ${fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : ""}`
    : status === "disabled" ? `Prices: showing stored quotes (as at ${asOf})`
    : status === "error"    ? "Price refresh failed — showing stored quotes"
    : `As at ${asOf}`;

  return (
    <div className="toolbar">
      <span className="badge">{label}</span>
      {onCooldown && (
        <span className="badge" style={{ color: "var(--text4)", fontSize: 11 }}>{cooldownLabel}</span>
      )}
      <button
        className="btn btn-ghost"
        disabled={status === "loading" || onCooldown}
        onClick={() => refresh(false)}
        title={onCooldown ? cooldownLabel : "Refresh market prices"}
      >
        ↻ Refresh prices
      </button>
    </div>
  );
}
