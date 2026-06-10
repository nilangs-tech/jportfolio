import { NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { fetchQuotes } from "@/lib/yahooFinance";

/**
 * Current market prices for the requested tickers (runs in local AND hosted modes).
 * POST { symbols: string[] }
 * -> { ok, fetched_at, prices: { SYM: { price, previousClose, dailyChange, dailyChangePct, status } } }
 * If YAHOO_FINANCE_ENABLED=false, returns { disabled: true }.
 */
export async function POST(req: NextRequest) {
  if (!serverConfig.yahooEnabled) {
    return NextResponse.json({ ok: true, disabled: true, prices: {} });
  }
  let symbols: string[] = [];
  try {
    const body = await req.json();
    symbols = Array.isArray(body?.symbols) ? body.symbols.slice(0, 250) : [];
  } catch { /* ignore */ }

  if (symbols.length === 0)
    return NextResponse.json({ ok: true, fetched_at: new Date().toISOString(), prices: {} });

  // Exclude symbols that should remain static (not updated from Yahoo Finance)
  const staticSymbols = ["ETPMPM"];
  const dynamicSymbols = symbols.filter(s => !staticSymbols.includes(s));

  const quotes = await fetchQuotes(dynamicSymbols);

  // Return live quotes with all daily-change fields for the today's-change tile
  const prices = Object.fromEntries(
    Object.entries(quotes)
      .filter(([, q]) => q.status === "live" && q.price != null)
      .map(([sym, q]) => [sym, {
        price: q.price,
        previousClose: q.previousClose,
        dailyChange: q.dailyChange,
        dailyChangePct: q.dailyChangePct,
        status: q.status,
      }])
  );

  return NextResponse.json({ ok: true, fetched_at: new Date().toISOString(), prices });
}
