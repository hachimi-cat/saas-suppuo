# Changelog

## 0.5.0
- Webhook deliveries are retried and logged. `client.API.WebhookSubscriptionsDeliveries(ctx, &WebhookSubscriptionsDeliveriesArgs{…})` lists them (newest first, with every attempt), `WebhookSubscriptionsGetDeliveries(ctx, id)` reads one, `WebhookSubscriptionsDeliveriesRetry(ctx, id)` sends one again (202; 409 when it is queued or its subscription is off), and `WebhookSubscriptionsEventTypes(ctx)` returns the event catalogue.
- `WebhookSubscriptionsUpdate` takes `URL` and `Events` too (it only took `Active`); `Active: true` re-enables a subscription Suppuo switched off for failing.
- `events` takes prefixes (`suppuo.ticket.*`). New event type `suppuo.webhook_subscription.disabled.v1`; a requester-portal reply is now `suppuo.ticket.replied.v1` (`by: "requester"`).

## 0.4.0
- A route read by id next to its list is named `get` + the list's name: `client.API.HelpGetArticles` (was `client.API.HelpArticles2`), `client.API.RequesterGetTickets` (was `client.API.RequesterTickets2`). Each old name stays as a deprecated alias.

