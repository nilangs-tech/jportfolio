import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Local-only features (upload / reconcile / chat / amendments) are gated at runtime
  // by the IS_LOCAL flag in lib/config.ts. The hosted Netlify build runs dashboard-only.
  env: {
    NEXT_PUBLIC_APP_MODE: process.env.JPORTFOLIO_IS_LOCAL === "true" ? "local" : "hosted",
  },
};

export default nextConfig;
