---
title: "CLI"
---

# CLI

Buat yang lebih nyaman di terminal — Suppuo punya CLI resmi. The
`suppuo` CLI ships as `@forjio/suppuo-cli` on npm and follows the same
conventions as every Forjio product CLI.

> **Early preview.** The CLI currently ships the `auth` command group
> only, and device-flow sign-in is still being enabled on the Huudis
> side — see the honest status notes below before scripting against it.

## Install

Requires Node.js 20+.

```bash
npm install -g @forjio/suppuo-cli
suppuo --version
```

## Commands

### `suppuo auth login`

Signs you in via the Huudis OIDC **device flow**: the CLI prints a
verification URL + code, you approve in the browser, and the session is
stored locally at `~/.suppuo/session.json`.

```bash
suppuo auth login
```

**Status:** the command exists, but the device flow isn't live yet —
Suppuo's CLI is awaiting device-flow client registration in Huudis.
Until then `auth login` prints a clear "not yet wired" notice instead
of pretending to sign you in. Use the
[REST API with a Bearer token](/docs/api-auth) for automation in the
meantime.

### `suppuo auth whoami`

Shows the currently signed-in identity (or tells you you're not
signed in).

```bash
suppuo auth whoami
```

### `suppuo auth logout`

Clears the local session.

```bash
suppuo auth logout
```

## What's coming

Once sign-in is live, ticket commands are next — listing your inbox,
replying, and updating status from the terminal, mirroring the
[Tickets API](/docs/tickets). Until they land, everything the CLI will
do is already available over the REST API.

## See also

- [API authentication](/docs/api-auth) — Bearer tokens for scripts
  today.
- [Tickets API](/docs/tickets) — the endpoints the CLI will wrap.
