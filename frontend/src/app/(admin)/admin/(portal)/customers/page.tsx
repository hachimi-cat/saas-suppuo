'use client';

/*
 * Customers — MANDATORY admin-portal standard.
 * See forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
 *
 * Body from @forjio/admin-ui; data from suppuo's adapter in
 * backend/src/routes/admin-customers.ts, which joins the Huudis SSO
 * roster against suppuo's own ticket and CSAT tables.
 *
 * This replaced a hand-rolled page that rendered the raw Huudis roster.
 * The shared panel is a level UP: it keeps the search, badges and
 * relative times, and adds the per-product columns (tickets, open, CSAT,
 * last ticket) the adapter now supplies.
 */

import { CustomersPanel } from '@forjio/admin-ui';

export default function Page() {
  return <CustomersPanel />;
}
