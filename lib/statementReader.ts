import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { serverConfig, folderForPortfolio } from "./config";

/**
 * Reads the Python engine's output JSON for a portfolio.
 * Located at <vault>/<folder>/outputs/portfolio_balances_data.json
 * Returns null if the file doesn't exist or can't be parsed.
 */
export async function readPythonOutput(portfolioId: string): Promise<Record<string, unknown> | null> {
  if (!serverConfig.vaultPath) return null;
  try {
    const folder = folderForPortfolio(portfolioId);
    const outputPath = path.join(serverConfig.vaultPath, folder, "outputs", "portfolio_balances_data.json");
    const raw = await fs.readFile(outputPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** List statement files (CSV/ZIP/XLSX/PDF) in the vault folder for a portfolio. */
export async function listStatements(portfolioId: string): Promise<string[]> {
  if (!serverConfig.vaultPath) return [];
  try {
    const dir = path.join(serverConfig.vaultPath, folderForPortfolio(portfolioId));
    const entries = await fs.readdir(dir);
    return entries.filter((f) => /\.(csv|zip|xlsx|pdf)$/i.test(f));
  } catch {
    return [];
  }
}
