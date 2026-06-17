import "server-only";
import type { ParseResult, ParsedTrade } from "./types";

// Strips currency formatting and returns a number
function parseCurrency(s: string): number {
  return parseFloat(s.replace(/[$,]/g, "").trim()) || 0;
}

// Converts DD/MM/YYYY → YYYY-MM-DD
function parseDate(s: string): string {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function extract(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

/**
 * CommSec trade confirmation PDFs render in two visual columns. pdf-parse
 * reads left column then right column, so values appear BEFORE their labels.
 *
 * Observed text layout (values block then labels block):
 *   $14,405.05          ← net proceeds
 *   CONSIDERATION (AUD):
 *   15/06/2026          ← as-at date
 *   CONFIRMATION NO:
 *   176015787           ← conf no (after label)
 *   5427552             ← account no
 *   100                 ← units
 *   $14,435.00          ← consideration
 *   $29.95              ← brokerage
 *   $0.00               ← application money
 *   $2.72               ← gst
 *   17/06/2026          ← settlement date
 *   BROKERAGE & COSTS INCL GST:
 *   APPLICATION MONEY:
 *   NET PROCEEDS:
 *   TOTAL GST:
 *   SETTLEMENT DATE:
 *   15/06/2026          ← trade date
 *   TOTAL UNITS:
 *   DATE:
 */
export async function parseCommSecPdf(buffer: Buffer, portfolioId: string, filename: string): Promise<ParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  let text: string;
  try {
    const data = await pdfParse(buffer);
    text = (data.text as string).replace(/\r\n/g, "\n");
  } catch (e) {
    return { source: "commsec_pdf", filename, portfolio_id: portfolioId, trades: [], dividends: [], cashEntries: [], warnings: [`PDF read error: ${String(e)}`], skippedRows: 0 };
  }

  const warnings: string[] = [];

  // Transaction type
  const isSell = /WE HAVE SOLD/i.test(text);
  const isBuy  = /WE HAVE BOUGHT/i.test(text);
  if (!isSell && !isBuy) {
    return { source: "commsec_pdf", filename, portfolio_id: portfolioId, trades: [], dividends: [], cashEntries: [], warnings: ["Could not detect BUY or SELL in this CommSec PDF."], skippedRows: 0 };
  }
  const type = isSell ? "sell" : "buy";

  // Symbol: ticker appears on its own line immediately before "COMPANY" label
  const symbol = extract(text, /\n([A-Z0-9]{2,6})\nCOMPANY\n/);

  // Company name: appears after "WE HAVE SOLD/BOUGHT" line
  const company = extract(text, /(?:WE HAVE SOLD|WE HAVE BOUGHT)[^\n]*\n([^\n]+)/i);

  // Average price: value is concatenated directly after label (no space)
  const avgPrice = parseFloat(extract(text, /AVERAGE PRICE:([\d.]+)/)) || 0;

  // Trade date: appears right before "TOTAL UNITS:\nDATE:" label pair
  const dateRaw = extract(text, /([\d/]+)\nTOTAL UNITS:\nDATE:/);
  const date = parseDate(dateRaw);

  // Confirmation reference: appears on the line after "CONFIRMATION NO:"
  const reference = extract(text, /CONFIRMATION NO:\n([\d]+)/);

  // Values block: units, consideration, brokerage, app_money, gst all appear in sequence
  // before the label block (BROKERAGE & COSTS INCL GST: etc.)
  const valueBlock = text.match(/\n(\d+)\n\$([\d,]+\.\d{2})\n\$([\d,]+\.\d{2})\n\$([\d,]+\.\d{2})\n\$([\d,]+\.\d{2})\n[\d/]+\n/);
  const units       = valueBlock ? parseInt(valueBlock[1]) : 0;
  const consideration = valueBlock ? parseCurrency(valueBlock[2]) : 0;
  const brokerage   = valueBlock ? parseCurrency(valueBlock[3]) : 0;
  const gst         = valueBlock ? parseCurrency(valueBlock[5]) : 0;

  // Net proceeds (sell) / net cost (buy): appears before CONSIDERATION (AUD): label
  const netRaw = extract(text, /\$([\d,]+\.\d{2})\nCONSIDERATION \(AUD\):/);
  const net    = parseCurrency(netRaw);

  if (!symbol)    warnings.push("Could not extract ticker symbol — please check.");
  if (!date)      warnings.push("Could not extract trade date.");
  if (!units)     warnings.push("Could not extract units.");
  if (!avgPrice)  warnings.push("Could not extract price.");

  const price = avgPrice || (units ? consideration / units : 0);
  // total: positive = cash in (sell proceeds), negative = cash out (buy cost)
  const total = isSell ? net : -net;

  const trade: ParsedTrade = {
    date,
    type,
    symbol,
    units,
    price,
    brokerage,
    gst,
    total,
    reference,
    portfolio_id: portfolioId,
  };

  const notePrefix = company ? `${company} (${symbol})` : symbol;
  return {
    source: "commsec_pdf",
    filename,
    portfolio_id: portfolioId,
    trades: [trade],
    dividends: [],
    cashEntries: [],
    warnings: warnings.length
      ? warnings
      : [`Parsed CommSec trade confirmation: ${type.toUpperCase()} ${units} ${notePrefix} @ $${price.toFixed(4)} on ${date}`],
    skippedRows: 0,
  };
}
