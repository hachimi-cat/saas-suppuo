import { expect, test, type Page } from '@playwright/test';
import { loginAsGojo, authenticateAndNavigate, type TestAuth } from './fixtures/auth-helpers';

/**
 * The authenticated smoke gate.
 *
 * Until this existed, the only thing standing between a push and production
 * was a health-endpoint check and a marketing-page render — both PUBLIC. The
 * entire logged-in product could have been broken and the pipeline would have
 * shipped it, green.
 *
 * This signs in as the designated E2E identity (gojo@forjio.com) through the
 * real login API, carries the real session into the browser, and drives the
 * dashboard. If auth breaks, this breaks.
 *
 * WHY IT ASSERTS ON DATA, NOT JUST THE SHELL: every fetch on the dashboard
 * ends in `.catch(() => undefined)`, so a completely dead backend still
 * renders the heading, the nav, and a row of zeros. A gate that only checked
 * "the heading appears" would pass against a broken product — which is the
 * failure mode this whole exercise exists to remove.
 *
 * WHY EVERY ASSERTION IS STATE-INDEPENDENT: gojo's account is persistent and
 * shared across runs, and it accumulates data. Nothing here may assume a
 * virgin account. The two things we assert on are:
 *
 *   1. The support-form URL `/support/<accountId>`. It is derived from the
 *      ACCOUNT (the browser's own /me call), not from a mutable list, so it
 *      reads the same on run 1 and run 500. It still cannot be faked: a shell
 *      that rendered with every fetch failing has no accountId and omits the
 *      whole <code> block.
 *   2. The subject of the ticket the fixture minted for THIS run. It carries
 *      this run's timestamp, so it exists nowhere in the client bundle and
 *      cannot be satisfied by leftovers from a previous run — while remaining
 *      indifferent to how many tickets the account already holds, because the
 *      inbox sorts newest-first.
 */

const IGNORED_CONSOLE = [/favicon/i, /Download the React DevTools/i];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

let auth: TestAuth;

test.beforeAll(async () => {
  auth = await loginAsGojo();
});

test('the authenticated dashboard renders, and its data path is live', async ({ page }) => {
  const errors = watchConsole(page);

  await authenticateAndNavigate(page, auth, '/dashboard');

  // A bounce to /login is the failure this gate exists to catch.
  expect(page.url(), 'bounced to login — the session was rejected').not.toContain('/login');

  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({
    timeout: 30_000,
  });

  // The load-bearing assertion. This <code> block only renders once the
  // browser's own authenticated /me call has returned an accountId, so it
  // cannot be faked by a shell that rendered with every fetch failing.
  // It is account-derived, not list-derived, so an account with a long history
  // renders it exactly like a fresh one.
  await expect(
    page.getByText(`/support/${auth.user.accountId}`),
    'the support-form URL never rendered — the authenticated /me call failed in the browser',
  ).toBeVisible({ timeout: 30_000 });

  expect(errors, `console errors on /dashboard:\n${errors.join('\n')}`).toEqual([]);
});

test('the inbox renders this run ticket for a logged-in user', async ({ page }) => {
  const errors = watchConsole(page);

  await authenticateAndNavigate(page, auth, '/dashboard/inbox');

  expect(page.url(), 'bounced to login — the session was rejected').not.toContain('/login');
  await expect(page.getByRole('heading', { name: /inbox/i }).first()).toBeVisible({
    timeout: 30_000,
  });

  // The load-bearing assertion. The subject was minted seconds ago by this
  // run's fixture, so it is not in the bundle and not left over from an
  // earlier run — it can only be here because the browser's own authenticated
  // GET /tickets returned the row. The inbox orders by lastMessageAt desc, so
  // the freshest ticket is on the first page however full the account is.
  await expect(
    page.getByText(auth.ticketSubject),
    'this run ticket never rendered — the authenticated GET /tickets failed in the browser',
  ).toBeVisible({ timeout: 30_000 });

  expect(errors, `console errors on /dashboard/inbox:\n${errors.join('\n')}`).toEqual([]);
});
