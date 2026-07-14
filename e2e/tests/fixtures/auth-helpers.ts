import type { Page } from '@playwright/test';

/**
 * Log in as the designated E2E identity and hand the session to the browser.
 *
 * WHY WE LOG IN INSTEAD OF SIGNING UP: staging-suppuo authenticates against
 * PRODUCTION Huudis (`iss: https://huudis.com`). The previous fixture POSTed
 * /auth/signup, which meant every CI run minted a REAL USER IN THE PRODUCTION
 * IDENTITY DATABASE. At push frequency that is unacceptable. `gojo@forjio.com`
 * already exists in prod Huudis, is verified, and is the designated E2E
 * identity — so we sign IN as it and create nothing in Huudis.
 *
 * Suppuo's backend mounts @forjio/sdk/auth-server's createAuthRouter at
 * /api/v1/auth. Login is cookie-only: the response body is just
 * {data:{signedIn,role}} — no token, no user. The session IS the
 * `suppuo_session` cookie in Set-Cookie.
 *
 * THE CONSEQUENCE THE TESTS MUST DESIGN AROUND: gojo's account is PERSISTENT
 * and SHARED across runs. It accumulates data. Any assertion that assumes an
 * empty account ("No tickets yet", a zero count, an onboarding card) would
 * pass on the first run and rot forever after. So this fixture also mints a
 * resource that is unique to THIS RUN (see seedTicket) and the specs assert on
 * THAT — a string which exists nowhere in the client bundle and can therefore
 * only appear if the browser's own authenticated fetch succeeded, no matter
 * how much history the account has piled up.
 */

const FRONTEND_URL =
  process.env.FRONTEND_URL || 'https://staging-suppuo.forjio.com';
const API_BASE =
  process.env.BACKEND_URL || `${FRONTEND_URL.replace(/\/+$/, '')}/api/v1`;

const SESSION_COOKIE = 'suppuo_session';

const GOJO_EMAIL = process.env.GOJO_HUUDIS_EMAIL || 'gojo@forjio.com';

/**
 * The password is a REQUIRED secret. If it is missing we THROW — we never
 * test.skip(). A gate that quietly skips itself when a secret is absent is
 * exactly the inert gate this work exists to replace: it would go green on a
 * misconfigured CI while asserting nothing at all.
 */
function gojoPassword(): string {
  const pw = process.env.GOJO_HUUDIS_PASSWORD;
  if (!pw) {
    throw new Error(
      'GOJO_HUUDIS_PASSWORD is not set. The authenticated E2E gate signs in as ' +
        `${GOJO_EMAIL} and cannot run without it. Set it in the environment ` +
        '(CI: repo secret GOJO_HUUDIS_PASSWORD). This gate throws rather than ' +
        'skipping, on purpose — a silently-skipped gate asserts nothing.',
    );
  }
  return pw;
}

function frontendHostname(): string {
  try {
    return new URL(FRONTEND_URL).hostname;
  } catch {
    return 'staging-suppuo.forjio.com';
  }
}

/** Staging serves https, where the session cookie carries Secure — a planted
 *  cookie whose `secure` flag disagrees with the scheme is dropped silently. */
function frontendIsHttps(): boolean {
  try {
    return new URL(FRONTEND_URL).protocol === 'https:';
  } catch {
    return true;
  }
}

export interface TestAuth {
  user: { accountId: string; email: string };
  sessionCookie: string;
  /** Subject of the ticket minted for THIS run (see seedTicket). */
  ticketSubject: string;
}

/** A token unique to this run: `<epoch-ms>-<random>`. Nothing in the client
 *  bundle can contain it, so rendering it proves it came over the wire. */
function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Poll the authenticated /me until the session is queryable. Login can answer
 *  before the session is live; racing that bounces the dashboard to /login
 *  mid-test and reads as a product bug when it is a test bug. */
async function waitForSessionLive(
  sessionCookie: string,
): Promise<{ accountId: string } | null> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionCookie}` },
      });
      if (res.ok) {
        const json = await res.json();
        const accountId = json?.data?.accountId;
        if (accountId) return { accountId };
      }
    } catch {
      // network blip on a just-deployed staging — retry until the deadline
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

/**
 * Mint a ticket whose subject is unique to THIS run, so the inbox has a
 * data-dependent surface that survives a shared, ever-growing account.
 *
 * WHY THIS EXISTS: gojo's inbox is not empty and will only get fuller. An
 * "empty inbox" assertion is unusable, and "some row exists" would pass on
 * stale data from a previous run even if today's backend were dead. A subject
 * carrying this run's timestamp can only be on the page if the browser's own
 * authenticated GET /tickets returned the row we just created.
 *
 * The inbox lists `lastMessageAt desc` (page size 50), and a just-created
 * ticket's lastMessageAt is now — so it lands on the FIRST page regardless of
 * how many hundreds of tickets the account has accrued. That is what makes
 * this assertion state-independent rather than merely "fresh-ish".
 *
 * Throws on failure — a gate whose fixture silently no-ops is not a gate.
 */
export async function seedTicket(
  sessionCookie: string,
  subject: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${SESSION_COOKIE}=${sessionCookie}`,
    },
    body: JSON.stringify({
      subject,
      body: 'Automated E2E gate ticket. Safe to ignore.',
      // Deliberately an example.com address: the create path fires a
      // "we got your ticket" email at the requester, and this must not reach
      // a real inbox.
      requesterEmail: 'e2e-gate@example.com',
      requesterName: 'E2E Gate',
      channel: 'web',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `POST /tickets failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }
  const saved = json?.data?.subject;
  if (saved !== subject) {
    throw new Error(
      `POST /tickets returned an unexpected subject: ${JSON.stringify(json?.data)}`,
    );
  }
  return saved;
}

/** Sign in as gojo via the real staging login API, then mint this run's
 *  ticket so the inbox has a run-unique surface to assert on. */
export async function loginAsGojo(retries = 5): Promise<TestAuth> {
  const password = gojoPassword();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: GOJO_EMAIL, password }),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      const setCookie = res.headers.get('set-cookie') ?? '';
      const m = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(setCookie);
      if (!m) {
        throw new Error(
          `login succeeded but no ${SESSION_COOKIE} in Set-Cookie: ${setCookie}`,
        );
      }
      const sessionCookie = m[1];
      const live = await waitForSessionLive(sessionCookie);
      if (!live) {
        throw new Error(
          'login succeeded but GET /me never returned an account — the session never went live',
        );
      }
      const ticketSubject = await seedTicket(
        sessionCookie,
        `E2E gate ${runId()}`,
      );
      return {
        user: { accountId: live.accountId, email: GOJO_EMAIL },
        sessionCookie,
        ticketSubject,
      };
    }

    if (
      (res.status === 429 || json?.error?.code === 'RATE_LIMITED') &&
      attempt < retries
    ) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(
      `login as ${GOJO_EMAIL} failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }
  throw new Error(`login as ${GOJO_EMAIL} failed: retries exhausted`);
}

/** Plant the session cookie, then navigate. The frontend is cookie-first, so
 *  the cookie has to exist before any page JS runs. */
export async function authenticateAndNavigate(
  page: Page,
  auth: TestAuth,
  path: string,
): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: auth.sessionCookie,
      domain: frontendHostname(),
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: frontendIsHttps(),
    },
  ]);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}
