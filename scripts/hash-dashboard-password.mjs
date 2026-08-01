/**
 * Generate the DASHBOARD_AUTH_PASSWORD_HASH value for middleware.ts.
 * Run: node scripts/hash-dashboard-password.mjs "<new password>"
 * Paste the printed value into the Netlify env var DASHBOARD_AUTH_PASSWORD_HASH.
 * The plaintext password is never written anywhere — only shown once here.
 */
import { randomBytes, createHash } from "crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-dashboard-password.mjs \"<password>\"");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = createHash("sha256").update(salt + password).digest("hex");

console.log(`${salt}:${hash}`);
