import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { serverConfig, folderForPortfolio } from "./config";

/** Resolve the absolute vault folder for a portfolio (e.g. <vault>/JSAF). */
export function vaultFolderFor(portfolioId: string): string {
  return path.join(serverConfig.vaultPath, folderForPortfolio(portfolioId));
}

/** Save an uploaded statement into the correct vault folder. Returns the saved path. */
export async function saveStatement(portfolioId: string, filename: string, bytes: Buffer): Promise<string> {
  if (!serverConfig.vaultPath) throw new Error("JPORTFOLIO_VAULT_PATH is not configured.");
  const safe = filename.replace(/[/\\]/g, "_").replace(/[^A-Za-z0-9._ -]/g, "");
  const dir = vaultFolderFor(portfolioId);
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, safe);
  await fs.writeFile(dest, bytes);
  return dest;
}
