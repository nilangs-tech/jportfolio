"use client";
import { useEffect, useState } from "react";

/**
 * Fetches current market prices from /api/market-prices on mount and on demand.
 * Works in both local and hosted modes. Degrades gracefully if pricing is off.
 */
export default function PriceRefresh({ symbols, asOf }: { symbols: string[]; asOf: string }) {
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
      setCount(data.prices ? Object.keys(data.prices).length : 0);
      setFetchedAt(data.fetched_at ?? new Date().toISOString());
      setStatus("ok");
    } catch {
      setStatus(auto ? "idle" : "error");
    }
  }

  // auto-refresh on launch
  useEffect(() => { refresh(true); /* eslint-disable-next-line */ }, []);

  const label = status === "loading" ? "Refreshing…"
    : status === "ok" ? `Prices · ${count} live · ${fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : ""}`
      : status === "disabled" ? `Prices: showing stored quotes (as at ${asOf})`
        : status === "error" ? "Price refresh failed — showing stored quotes"
          : `As at ${asOf}`;

  return (
    <div className="toolbar">
      <span className="badge">{label}</span>
      <button className="btn btn-ghost" disabled={status === "loading"} onClick={() => refresh(false)}>↻ Refresh prices</button>
    </div>
  );
}
