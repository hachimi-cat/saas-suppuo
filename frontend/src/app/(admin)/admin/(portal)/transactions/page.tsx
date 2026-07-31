'use client';

/*
 * Transactions — MANDATORY admin-portal standard.
 * See forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
 *
 * Body from @forjio/admin-ui; data from suppuo's adapter in
 * backend/src/routes/admin-transactions.ts, which itemises exactly the rows the
 * Business metrics tile counts.
 */

import { TransactionsPanel } from '@forjio/admin-ui';
import { SUPPUO_ADMIN_ENDPOINTS } from '@/lib/admin-endpoints';

export default function Page() {
  return <TransactionsPanel endpoint={SUPPUO_ADMIN_ENDPOINTS.transactions} />;
}
