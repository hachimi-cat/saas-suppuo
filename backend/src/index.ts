import { createApp } from './app.js';
import { registerFeatureFlags } from './lib/feature-flag-registry.js';
import { startOutboxWorker } from './services/outbox-worker.js';
import { startWebhookDeliveryWorker } from './services/webhook-delivery.js';

const app = createApp();

const port = Number(process.env.PORT ?? 4170);
app.listen(port, () => {
  console.log(`[api] ${process.env.FORJIO_SERVICE ?? 'suppuo'} listening on ${port}`);
});

// Declare this product's feature flags at BOOT, not from the admin page.
// Registering them only when someone opens /admin/feature-flags means the
// row exists in no database until then — and `isEnabled` fails closed on a
// missing row, so a staged flag gates nothing for exactly the accounts it
// was allowlisted for. Idempotent: seeds enabled/rollout/allowlist on
// CREATE only, so a redeploy never re-enables something turned off during
// an incident.
registerFeatureFlags().catch((err) =>
  console.error('[feature-flags] boot registration failed:', err),
);

// The outbox worker (team notifications, inbox email, auto-response, CSAT,
// and queueing webhook deliveries) and the webhook delivery worker (sending,
// retrying and logging them) run INSIDE this API process — production runs
// exactly this file (`pm2 start dist/index.js`). There is no separate worker
// entrypoint: setting OUTBOX_WORKER_ENABLED=false stops all of the above.
// Tests (`NODE_ENV=test`) keep both off so stray deliveries don't leak.
const outboxDefaultOff = process.env.NODE_ENV === 'test';
const outboxEnabled = process.env.OUTBOX_WORKER_ENABLED
  ? process.env.OUTBOX_WORKER_ENABLED !== 'false'
  : !outboxDefaultOff;
if (outboxEnabled) {
  startOutboxWorker().catch((e) => {
    console.error('[outbox] fatal', e);
    process.exit(1);
  });
  startWebhookDeliveryWorker().catch((e) => {
    console.error('[webhooks] fatal', e);
    process.exit(1);
  });
}
