'use client';

/*
 * Business metrics — MANDATORY admin-portal standard.
 * See forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
 * Body from @forjio/admin-ui; data from suppuo's adapter under
 * backend/src/routes/admin-*.ts.
 */

import { BusinessMetricsPanel } from '@forjio/admin-ui';
import { SUPPUO_ADMIN_ENDPOINTS } from '@/lib/admin-endpoints';

export default function Page() {
  return <BusinessMetricsPanel endpoint={SUPPUO_ADMIN_ENDPOINTS.metrics} />;
}
