import "server-only";
import { promises as fs } from "fs";
import path from "path";

/** Presentation series seeded from the prototype (bridges, monthly bars, expenses). */
export interface BridgeStep {
  label?: string;
  val?: number;
  color?: string;
  kind: "line" | "subtotal" | "grand" | "sub" | "spacer";
}
export interface ExpenseItem { cat: string; name: string; detail: string; amt: number; }
export interface CapitalItem { period: string; detail: string; amt: number; }

export interface PortfolioSeries {
  divByMonth: Record<string, number>;
  topDivPayers: [string, number][];
  months: string[];
  buys: number[];
  sells: number[];
  cash?: { commsec: number; stake: number; total: number };
  openCash?: number;
  costBridge: BridgeStep[];
  perfBridge: BridgeStep[];
  expenses: ExpenseItem[];
  capitalAdded?: CapitalItem[];
}

export interface UiSeries {
  portfolio_1: PortfolioSeries;
  portfolio_2: PortfolioSeries;
}

export async function readUiSeries(): Promise<UiSeries | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "ui-series.json"), "utf-8");
    return JSON.parse(raw) as UiSeries;
  } catch {
    return null;
  }
}
