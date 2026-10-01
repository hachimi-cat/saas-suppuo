# Changelog

## 0.4.0
- Webhook deliveries are retried and logged. `client.api.webhook_subscriptions_deliveries(subscription_id=, status=, type_=, limit=, cursor=)` lists them (newest first, with every attempt), `webhook_subscriptions_get_deliveries(id_)` reads one, `webhook_subscriptions_deliveries_retry(id_)` sends one again (202; 409 when it is queued or its subscription is off), and `webhook_subscriptions_event_types()` returns the event catalogue.
- `webhook_subscriptions_update(id_, url=, events=, active=)` changes the URL and the events too (it only took `active`); `active=True` re-enables a subscription Suppuo switched off for failing. Subscriptions carry `consecutiveFailures`, `failingSince`, `disabledAt`, `disabledReason`.
- `events` takes prefixes (`suppuo.ticket.*`). New event type `suppuo.webhook_subscription.disabled.v1`; a requester-portal reply is now `suppuo.ticket.replied.v1` (`by: "requester"`) like every other requester follow-up (it was the undocumented `suppuo.ticket.message.created.v1`).
- Deliveries carry `Suppuo-Event-Id`, `Suppuo-Event-Type`, `Suppuo-Delivery-Id` and `Suppuo-Delivery-Attempt` next to `Suppuo-Signature` (unchanged).

## 0.3.0
- A route read by id next to its list is named `get` + the list's name: `client.api.help_get_articles` (was `client.api.help_articles_2`), `client.api.requester_get_tickets` (was `client.api.requester_tickets_2`). Each old name stays as a deprecated alias.

