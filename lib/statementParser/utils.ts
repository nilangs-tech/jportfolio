/** Shared utility helpers for all parsers. */

/** Parse a date string in various formats to ISO YYYY-MM-DD. */
export function parseDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Excel serial number
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Parse a money value — strips $, commas, brackets. */
export function parseMoney(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const s = String(value).trim().replace(/[$,]/g, "");
  if (s === "" || s === "-") return 0;
  // Negative in brackets: (1234.56)
  const bracket = s.match(/^\((.+)\)$/);
  if (bracket) return -parseFloat(bracket[1]);
  return parseFloat(s) || 0;
}

/** Classify a cash description into a category. */
export function classifyCash(desc: string): string {
  const d = desc.toLowerCase();
  if (/^[bs]\s+\d|trade|brokerage/.test(d)) return "trade";
  if (/divid|distribution|drp/.test(d)) return "dividend";
  if (/transfer|payee|direct credit|direct debit|deposit|withdrawal/.test(d)) return "transfer";
  if (/interest/.test(d)) return "interest";
  if (/fee|asic|gst/.test(d)) return "fee";
  if (/refund|ato|tax/.test(d)) return "ato_refund";
  if (/pension|superannuation/.test(d)) return "pension";
  return "other";
}

/** Extract ASX ticker from a trade description like "B 100 BHP @ 45.23 T+2" */
export const TRADE_RE = /^([BS])\s+([\d,]+)\s+([A-Z0-9]+)\s+@\s+([\d.]+)/i;

export function normSymbol(s: string): string {
  return s.trim().toUpperCase().replace(/\.AX$/i, "");
}
