import { NextRequest, NextResponse } from "next/server";

/**
 * Password protection for the HOSTED dashboard.
 *
 * - Local mode (JPORTFOLIO_IS_LOCAL=true): auth is skipped entirely.
 * - Hosted mode: if DASHBOARD_AUTH_USER and DASHBOARD_AUTH_PASSWORD are set,
 *   require HTTP Basic auth before serving any page. If they are NOT set, the
 *   site is served openly (configure them in the Netlify UI to lock it down).
 *
 * This keeps real financial figures behind a login on the public URL while
 * leaving localhost frictionless.
 */
export function middleware(req: NextRequest) {
  const isLocal = process.env.JPORTFOLIO_IS_LOCAL === "true";
  if (isLocal) return NextResponse.next();

  const user = process.env.DASHBOARD_AUTH_USER;
  const pass = process.env.DASHBOARD_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next(); // not configured → no gate

  const header = req.headers.get("authorization");
  if (header) {
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded); // Edge runtime: Buffer is unavailable
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="JPortfolio Dashboard"' },
  });
}

export const config = {
  // Protect everything except static assets and the Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
