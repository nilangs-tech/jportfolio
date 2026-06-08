/**
 * Central runtime configuration + the local/hosted mode flag.
 * Server-only values (vault path, API keys) must never be imported into client components.
 */

export const IS_LOCAL = process.env.JPORTFOLIO_IS_LOCAL === "true";

/** Public, client-safe mode string. */
export const APP_MODE: "local" | "hosted" = IS_LOCAL ? "local" : "hosted";

export type LlmProvider = "openai" | "anthropic" | "manual";

export const serverConfig = {
  isLocal: IS_LOCAL,
  vaultPath: process.env.JPORTFOLIO_VAULT_PATH ?? "",
  portfolio1Folder: process.env.JPORTFOLIO_PORTFOLIO_1_FOLDER ?? "JSAF",
  portfolio2Folder: process.env.JPORTFOLIO_PORTFOLIO_2_FOLDER ?? "Ind",
  pythonBin: process.env.PYTHON_BIN ?? "python",
  defaultProvider: (process.env.LLM_PROVIDER as LlmProvider) ?? "anthropic",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
  yahooEnabled: process.env.YAHOO_FINANCE_ENABLED !== "false",
};

/** Folder for a portfolio id. */
export function folderForPortfolio(portfolioId: string): string {
  return portfolioId === "portfolio_2" ? serverConfig.portfolio2Folder : serverConfig.portfolio1Folder;
}

/**
 * Guard for local-only API routes. Returns a 403 Response when called on the
 * hosted build, otherwise null (allow).
 */
export function ensureLocalOnly(): Response | null {
  if (IS_LOCAL) return null;
  return new Response(
    JSON.stringify({
      ok: false,
      error: "This feature is local-only and is disabled on the hosted dashboard.",
    }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

/** Required-env validation for the local app's setup warning banner. */
export function localSetupIssues(): string[] {
  if (!IS_LOCAL) return [];
  const issues: string[] = [];
  if (!serverConfig.vaultPath) issues.push("JPORTFOLIO_VAULT_PATH is not set.");
  if (serverConfig.defaultProvider === "openai" && !serverConfig.openaiKey)
    issues.push("LLM_PROVIDER=openai but OPENAI_API_KEY is empty.");
  if (serverConfig.defaultProvider === "anthropic" && !serverConfig.anthropicKey)
    issues.push("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty.");
  return issues;
}
