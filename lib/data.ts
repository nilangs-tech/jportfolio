import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { DataBundle } from "./types";

/**
 * Server-side reader for the committed dashboard JSON in /data.
 * Every dataset is an array; a missing/invalid file degrades to [] so the UI
 * always renders. This is the only data source the hosted dashboard uses.
 */

const DATA_DIR = path.join(process.cwd(), "data");

export async function readDataset<K extends keyof DataBundle>(name: K): Promise<DataBundle[K]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${name}.json`), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ([] as unknown as DataBundle[K]);
  } catch {
    return [] as unknown as DataBundle[K];
  }
}

export async function writeDataset<K extends keyof DataBundle>(name: K, rows: DataBundle[K]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${name}.json`), JSON.stringify(rows, null, 2), "utf-8");
}

/** Filter helper: rows for a portfolio, with `combined` rows passed through where relevant. */
export function forPortfolio<T extends { portfolio_id: string }>(rows: T[], id: string): T[] {
  return rows.filter((r) => r.portfolio_id === id);
}

export { DATA_DIR };
