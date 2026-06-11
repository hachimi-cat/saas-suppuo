# CLAUDE.md — Forjio Service Template

This repo is the **template**. When a Forjio product is forked from it,
copy this file into the forked repo and replace `FORJIO_BRAND` /
`forjio-brand` / `Forjio Brand` with the actual product identity.

## For Claude working inside a product repo forked from this template

### Product identity

- Brand: `FORJIO_BRAND` (e.g., "huudis")
- Domain: `brand.com` + `brand.forjio.com`
- Repo: `hachimi-cat/FORJIO_BRAND`
- CLI package: `@forjio/FORJIO_BRAND-cli`

### Non-negotiable

- **Use `@forjio/sdk`.** Never reinvent JWT verify, ARN parse, event
  envelope, API response envelope, policy eval. If it's in the SDK,
  import it.
- **Follow ADRs.** Load-bearing decisions live in
  [hachimi-cat/forjio-architecture/adr/](https://github.com/hachimi-cat/forjio-architecture/tree/master/adr).
  Read before inventing new patterns.
- **One DB per service.** This repo's DB belongs only to this product.
  No cross-service SQL. Cross-service data comes via REST or events.
- **Outbox for state changes.** See ADR-0006. Write to `outbox_events`
  inside the same transaction as the state change.
- **Idempotent consumers.** Every event handler guards on
  `processed_events(event_id)` unique.

### Repo shape

| Dir | Purpose |
|---|---|
| `backend/` | Express + Prisma. `app.ts` (`createApp` factory) + `index.ts` (listener) split. Auth: `routes/auth.ts` (cookie-first Huudis SSO — login/signup/OIDC) is a thin `createAuthRouter` over the shared `@forjio/sdk/auth-server` BFF kit; product-specific config (cookie name, client id, scope, accountId derivation, roles, sign-in gate) lives in `src/auth-config.ts` — which ships two roles: the open multi-tenant `merchant` and the workspace-gated `admin`. `routes/huudis-proxy.ts` (`createHuudisProxy`, mounted `/api/v1/huudis`) proxies account + workspace management to Huudis. JWT verify for API callers via `@forjio/sdk/auth`. Shared `src/lib/` (http envelope helpers, ids, cursor, async-handler, zod-error, test-keys) + `src/middleware/` (request-id, rate-limit, idempotency, zod-error, auth, **admin-guard** — guards `/api/v1/admin/*` on an admin session or `X-Forjio-Admin-Secret`). Add product routes under `backend/src/routes/`; mount admin routers under `/admin` behind `adminGuard`. |
| `frontend/` | Next.js 15 App Router. Marketing at `/`, dashboard at `/dashboard`, OIDC at `/callback`. Built-in admin portal at `/admin/*` (the `(admin)` route group: login/forgot/reset + a gated `(portal)` dashboard via `@forjio/portal-ui` `brandTag="Admin"`; admin BFF proxy at `app/api/v1/console/[...path]`). `src/lib/api.ts` (client fetch) + `src/lib/api-server.ts` (RSC cookie forwarding). Error + loading boundaries at `src/app/(dashboard)/` and `src/app/(admin)/admin/(portal)/`. |
| `deploy/` | `nginx/<brand>.conf` — reference vhost. `^~ /api/v1/console/` → frontend (admin BFF proxy), everything else under `/api/v1/` → backend, default → frontend. `scripts/install.sh` symlinks it into `sites-enabled`. |
| `cli/` | Commander-based CLI. `auth login/whoami/logout` ship; session stored via `src/lib/session.ts` at `~/.FORJIO_BRAND/session.json`. |
| `e2e/` | Playwright. `playwright.config.ts` (local dev) + `playwright.ci.config.ts` (CI against staging — see ci-cd.yml). Health smoke ships; add per-flow tests per milestone. |

### CI/CD — shared staging E2E pattern

- `.github/workflows/ci-cd.yml` is parameterized via three env vars at
  the top: `FORJIO_BRAND`, `BACKEND_PORT`, `FRONTEND_PORT`. Set these
  when forking; the rest is mechanical.
- Job sequence: `lint → test → build → deploy-staging → e2e-staging →
  deploy-production → release`.
- **E2E reaches staging over Tailscale MagicDNS** at
  `http://staging-FORJIO_BRAND/` (nginx :80 on `tailscale0`). Requires
  secrets `TS_AUTHKEY` + `E2E_BYPASS_SECRET` + `SSH_PRIVATE_KEY` +
  `STAGING_HOST` + `PRODUCTION_HOST`. Battle-tested in saas-linksnap;
  plugipay converged to this pattern on 2026-04-20 after hitting
  UFW-blocked :443 on public DNS.

### Backend conventions

- **API envelope**: `{ data, error, meta: { requestId, timestamp,
  cursor?, hasMore? } }`. Wire shape matches `@forjio/sdk/http`.
  Compose via `src/lib/http.ts` helpers (`sendOk`, `sendCreated`,
  `sendList`, `sendErr`).
- **Error codes**: UPPER_SNAKE_CASE (`NOT_FOUND`, `CONFLICT`,
  `VALIDATION_ERROR`, `AUTH_REQUIRED`, `FORBIDDEN`, `INVALID_SIGNATURE`,
  `IDEMPOTENCY_KEY_IN_USE`, `INTERNAL_ERROR`). Use the `ApiError`
  class from `src/lib/http.ts` so routes throw instead of branching.
- **IDs**: ULID via `newId(prefix)` from `src/lib/ids.ts`. ARNs via
  `buildArn(accountId, resource, id)` — see ADR-0002.
- **Pagination**: base64url cursor `{createdAt, id}` via
  `src/lib/cursor.ts`.
- **Route factory**: `routes/index.ts` exports a factory accepting
  `RoutesOptions.enableTestOnlyRoutes`. Tests opt in;
  production never does.
- **Outbox writes inside the same transaction** as the state change.
  Consumer guards on `processed_events(event_id)` PK. See ADR-0006.

### Frontend conventions

- **Data access**: `src/lib/api.ts` for client components (fetch,
  auto Idempotency-Key on mutating calls, throws `ApiRequestError`).
  `src/lib/api-server.ts` (`'server-only'`) for RSCs that need to
  forward cookies into the backend.
- **Error boundaries**: `error.tsx` + `loading.tsx` at each route
  group. Use `<ErrorPanel />` from `src/components/ui/error-panel.tsx`.
- **Styling**: Tailwind + CSS custom properties (HSL triplets in
  `app/globals.css`). Required — `@forjio/website-ui` (the marketing
  chrome) ships Tailwind classes, so `tailwind.config.ts` must include
  the `./node_modules/@forjio/website-ui/dist/**` content glob. Retune
  `--primary` / `--ring` to the brand accent after forking.
- **Marketing site**: hand-coded TSX under `src/app/(marketing)/`,
  built from `@forjio/website-ui` primitives — same as every shipped
  product (linksnap is the reference). The home page has a locked
  9-section structure (Hero → How it works → Features → Pricing →
  Comparison → For developers → Forjio family → FAQ → CTA). Docs are
  the exception: they render from markdown in `copy/docs/*.md` via
  `src/lib/markdown.tsx` (add a page → drop a `.md` + a `DOC_NAV` entry).

### Testing conventions

- Unit + integration in `backend/src/__tests__/` (Vitest). `npm test`
  runs with `--passWithNoTests` so scaffolding doesn't break CI
  before coverage ramps.
- E2E in `e2e/tests/` (Playwright). Run locally against
  `localhost:3000/4000`; CI hits `staging-FORJIO_BRAND` over Tailscale.
- CLI tests in `cli/src/__tests__/`.
- `npm run type-check` at each dir = `tsc --noEmit`. CI's
  Lint & Type Check job invokes this explicitly.

### Conventions from Storlaunch/Plugipay/LinkSnap worth keeping

- API envelope shape (as above).
- Prisma migrations named `YYYYMMDDHHMMSS_<snake_case>`.
- Semver bumps on CLI on every feature commit.
- Gojo log + memory update per session.
- Backend adapter convention (from plugipay) — **optional**. When a
  service integrates external providers, put them under
  `backend/src/adapters/<provider>/` with a shared interface. Not
  every service needs this.

### DO NOT

- Copy Prisma models from Storlaunch/Plugipay without adapting to
  this service's bounded context.
- Add auth tables — they live in Huudis.
- Add a `Customer` model without thinking about whether it should be in
  Plugipay (payment customer) vs. Fulkruma (buyer address book) vs.
  Suppuo (support contact). Most likely: reference a Huudis identity +
  your own thin context-specific record.
- Add `@tanstack/react-query`, state libraries, component kits etc. to
  the template just because plugipay has them. Tailwind + `lucide-react`
  + `@forjio/website-ui` ARE baseline (the marketing site needs them);
  anything beyond that is a per-product choice — keep the template lean.
- Add FORJIO4 HMAC middleware from plugipay unless you're actually
  building a payment-style API with signed requests.

### See also

- [`TEMPLATE-UPGRADE-AUDIT.md`](./TEMPLATE-UPGRADE-AUDIT.md) — the
  2026-04-20 audit that established the current scaffolding. Names
  each pattern's source product and the rationale for each pick.
