/** Formatting helpers (ported from the original HTML dashboard). */

export const fmtK = (v: number): string =>
  v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M"
    : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "k"
      : "$" + Math.round(v);

export const money = (v: number): string =>
  "$" + Math.round(Math.abs(v)).toLocaleString("en-AU");

export const moneyS = (v: number): string =>
  (v < 0 ? "−" : "+") + "$" + Math.round(Math.abs(v)).toLocaleString("en-AU");

export const pctFmt = (v: number): string =>
  (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

export const num = (v: number, d = 0): string =>
  v.toLocaleString("en-AU", { minimumFractionDigits: d, maximumFractionDigits: d });

export const priceStr = (v: number | null | undefined, d = 3): string =>
  v === null || v === undefined ? "—" : "$" + v.toFixed(d);

export const signColor = (v: number): string => (v >= 0 ? "var(--green)" : "var(--red)");
