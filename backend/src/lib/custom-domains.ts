import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import http from 'node:http';
import { prisma } from './db.js';
import { newId } from './ids.js';
import { ApiError } from './http.js';

/*
 * Custom domains — a workspace maps its own domain (e.g. help.plugipay.com)
 * to its hosted help center + portal. Ported from storlaunch's
 * domain-service, adapted to Suppuo: Suppuo is self-hosted on its own box,
 * so the customer CNAMEs their domain → suppuo.com (→ the box) and the
 * provisioner runs ON the Suppuo box (certbot + its own nginx). Flow:
 * add → DNS-verify (CNAME + TXT token) → VERIFYING → provisioner gets the
 * cert + nginx vhost → callback → ACTIVE. The frontend middleware resolves
 * Host → accountId for ACTIVE domains.
 */

const CNAME_TARGET = process.env.SUPPUO_CNAME_TARGET || 'suppuo.com';
const VERIFICATION_PREFIX = 'suppuo-verify-';
const TXT_HOST = (domain: string) => `_suppuo-verify.${domain}`;

const PROVISIONER_URL = process.env.PROVISIONER_URL || 'http://127.0.0.1:9520';
const PROVISION_SECRET = process.env.PROVISION_SECRET || '';
const PUBLIC_URL = process.env.SUPPUO_PUBLIC_URL || 'https://suppuo.com';

const DEFAULT_HOSTNAMES = new Set([
  'suppuo.com',
  'www.suppuo.com',
  'suppuo.forjio.com',
  'localhost',
  'staging-suppuo',
  'staging-suppuo.forjio.com',
]);

// Fallback to public resolvers if the box's resolver can't see the record.
const fallbackResolver = new dns.Resolver();
fallbackResolver.setServers(['8.8.8.8', '1.1.1.1']);
async function resolveCname(host: string): Promise<string[]> {
  try {
    return await dns.resolveCname(host);
  } catch {
    return await fallbackResolver.resolveCname(host);
  }
}
async function resolveTxt(host: string): Promise<string[][]> {
  try {
    return await dns.resolveTxt(host);
  } catch {
    return await fallbackResolver.resolveTxt(host);
  }
}

// ── Host → account resolution (for the frontend middleware), 5-min TTL ──
interface HostEntry {
  accountId: string;
  at: number;
}
const hostCache = new Map<string, HostEntry>();
const HOST_TTL = 300_000;

export function isDefaultHostname(host: string): boolean {
  return DEFAULT_HOSTNAMES.has(host.replace(/:\d+$/, '').toLowerCase());
}

export async function resolveHostToAccount(host: string): Promise<string | null> {
  const clean = host.replace(/:\d+$/, '').toLowerCase();
  if (isDefaultHostname(clean)) return null;
  const cached = hostCache.get(clean);
  if (cached && Date.now() - cached.at < HOST_TTL) return cached.accountId;
  const row = await prisma.customDomain.findFirst({
    where: { domain: clean, status: 'ACTIVE' },
    select: { accountId: true },
  });
  if (row) {
    hostCache.set(clean, { accountId: row.accountId, at: Date.now() });
    return row.accountId;
  }
  return null;
}

function invalidateHost(domain: string): void {
  hostCache.delete(domain.toLowerCase());
}

// ── Validation ──
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
function validateDomain(raw: string): string {
  const clean = raw.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!DOMAIN_RE.test(clean)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid domain. Example: help.yourbrand.com');
  }
  if (isDefaultHostname(clean) || clean.endsWith('.suppuo.com')) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Cannot use a Suppuo domain');
  }
  return clean;
}

function dnsInstructions(domain: string, token: string) {
  return {
    cname: { host: domain, target: CNAME_TARGET },
    txt: { host: TXT_HOST(domain), value: token },
  };
}

interface DomainRow {
  id: string;
  domain: string;
  status: string;
  verificationToken: string;
  sslProvisioned: boolean;
  createdAt: Date;
}
function view(d: DomainRow) {
  return {
    id: d.id,
    domain: d.domain,
    status: d.status.toLowerCase(),
    sslProvisioned: d.sslProvisioned,
    createdAt: d.createdAt,
    dnsInstructions: dnsInstructions(d.domain, d.verificationToken),
  };
}

// ── CRUD ──
const MAX_DOMAINS_PER_ACCOUNT = 5;

export async function addDomain(accountId: string, rawDomain: string) {
  const domain = validateDomain(rawDomain);
  if ((await prisma.customDomain.count({ where: { accountId } })) >= MAX_DOMAINS_PER_ACCOUNT) {
    throw new ApiError(403, 'FORBIDDEN', `Up to ${MAX_DOMAINS_PER_ACCOUNT} custom domains per workspace`);
  }
  if (await prisma.customDomain.findUnique({ where: { domain } })) {
    throw new ApiError(409, 'CONFLICT', `'${domain}' is already registered`);
  }
  const verificationToken = `${VERIFICATION_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
  const d = await prisma.customDomain.create({
    data: { id: newId('cdm'), domain, accountId, verificationToken },
  });
  return view(d);
}

export async function listDomains(accountId: string) {
  const rows = await prisma.customDomain.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(view);
}

export async function verifyDomain(id: string, accountId: string) {
  const d = await prisma.customDomain.findFirst({ where: { id, accountId } });
  if (!d) throw new ApiError(404, 'NOT_FOUND', 'Domain not found');
  if (d.status === 'ACTIVE') return view(d);

  let cnameOk = false;
  try {
    cnameOk = (await resolveCname(d.domain)).some((r) => r.toLowerCase().replace(/\.$/, '') === CNAME_TARGET);
  } catch {
    /* not found */
  }
  if (!cnameOk) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      `CNAME not found yet. Add: ${d.domain} CNAME ${CNAME_TARGET} (DNS can take up to 48h).`,
    );
  }

  let txtOk = false;
  try {
    txtOk = (await resolveTxt(TXT_HOST(d.domain))).flat().some((r) => r === d.verificationToken);
  } catch {
    /* not found */
  }
  if (!txtOk) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      `TXT not found yet. Add: ${TXT_HOST(d.domain)} TXT ${d.verificationToken}`,
    );
  }

  await prisma.customDomain.update({ where: { id: d.id }, data: { status: 'VERIFYING' } });
  triggerProvisioning(d.domain, 'add');
  return view({ ...d, status: 'VERIFYING' });
}

export async function removeDomain(id: string, accountId: string) {
  const d = await prisma.customDomain.findFirst({ where: { id, accountId } });
  if (!d) throw new ApiError(404, 'NOT_FOUND', 'Domain not found');
  await prisma.customDomain.delete({ where: { id: d.id } });
  invalidateHost(d.domain);
  if (d.status === 'ACTIVE' || d.status === 'VERIFYING') triggerProvisioning(d.domain, 'remove');
  return { id: d.id, domain: d.domain, deleted: true };
}

// ── Provisioner callback (called by the provisioner on the box) ──
export async function activateDomain(domain: string): Promise<void> {
  const d = await prisma.customDomain.findUnique({ where: { domain } });
  if (!d) return;
  await prisma.customDomain.update({
    where: { id: d.id },
    data: { status: 'ACTIVE', sslProvisioned: true },
  });
  invalidateHost(domain);
}
export async function failDomain(domain: string): Promise<void> {
  const d = await prisma.customDomain.findUnique({ where: { domain } });
  if (!d) return;
  await prisma.customDomain.update({ where: { id: d.id }, data: { status: 'FAILED' } });
}

export function provisionSecretOk(secret: string | undefined): boolean {
  return Boolean(PROVISION_SECRET) && secret === PROVISION_SECRET;
}

// Fire-and-forget call to the on-box provisioner.
function triggerProvisioning(domain: string, action: 'add' | 'remove'): void {
  const callbackUrl = `${PUBLIC_URL}/api/v1/public/domains/provision-callback`;
  const payload = JSON.stringify({ domain, action, callbackUrl });
  const url = new URL('/provision', PROVISIONER_URL);
  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-provision-secret': PROVISION_SECRET,
      },
      timeout: 5000,
    },
    (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => console.log(`[domains] provisioner ${domain}: ${res.statusCode} ${body.slice(0, 200)}`));
    },
  );
  req.on('error', (e) => console.error(`[domains] provisioner failed for ${domain}:`, e.message));
  req.write(payload);
  req.end();
}
