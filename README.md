# JPortfolio Dashboard

Local-first + hosted portfolio dashboard for the JPortfolio vault (Portfolio 1 = JSAF, Portfolio 2 = Ind).

One Next.js codebase, two runtime modes (gated by `JPORTFOLIO_IS_LOCAL`):

| | **Local** (`npm run dev`) | **Hosted** (Netlify) |
|---|---|---|
| Dashboard | ✅ | ✅ |
| Live Yahoo prices (launch + refresh) | ✅ | ✅ |
| Upload statements → vault | ✅ | ⛔ (disabled) |
| Reconcile (TS → Python hybrid) | ✅ | ⛔ |
| LLM chat + clarifications + amendments | ✅ | ⛔ |
| Access | localhost | 🔒 password-protected |

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # then fill in vault path + an LLM key
node scripts/seed-data.mjs   # seed /data from the prototype numbers (one-off)
npm run dev                  # http://localhost:3000
```

Or use `Launch-JPortfolio-App.bat` from the vault root.

## Architecture

```
Upload → vault (JSAF/ or Ind/)
       → POST /api/reconcile  (TS orchestrator)
       → Python engine (build_portfolio_balances.py)   [local only, std-lib only]
       → lib/adapter.ts maps Python JSON → 17-file contract in /data
       → dashboard reads /data ; Yahoo prices on launch/refresh
       → commit SAFE JSON → private GitHub → Netlify rebuild
```

- **Data contract:** `lib/types.ts` + the JSON files in `/data` (see `App/02 Data Contract.md`).
- **Pricing:** `lib/yahooFinance.ts` + `app/api/market-prices/route.ts` (both modes). Opening-date prices are committed/stable; current prices are always fetched.
- **LLM:** server-side only (`lib/llm/providers.ts`). Keys never reach the browser. LLM powers chat + clarifications; figures are produced deterministically.
- **Amendments:** `preview` → user approves → `apply` (records a decision). No JSON is overwritten without approval.

## Privacy

- `.env.local`, raw statements, and private chat/decision logs are git-ignored.
- Only dashboard-safe JSON in `/data` is meant for the repo.
- Hosted site requires `DASHBOARD_AUTH_USER` / `DASHBOARD_AUTH_PASSWORD` (set in Netlify) to lock it down (see `middleware.ts`).

## Netlify deploy

Push to a **private** GitHub repo → connect to Netlify. `netlify.toml` sets the Next.js build.
Do **not** set `JPORTFOLIO_IS_LOCAL=true` on Netlify — that keeps the hosted site dashboard-only.
Set `DASHBOARD_AUTH_USER`, `DASHBOARD_AUTH_PASSWORD`, and `YAHOO_FINANCE_ENABLED=true` in the Netlify UI.
