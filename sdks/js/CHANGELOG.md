# Changelog

## 0.4.0
- Webhook deliveries are retried and logged. `client.api.webhookSubscriptionsDeliveries({ subscriptionId?, status?, type?, limit?, cursor? })` lists them (newest first, with every attempt), `webhookSubscriptionsGetDeliveries(id)` reads one, `webhookSubscriptionsDeliveriesRetry(id)` sends one again (202; 409 when it is queued or its subscription is off), and `webhookSubscriptionsEventTypes()` returns the event catalogue.
- `webhookSubscriptionsUpdate(id, { url?, events?, active? })` changes the URL and the events too (it only took `active`); `active: true` re-enables a subscription Suppuo switched off for failing. Subscriptions carry `consecutiveFailures`, `failingSince`, `disabledAt`, `disabledReason`.
- `events` takes prefixes (`suppuo.ticket.*`). New event types: `suppuo.webhook_subscription.disabled.v1`; a requester-portal reply is now `suppuo.ticket.replied.v1` (`by: "requester"`) like every other requester follow-up (it was the undocumented `suppuo.ticket.message.created.v1`).
- Deliveries carry `Suppuo-Event-Id`, `Suppuo-Event-Type`, `Suppuo-Delivery-Id` and `Suppuo-Delivery-Attempt` next to `Suppuo-Signature` (unchanged).

## 0.3.0
- A route read by id next to its list is named `get` + the list's name: `client.api.helpGetArticles` (was `client.api.helpArticles2`), `client.api.requesterGetTickets` (was `client.api.requesterTickets2`). Each old name stays as a deprecated alias.

