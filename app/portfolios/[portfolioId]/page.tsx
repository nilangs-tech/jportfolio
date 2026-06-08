import { redirect } from "next/navigation";

/**
 * Deep-link placeholder for a single portfolio. The main dashboard at "/" already
 * provides Summary / Portfolio 1 / Portfolio 2 tabs, so we redirect there.
 * (Can be expanded into a dedicated single-portfolio view later.)
 */
export default async function PortfolioPage() {
  redirect("/");
}
