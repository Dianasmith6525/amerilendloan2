# Copilot Instructions

## Quick orientation
- `client/` is a Vite + React SPA. The entry point is `client/src/main.tsx`, which wires `@/lib/trpc` with `@tanstack/react-query`, `superjson`, and the Wouter router defined in `client/src/App.tsx`.
- `server/` is an Express + tRPC application. `server/_core/index.ts` boots Express, registers OAuth routes, mounts `/api/trpc`, and either proxies Vite (dev) or serves `dist/public` (production).
- `shared/` stores the constants and types shared across client and server (`tsconfig` aliases `@shared/*`). Use these files when you need shared enums, message strings, or type definitions instead of duplicating values.

## Architecture notes
- The tRPC schema lives in `server/routers.ts`. Most client features consume these routers (`auth`, `loans`, `feeConfig`, `payments`, `disbursements`, `system`), so keep this file and `API_DOCUMENTATION.md` in sync when you add or rename procedures.
- `server/db.ts` wraps `drizzle/schema.ts` entities for all persistence logic. Prefer reusing these helpers when talking to MySQL rather than issuing raw SQL.
- Server guards are expressed via `server/_core/trpc.ts` (`publicProcedure`, `protectedProcedure`, `adminProcedure`) and always return `UNAUTHED_ERR_MSG`/`NOT_ADMIN_ERR_MSG` from `shared/const.ts`. Matching these helpers on the client keeps auth handling predictable.
- Authentication flows are handled by `server/_core/sdk.ts`, `cookies.ts`, and `registerOAuthRoutes`. Sessions are JWTs signed with `JWT_SECRET` and stored under `COOKIE_NAME = "app_session_id"`; refresh logic lives in `sdk.authenticateRequest`.
- `client/src/const.ts` builds `getLoginUrl()` from `VITE_*` env vars so that the OAuth redirect URI matches the current origin. The client counts on `UNAUTHED_ERR_MSG` to redirect unauthorized queries via the `QueryClient` subscribers in `main.tsx`.
- Payment integrations surface inside `server/_core/payments` helpers: `stripe.ts` (card) and `crypto-payment.ts` (mocked crypto charges with future Coinbase/Forge hooks). `router.payments` bridges these helpers to the frontend and writes payment/disbursement rows via `server/db.ts`.

## Workflow commands
- Development server (Express + Vite + tsx watch). Run from the repo root:
```powershell
env NODE_ENV=development pnpm dev
```
  The dev script uses `tsx watch server/_core/index.ts` so you get hot reloads for server code and Vite HMR for the client via `server/_core/vite.ts`.
- Full production build (client + server bundle):
```powershell
pnpm build
```
  This runs `vite build` for the client and `esbuild` for the server, outputting a runnable `dist/index.js` and static assets under `dist/public`.
- Run the bundled server locally:
```powershell
pnpm start
```
- Type checking:
```powershell
pnpm run check
```
- Unit tests (Vitest):
```powershell
pnpm test
```
- Format with Prettier:
```powershell
pnpm format
```
- Schema migrations (Drizzle):
```powershell
pnpm db:push
```
  Make sure `DATABASE_URL` is set; `drizzle.config.ts` enforces it.

## Environment & integration essentials
- Shared env keys (see `server/_core/env.ts`): `VITE_APP_ID`, `JWT_SECRET`, `DATABASE_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`. The server logs missing values during startup.
- Client-only `VITE_*` variables (used in `client/src/const.ts` and `tailwind` theming): `VITE_APP_TITLE`, `VITE_APP_LOGO`, `VITE_OAUTH_PORTAL_URL`. The Vite build injects them directly, so local dev should supply `.env` files or PowerShell env vars.
- Payment environment variables surface inside `server/_core/stripe.ts` and `server/_core/crypto-payment.ts`: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `COINBASE_COMMERCE_API_KEY`, `COINBASE_COMMERCE_WEBHOOK_SECRET`, `CRYPTO_PAYMENT_ENVIRONMENT`. Missing keys mostly return friendly failures (e.g., Stripe functions return `success: false`).
- Static legal/marketing copy is served from `client/public/legal/*` and should be updated in that folder when requirements change.

## Conventions to follow
- Use `@/` for client imports (`client/src/*`) and `@shared/*` for everything under `shared/`. The tsconfig paths make these available to both Vite and Node during bundling.
- Keep UI patterns aligned with the `components/ui` folder (Radix + Tailwind utility wrappers). `ThemeProvider` in `client/src/contexts/ThemeContext.tsx` controls the `body` class used by the CSS variables under `client/src/index.css`.
- When adding or changing tRPC procedures, adjust the `API_DOCUMENTATION.md` fragment that mirrors that router and update any affected `client/src/pages/*` queries/mutations.
- Always return superjson-friendly data from server procedures—the global transformer (`server/_core/trpc.ts`) is `superjson`, so avoid non-serializable values such as class instances.
- The client expects `/api/trpc` to respond with `UNAUTHED_ERR_MSG` on 401s; this is how `client/src/main.tsx` determines when to redirect to `getLoginUrl()`.
- CRUD operations should almost always route through `server/db.ts` helpers (`createLoanApplication`, `updatePaymentStatus`, etc.) so downstream models stay in sync with `drizzle/schema.ts`.

## Documentation & supporting guides
- The living API spec in `API_DOCUMENTATION.md` reproduces every router, validation rule, and side effect described in `server/routers.ts`. Update both files together.
- Deep-dive guides exist for OTP (`OTP_AUTHENTICATION_GUIDE.md`), payments (`PAYMENT_INTEGRATION_GUIDE.md`), legal flows (`LEGAL_DOCUMENTS_GUIDE.md`), and deployment (`DEPLOYMENT_GUIDE.md`). Consult those to understand business rules before touching related code.
- `DATABASE_SCHEMA.md`, `drizzle/migrations`, and `drizzle/meta` track the schema state. Regenerate snapshots only after changing `drizzle/schema.ts`.
- User documentation lives in `userGuide.md` and `TEST_CASES.md`; skim them to understand user journeys and acceptance criteria before implementing new flows.

## Testing & validation reminders
- `pnpm test` runs `vitest` against both client and shared tests. This repo does not have separate test folders, so assume a broad sweep.
- `pnpm run check` uses `tsc --noEmit` with `strict` and `noEmit` enabled. Run it before releases.
- Keep `pnpm format` handy—Prettier is the formatter of record and shares the workspace with TypeScript/Vite config files.
- After building, `server/_core/vite.ts` expects `dist/public/index.html`. If you add assets under `client/public`, rerun `pnpm build` so the static server has the latest files.

## Questions & feedback
If any section above is unclear, please let me know so I can expand or correct it.