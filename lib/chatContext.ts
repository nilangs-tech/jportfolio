import "server-only";
import { readDataset } from "./data";

/**
 * Builds a compact, privacy-aware context for the chat LLM.
 * Sends only structured JSON summaries/records relevant to the question —
 * never whole vault folders or raw statement text.
 */
export async function buildChatContext(portfolioId: string, question: string): Promise<string> {
  const [summary, perf, dq, positions, corp, cashClass] = await Promise.all([
    readDataset("summary"),
    readDataset("performance-summary"),
    readDataset("data-quality"),
    readDataset("position-changes"),
    readDataset("corporate-actions"),
    readDataset("cash-classification-summary"),
  ]);

  const wanted = (id: string) => portfolioId === "combined" || id === portfolioId || id === "combined";
  const q = question.toLowerCase();

  const parts: string[] = [];
  parts.push("SUMMARY:\n" + JSON.stringify(summary.filter((s) => wanted(s.portfolio_id)), null, 0));
  parts.push("PERFORMANCE:\n" + JSON.stringify(perf.filter((p) => wanted(p.portfolio_id)), null, 0));
  if (/divid|cash|transfer|refund|pension|expense|interest/.test(q))
    parts.push("CASH_CLASSIFICATION:\n" + JSON.stringify(cashClass.filter((c) => wanted(c.portfolio_id)), null, 0));
  if (/new|closed|position|holding|sold|bought/.test(q))
    parts.push("POSITION_CHANGES:\n" + JSON.stringify(positions.filter((p) => wanted(p.portfolio_id)), null, 0));
  if (/corporate|merger|acqui|delist|split|ticker|demerger/.test(q))
    parts.push("CORPORATE_ACTIONS:\n" + JSON.stringify(corp.filter((c) => wanted(c.portfolio_id)), null, 0));
  parts.push("DATA_QUALITY_WARNINGS:\n" + JSON.stringify(dq.filter((d) => wanted(d.portfolio_id)), null, 0));

  return parts.join("\n\n");
}
