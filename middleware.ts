import { NextRequest, NextResponse } from "next/server";

/**
 * Password protection for the HOSTED dashboard.
 *
 * - Local mode (JPORTFOLIO_IS_LOCAL=true): auth is skipped entirely.
 * - Hosted mode: if DASHBOARD_AUTH_USER and DASHBOARD_AUTH_PASSWORD_HASH are
 *   set, require HTTP Basic auth before serving any page. If they are NOT
 *   set, the site is served openly (configure them in the Netlify UI to lock
 *   it down).
 *
 * The password is never stored or compared in plaintext: DASHBOARD_AUTH_PASSWORD_HASH
 * holds "<salt>:<sha256-hex>" (see scripts/hash-dashboard-password.mjs to generate
 * it), and the submitted password is salted + hashed the same way before a
 * constant-time comparison. Transit protection is TLS — Netlify serves every
 * site over HTTPS, so the Basic-Auth header is already encrypted in flight;
 * the hashing here only protects the credential at rest / in the env store.
 */

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to avoid leaking hash match length via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// TEMPORARY diagnostic — remove once the auth gate is confirmed working.
// Reports (never leaks values) whether the middleware sees the env vars it needs.
function withDebugHeaders(res: NextResponse, extra: Record<string, string>): NextResponse {
  res.headers.set("X-Auth-Debug-Local", process.env.JPORTFOLIO_IS_LOCAL === "true" ? "true" : "false");
  res.headers.set("X-Auth-Debug-User-Set", process.env.DASHBOARD_AUTH_USER ? "yes" : "no");
  res.headers.set("X-Auth-Debug-Hash-Set", process.env.DASHBOARD_AUTH_PASSWORD_HASH ? "yes" : "no");
  for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
  return res;
}

export async function middleware(req: NextRequest) {
  const isLocal = process.env.JPORTFOLIO_IS_LOCAL === "true";
  if (isLocal) return withDebugHeaders(NextResponse.next(), { "X-Auth-Debug-Reason": "local-mode" });

  const user = process.env.DASHBOARD_AUTH_USER;
  const saltedHash = process.env.DASHBOARD_AUTH_PASSWORD_HASH; // "<salt>:<sha256-hex>"
  if (!user || !saltedHash) return withDebugHeaders(NextResponse.next(), { "X-Auth-Debug-Reason": "not-configured" }); // not configured → no gate

  const [salt, expectedHash] = saltedHash.split(":");
  if (!salt || !expectedHash) return withDebugHeaders(NextResponse.next(), { "X-Auth-Debug-Reason": "malformed-hash" });

  const header = req.headers.get("authorization");
  if (header) {
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded); // Edge runtime: Buffer is unavailable
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user) {
        const actualHash = await sha256Hex(salt + p);
        if (timingSafeEqual(actualHash, expectedHash)) return withDebugHeaders(NextResponse.next(), { "X-Auth-Debug-Reason": "authenticated" });
      }
    }
  }

  return withDebugHeaders(
    new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="JPortfolio Dashboard"' },
    }),
    { "X-Auth-Debug-Reason": "challenge" },
  );
}

export const config = {
  // Protect everything except static assets and the Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
