import { NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { fetchQuotes } from "@/lib/yahooFinance";

/**
 * Current market prices for the requested tickers (runs in local AND hosted modes).
 * POST { symbols: string[] } -> { ok, fetched_at, prices: { SYM: {price, status, ...} } }
 * If YAHOO_FINANCE_ENABLED=false, returns { disabled: true } so the UI keeps stored quotes.
 */
export async function POST(req: NextRequest) {
  if (!serverConfig.yahooEnabled) {
    return NextResponse.json({ ok: true, disabled: true, prices: {} });
  }
  let symbols: string[] = [];
  try {
    const body = await req.json();
    symbols = Array.isArray(body?.symbols) ? body.symbols.slice(0, 250) : [];
  } catch {
    /* ignore */
  }
  if (symbols.length === 0) return NextResponse.json({ ok: true, fetched_at: new Date().toISOString(), prices: {} });

  const quotes = await fetchQuotes(symbols);
  const live = Object.fromEntries(Object.entries(quotes).filter(([, q]) => q.status === "live"));
  return NextResponse.json({ ok: true, fetched_at: new Date().toISOString(), prices: live });
}
