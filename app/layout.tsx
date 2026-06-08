import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JPortfolio Dashboard",
  description: "Portfolio 1 (JSAF) & Portfolio 2 (Ind) — cash, dividends, holdings, performance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
