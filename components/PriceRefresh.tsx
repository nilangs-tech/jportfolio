"use client";
import { useEffect, useState } from "react";

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

/**
 * Fetches current market prices (+ previous-close for daily change) on mount and on demand.
 * Calls onPrices() with the full result so the dashboard can update all figures.
 */
export default function PriceRefresh({ symbols, asOf, onPrices }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error" | "disabled">("idle");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  async function refresh(auto = false) {
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
    } catch {
      setStatus(auto ? "idle" : "error");
    }
  }

  useEffect(() => { refresh(true); /* eslint-disable-next-line */ }, []);

  const label =
    status === "loading"  ? "Refreshing…"
    : status === "ok"     ? `Prices · ${count} live · ${fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : ""}`
    : status === "disabled" ? `Prices: showing stored quotes (as at ${asOf})`
    : status === "error"  ? "Price refresh failed — showing stored quotes"
    : `As at ${asOf}`;

  return (
    <div className="toolbar">
      <span className="badge">{label}</span>
      <button className="btn btn-ghost" disabled={status === "loading"} onClick={() => refresh(false)}>
        ↻ Refresh prices
      </button>
    </div>
  );
}
