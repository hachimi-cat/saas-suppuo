'use client';

/*
 * Channels — where customer conversations come from. Always-on
 * channels (hosted form, manual logging), platform-provided ones
 * (email, WhatsApp when the shared number is live), and BYO provider
 * integrations (your own Twilio / Resend) per workspace.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, Globe, Hash, Mail, MessageCircle, MessageSquare, PenLine, Plug, Send, Trash2 } from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';

interface Integration {
  id: string;
  provider: string;
  externalId: string | null;
  displayName: string;
  status: string;
  lastError: string | null;
}

interface ChannelsPayload {
  integrations: Integration[];
  platform: { whatsapp: boolean; email: boolean };
}

export default function ChannelsPage() {
  const [data, setData] = useState<ChannelsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<
    | 'whatsapp_twilio'
    | 'whatsapp_cloud'
    | 'email_resend'
    | 'telegram_bot'
    | 'slack_webhook'
    | 'discord_webhook'
    | null
  >(null);
  const [webhookNote, setWebhookNote] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cloudSetup, setCloudSetup] = useState<{ webhookUrl: string; verifyToken: string } | null>(
    null,
  );

  const load = useCallback(() => {
    apiRequest<ChannelsPayload>('/channels')
      .then(({ data }) => setData(data))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : 'Could not load channels'));
  }, []);

  useEffect(() => {
    load();
    apiRequest<{ accountId: string }>('/me')
      .then(({ data }) => setAccountId(data.accountId))
      .catch(() => setAccountId(null));
  }, [load]);

  async function remove(id: string) {
    if (!confirm('Disconnect this integration?')) return;
    await apiRequest(`/channels/${id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  const byo = (provider: string) =>
    data?.integrations.filter((i) => i.provider === provider) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Channels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where your customers reach you. Bring your own provider accounts for unlimited
          volume and your own branding.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}
      {webhookNote && (
        <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Last step — point your Twilio number at Suppuo:</p>
          <code className="mt-1 block break-all rounded bg-muted/40 px-2 py-1 text-xs">{webhookNote}</code>
          <p className="mt-1 text-xs text-muted-foreground">
            Twilio Console → your WhatsApp number → Messaging → &quot;A message comes in&quot; →
            Webhook (POST).
          </p>
        </div>
      )}
      {cloudSetup && (
        <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Last step — subscribe your Meta app to this webhook:</p>
          <p className="mt-2 text-xs text-muted-foreground">Callback URL</p>
          <code className="block break-all rounded bg-muted/40 px-2 py-1 text-xs">{cloudSetup.webhookUrl}</code>
          <p className="mt-2 text-xs text-muted-foreground">Verify token (save this — shown once)</p>
          <code className="block break-all rounded bg-muted/40 px-2 py-1 text-xs">{cloudSetup.verifyToken}</code>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
            <li>Meta App dashboard → WhatsApp → Configuration → Webhook → Edit.</li>
            <li>Paste the Callback URL and Verify token above, then Verify and save.</li>
            <li>Under Webhook fields, subscribe to <code>messages</code>.</li>
          </ol>
        </div>
      )}

      <div className="space-y-8">
        <ChannelSection
          title="Customer conversations"
          blurb="Two-way channels: incoming messages open or update tickets, and replies from the inbox go back out on the same channel."
        >
        {/* Live chat widget */}
        <ChannelCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Live chat widget"
          status="active"
          statusLabel="Always on"
          description="An embeddable chat bubble for your site — visitor messages open tickets in this inbox, and your replies show up right in the widget (and by email)."
        >
          <WidgetEmbed accountId={accountId} />
        </ChannelCard>

        {/* Email-to-ticket (Resend inbound) */}
        <ChannelCard
          icon={<Mail className="h-5 w-5" />}
          title="Email-to-ticket (inbound)"
          status="active"
          statusLabel="Always on"
          description="Your workspace has a dedicated inbound address — forward your support@ to it and every email becomes a ticket. Replies from the inbox go back by email, and the customer's email replies thread right back in."
        >
          {accountId && (
            <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
              {accountId}@in.suppuo.com
            </div>
          )}
        </ChannelCard>

        {/* WhatsApp via your Twilio */}
        <ChannelCard
          icon={<MessageCircle className="h-5 w-5" />}
          title="WhatsApp (beta)"
          status={byo('whatsapp_twilio').length > 0 ? 'active' : 'pending'}
          statusLabel={byo('whatsapp_twilio').length > 0 ? 'Connected' : 'Not connected'}
          description="Bring your own Twilio account + WhatsApp number: inbound messages become tickets, agent replies go back over WhatsApp — your number, unlimited messages. (A shared platform number for paid tiers is coming.)"
          action={
            <button onClick={() => setShowForm('whatsapp_twilio')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
              <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect your Twilio
            </button>
          }
        >
          {byo('whatsapp_twilio').map((i) => (
            <IntegrationRow key={i.id} i={i} onRemove={() => remove(i.id)} />
          ))}
        </ChannelCard>

        {/* WhatsApp Cloud API (Meta direct) */}
        <ChannelCard
          icon={<MessageCircle className="h-5 w-5" />}
          title="WhatsApp Cloud API (Meta direct)"
          status={byo('whatsapp_cloud').length > 0 ? 'active' : 'pending'}
          statusLabel={byo('whatsapp_cloud').length > 0 ? 'BYO Meta connected' : 'Not connected'}
          description="Connect a Meta WhatsApp Business account directly — no Twilio in between. Inbound messages become tickets; agent replies go out via the Cloud API."
          action={
            <button onClick={() => setShowForm('whatsapp_cloud')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
              <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect Meta direct
            </button>
          }
        >
          {byo('whatsapp_cloud').map((i) => (
            <IntegrationRow key={i.id} i={i} onRemove={() => remove(i.id)} />
          ))}
        </ChannelCard>

        {/* Telegram */}
        <ChannelCard
          icon={<Send className="h-5 w-5" />}
          title="Telegram bot"
          status={byo('telegram_bot').length > 0 ? 'active' : 'pending'}
          statusLabel={byo('telegram_bot').length > 0 ? 'Bot connected' : 'Not connected'}
          description="Messages to your Telegram bot become tickets; agent replies go back to the chat. Create a bot with @BotFather and paste its token — the webhook is registered automatically."
          action={
            <button onClick={() => setShowForm('telegram_bot')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
              <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect your bot
            </button>
          }
        >
          {byo('telegram_bot').map((i) => (
            <IntegrationRow key={i.id} i={i} onRemove={() => remove(i.id)} />
          ))}
        </ChannelCard>
        </ChannelSection>

        <ChannelSection
          title="Outbound email"
          blurb="How requesters receive ticket updates — the platform sender, or your own domain."
        >
        <ChannelCard
          icon={<Mail className="h-5 w-5" />}
          title="Email notifications"
          status={data?.platform.email ? 'active' : 'pending'}
          statusLabel={data?.platform.email ? 'Platform (suppuo.forjio.com)' : 'Not configured'}
          description="Outbound ticket updates to requesters. Bring your own Resend account to send from your own domain."
          action={
            <button onClick={() => setShowForm('email_resend')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
              <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect your Resend
            </button>
          }
        >
          {byo('email_resend').map((i) => (
            <IntegrationRow key={i.id} i={i} onRemove={() => remove(i.id)} />
          ))}
        </ChannelCard>
        </ChannelSection>

        <ChannelSection
          title="Team notifications"
          blurb="Pings for your own team when tickets arrive or customers reply — these never message customers."
        >
        {/* Slack — team notifications */}
        <ChannelCard
          icon={<Hash className="h-5 w-5" />}
          title="Slack notifications"
          status={byo('slack_webhook').length > 0 ? 'active' : 'pending'}
          statusLabel={byo('slack_webhook').length > 0 ? 'Connected' : 'Not connected'}
          description="Get a Slack message when a ticket is opened or a customer replies. Paste an incoming-webhook URL — we post a test message to verify it."
          action={
            <button onClick={() => setShowForm('slack_webhook')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
              <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect Slack
            </button>
          }
        >
          {byo('slack_webhook').map((i) => (
            <IntegrationRow key={i.id} i={i} onRemove={() => remove(i.id)} />
          ))}
        </ChannelCard>

        {/* Discord — team notifications */}
        <ChannelCard
          icon={<Bell className="h-5 w-5" />}
          title="Discord notifications"
          status={byo('discord_webhook').length > 0 ? 'active' : 'pending'}
          statusLabel={byo('discord_webhook').length > 0 ? 'Connected' : 'Not connected'}
          description="Get a Discord message when a ticket is opened or a customer replies. Paste a channel webhook URL (Server Settings → Integrations → Webhooks)."
          action={
            <button onClick={() => setShowForm('discord_webhook')} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
              <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect Discord
            </button>
          }
        >
          {byo('discord_webhook').map((i) => (
            <IntegrationRow key={i.id} i={i} onRemove={() => remove(i.id)} />
          ))}
        </ChannelCard>
        </ChannelSection>

        <ChannelSection title="Built-in" blurb="Always available — nothing to configure.">
        <ChannelCard
          icon={<Globe className="h-5 w-5" />}
          title="Hosted support form"
          status="active"
          statusLabel="Always on"
          description="Customers submit tickets at your form URL (see Settings). Replies go out by email with a status link."
        />
        <ChannelCard
          icon={<PenLine className="h-5 w-5" />}
          title="Manual logging"
          status="active"
          statusLabel="Always on"
          description="Log requests that arrive anywhere else (phone, DM, walk-in) with the New ticket button — the customer still gets the status link."
        />
        </ChannelSection>
      </div>

      {showForm === 'whatsapp_twilio' && (
        <ConnectTwilioDialog
          onClose={() => setShowForm(null)}
          onDone={(note) => {
            setShowForm(null);
            setWebhookNote(note);
            load();
          }}
        />
      )}
      {showForm === 'whatsapp_cloud' && (
        <ConnectWhatsAppCloudDialog
          onClose={() => setShowForm(null)}
          onDone={(setup) => {
            setShowForm(null);
            setCloudSetup(setup);
            load();
          }}
        />
      )}
      {showForm === 'email_resend' && (
        <ConnectResendDialog
          onClose={() => setShowForm(null)}
          onDone={() => {
            setShowForm(null);
            load();
          }}
        />
      )}
      {showForm === 'telegram_bot' && (
        <ConnectTelegramDialog
          onClose={() => setShowForm(null)}
          onDone={() => {
            setShowForm(null);
            load();
          }}
        />
      )}
      {(showForm === 'slack_webhook' || showForm === 'discord_webhook') && (
        <ConnectWebhookDialog
          provider={showForm}
          onClose={() => setShowForm(null)}
          onDone={() => {
            setShowForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function WidgetEmbed({ accountId }: { accountId: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!accountId) {
    return <p className="mt-3 text-sm text-muted-foreground">Loading your embed snippet…</p>;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://suppuo.com';
  const snippet = `<script src="${origin}/widget.js" data-suppuo-account="${accountId}" async></script>`;
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground">
        Paste this just before <code>&lt;/body&gt;</code> on any page:
      </p>
      <div className="mt-2 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          {snippet}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <a
        href={`/widget-demo?account=${accountId}`}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
      >
        Preview the widget →
      </a>
    </div>
  );
}

function ChannelSection({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground/80">{blurb}</p>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function ChannelCard({
  icon,
  title,
  status,
  statusLabel,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: 'active' | 'pending' | 'soon' | string;
  statusLabel: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const tone =
    status === 'active'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
      : status === 'pending'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
        : 'border-border bg-muted text-muted-foreground';
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-primary">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
          {statusLabel}
        </span>
        <span className="ml-auto">{action}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function IntegrationRow({ i, onRemove }: { i: Integration; onRemove: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">
        {i.displayName}
        {i.externalId && <span className="ml-2 text-xs text-muted-foreground">{i.externalId}</span>}
      </span>
      <span className={`text-xs capitalize ${i.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
        {i.status}
      </span>
      <button onClick={onRemove} className="text-destructive hover:opacity-70" aria-label="Disconnect">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ConnectTwilioDialog({ onClose, onDone }: { onClose: () => void; onDone: (note: string) => void }) {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiRequest<{ webhookUrl: string }>('/channels', {
        method: 'POST',
        body: { provider: 'whatsapp_twilio', accountSid, authToken, whatsappNumber: number },
      });
      onDone(data.webhookUrl);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not connect');
      setBusy(false);
    }
  }

  return (
    <Dialog title="Connect your Twilio (WhatsApp)" onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        Credentials are verified live against Twilio, then stored encrypted. Your number,
        your message limits.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input required value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="Account SID (AC…)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input required type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Auth token" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input required value={number} onChange={(e) => setNumber(e.target.value)} placeholder="WhatsApp number (+62…)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Verifying…' : 'Connect'}
        </button>
      </form>
    </Dialog>
  );
}

function ConnectWhatsAppCloudDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (setup: { webhookUrl: string; verifyToken: string }) => void;
}) {
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [displayNumber, setDisplayNumber] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiRequest<{ webhookUrl: string; verifyToken: string }>('/channels', {
        method: 'POST',
        body: {
          provider: 'whatsapp_cloud',
          accessToken,
          phoneNumberId,
          displayNumber,
          appSecret: appSecret || undefined,
        },
      });
      onDone({ webhookUrl: data.webhookUrl, verifyToken: data.verifyToken });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not connect');
      setBusy(false);
    }
  }

  return (
    <Dialog title="Connect WhatsApp Cloud API (Meta direct)" onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        From your Meta App dashboard (WhatsApp → API Setup): a permanent access token and the
        Phone number ID. Credentials are verified live against Meta, then stored encrypted.
        You&apos;ll get a webhook URL + verify token to finish setup.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input required type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Access token (EAA…)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input required value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Phone number ID (digits)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input required value={displayNumber} onChange={(e) => setDisplayNumber(e.target.value)} placeholder="WhatsApp number (+62…)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="App secret (optional — enables signature checks)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Verifying…' : 'Connect'}
        </button>
      </form>
    </Dialog>
  );
}

function ConnectResendDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/channels', {
        method: 'POST',
        body: { provider: 'email_resend', apiKey, fromEmail, fromName: fromName || undefined },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not connect');
      setBusy(false);
    }
  }

  return (
    <Dialog title="Connect your Resend (email)" onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        Requester notifications will send from your own verified domain via your Resend
        account.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input required type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Resend API key (re_…)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input required type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="From email (support@yourdomain.com)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="From name (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Verifying…' : 'Connect'}
        </button>
      </form>
    </Dialog>
  );
}

function ConnectTelegramDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [botToken, setBotToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/channels', {
        method: 'POST',
        body: { provider: 'telegram_bot', botToken },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not connect');
      setBusy(false);
    }
  }

  return (
    <Dialog title="Connect your Telegram bot" onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        Create a bot with @BotFather and paste its token. We verify it live, store it
        encrypted, and register the inbound webhook for you — no manual setup.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input required type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Bot token (123456789:AA…)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Verifying…' : 'Connect'}
        </button>
      </form>
    </Dialog>
  );
}

function ConnectWebhookDialog({
  provider,
  onClose,
  onDone,
}: {
  provider: 'slack_webhook' | 'discord_webhook';
  onClose: () => void;
  onDone: () => void;
}) {
  const isSlack = provider === 'slack_webhook';
  const [webhookUrl, setWebhookUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/channels', {
        method: 'POST',
        body: { provider, webhookUrl },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not connect');
      setBusy(false);
    }
  }

  return (
    <Dialog title={isSlack ? 'Connect Slack notifications' : 'Connect Discord notifications'} onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        {isSlack
          ? 'Slack → your channel → Add an app → Incoming Webhooks → copy the webhook URL. We post a "connected ✓" test message to verify it, then store it encrypted.'
          : 'Discord → Server Settings → Integrations → Webhooks → copy the webhook URL. We post a "connected ✓" test message to verify it, then store it encrypted.'}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input required type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder={isSlack ? 'https://hooks.slack.com/services/…' : 'https://discord.com/api/webhooks/…'} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Sending test message…' : 'Connect'}
        </button>
      </form>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
