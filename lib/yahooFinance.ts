import "server-only";

/**
 * Minimal Yahoo Finance current-price fetcher (no SDK).
 * Uses the public chart endpoint and reads meta.regularMarketPrice.
 * Portfolio tickers are mapped to ASX provider symbols (e.g. BHP -> BHP.AX)
 * unless they already contain a suffix.
 */

export interface Quote {
  symbol: string;          // portfolio ticker
  provider_symbol: string; // yahoo symbol
  price: number | null;
  currency: string;
  quote_date: string | null;
  status: "live" | "unavailable";
}

export function toProviderSymbol(symbol: string): string {
  if (symbol.includes(".")) return symbol;
  return `${symbol}.AX`;
}

async function fetchOne(symbol: string): Promise<Quote> {
  const ps = toProviderSymbol(symbol);
  const base: Quote = { symbol, provider_symbol: ps, price: null, currency: "AUD", quote_date: null, status: "unavailable" };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ps)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (jportfolio-dashboard)" },
      // current prices should not be cached at the fetch layer
      cache: "no-store",
    });
    if (!res.ok) return base;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number") return base;
    const ts = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();
    return { symbol, provider_symbol: ps, price, currency: meta?.currency ?? "AUD", quote_date: ts, status: "live" };
  } catch {
    return base;
  }
}

/** Fetch many quotes with light concurrency control. */
export async function fetchQuotes(symbols: string[], concurrency = 6): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  const queue = [...new Set(symbols)];
  async function worker() {
    while (queue.length) {
      const s = queue.shift()!;
      out[s] = await fetchOne(s);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return out;
}
