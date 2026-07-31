import { Router } from 'express';
import { sendOk, sendErr } from '../lib/http.js';
import { collectSystemHealth, httpCheck } from '../lib/system-health.js';
import { plugipayConfigured } from '../lib/plugipay.js';
import { twilioConfigured } from '../lib/twilio.js';

/*
 * GET /api/v1/admin/system-health — suppuo's operator health view.
 *
 * Mounted behind `adminGuard`; powers `SystemHealthPanel`. Mandatory
 * admin-portal standard.
 *
 * Distinct from the unauthenticated `/health` liveness probe, which
 * answers "is this process up" for a load balancer. This one reaches the
 * database and every configured integration, so it is authenticated (it
 * reveals dependency topology) and must not be polled hard — the panel
 * defaults to 30s.
 *
 * An UNCONFIGURED integration returns `null`, which reports as 'skipped'
 * rather than being omitted. For a helpdesk that matters more than most:
 * "we do not have WhatsApp wired up" and "WhatsApp is healthy" are the
 * difference between tickets quietly not arriving and tickets arriving.
 */

const router = Router();

function familyProbe(key: string, label: string, base: string | undefined, configured: boolean) {
  return async () => {
    if (!configured || !base) return null;
    const out = await httpCheck(`${base.replace(/\/$/, '')}/health`)();
    return { key, label, status: out.status ?? ('ok' as const), detail: out.detail ?? null };
  };
}

/** Credential-only check: a channel with no credentials cannot receive.
 *  We do NOT call the provider here — an outbound API call per health poll
 *  would burn quota on Twilio/Meta for no operational gain. */
function channelProbe(key: string, label: string, configured: boolean) {
  return async () =>
    configured
      ? { key, label, status: 'ok' as const, detail: 'credentials present' }
      : null;
}

router.get('/', async (req, res) => {
  try {
    return sendOk(
      res,
      req,
      await collectSystemHealth({
        plugipay: familyProbe(
          'plugipay',
          'Plugipay (billing)',
          process.env.PLUGIPAY_BASE_URL,
          plugipayConfigured(),
        ),
        twilio: channelProbe('twilio', 'Twilio (SMS/WhatsApp channel)', twilioConfigured()),
      }),
    );
  } catch (e) {
    return sendErr(res, req, 500, 'HEALTH_COLLECT_FAILED', (e as Error).message);
  }
});

export default router;
