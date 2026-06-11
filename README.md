# Suppuo

Suppuo is a Forjio family product. Served at
[suppuo.com](https://suppuo.com) and mirrored at
[suppuo.forjio.com](https://suppuo.forjio.com).

## What this repo contains

- `backend/` — Express + Prisma API
- `frontend/` — Next.js 15 App Router (marketing site + dashboard)
- `cli/` — `@forjio/suppuo-cli` Commander-based CLI
- `e2e/` — Playwright suite (local + CI-against-staging)
- `copy/docs/` — markdown docs rendered at `/docs`
- `scripts/` — bootstrap, seed-demo, provision-do, standardize, codegen-sdk

## Develop

```bash
cd backend  && npm install && npm run dev   # :4170
cd frontend && npm install && npm run dev   # :3170
```

See [CLAUDE.md](./CLAUDE.md) for in-repo conventions and the wider
Forjio family architecture.
