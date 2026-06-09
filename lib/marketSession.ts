/**
 * ASX market session helpers — Sydney (Australia/Sydney) timezone aware.
 * No server-only import: safe to use in client components.
 */

// ASX public holidays (NSW) — dates when the market is closed despite being a weekday.
const ASX_HOLIDAYS = new Set([
  // 2025
  "2025-01-01", // New Year's Day
  "2025-01-27", // Australia Day (observed — 26 Jan is Sunday)
  "2025-04-18", // Good Friday
  "2025-04-19", // Easter Saturday (ASX closed)
  "2025-04-21", // Easter Monday
  "2025-04-25", // Anzac Day
  "2025-06-09", // Queen's Birthday (NSW)
  "2025-12-25", // Christmas Day
  "2025-12-26", // Boxing Day
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-26", // Australia Day
  "2026-04-03", // Good Friday
  "2026-04-04", // Easter Saturday
  "2026-04-06", // Easter Monday
  "2026-06-08", // Queen's Birthday (NSW — 2nd Monday June)
  "2026-12-25", // Christmas Day
  "2026-12-28", // Boxing Day (observed — 26 Dec is Saturday)
  // 2027
  "2027-01-01", // New Year's Day
  "2027-01-26", // Australia Day
  "2027-03-26", // Good Friday
  "2027-03-27", // Easter Saturday
  "2027-03-29", // Easter Monday
  "2027-04-26", // Anzac Day (observed — 25 Apr is Sunday)
  "2027-06-14", // Queen's Birthday (NSW — 2nd Monday June)
  "2027-12-27", // Christmas (observed — 25 Dec is Saturday)
  "2027-12-28", // Boxing Day (observed)
]);

/** Returns a Date-like object broken down to Sydney local time parts. */
function sydneyParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year:    parseInt(parts.year),
    month:   parseInt(parts.month),
    day:     parseInt(parts.day),
    hour:    parseInt(parts.hour),   // 0-23
    minute:  parseInt(parts.minute),
    second:  parseInt(parts.second),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`, // YYYY-MM-DD
    dayOfWeek: new Date(
      parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day)
    ).getDay(), // 0=Sun, 6=Sat
  };
}

export type MarketStatus =
  | "pre-market"   // trading day, 00:00–09:59 Sydney
  | "open"         // ASX open, 10:00–16:00 Sydney
  | "after-hours"  // trading day, 16:01–23:59 Sydney
  | "weekend"      // Saturday or Sunday
  | "holiday";     // weekday ASX holiday

/** Current ASX market status in Sydney time. */
export function getMarketStatus(now = new Date()): MarketStatus {
  const s = sydneyParts(now);
  if (s.dayOfWeek === 0 || s.dayOfWeek === 6) return "weekend";
  if (ASX_HOLIDAYS.has(s.dateStr)) return "holiday";
  const mins = s.hour * 60 + s.minute;
  if (mins < 9 * 60) return "pre-market";          // before 09:00
  if (mins < 10 * 60) return "pre-market";          // 09:00–09:59 (exchange prep)
  if (mins <= 16 * 60) return "open";               // 10:00–16:00
  return "after-hours";
}

/** True if today is an ASX trading day (regardless of current time). */
export function isAsxTradingDay(now = new Date()): boolean {
  const s = sydneyParts(now);
  if (s.dayOfWeek === 0 || s.dayOfWeek === 6) return false;
  return !ASX_HOLIDAYS.has(s.dateStr);
}

/** Sydney local time formatted as "HH:MM" */
export function sydneyTimeStr(now = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
}

/** Sydney date formatted as "Mon 9 Jun" */
export function sydneyDateStr(now = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short", day: "numeric", month: "short",
  }).format(now);
}
