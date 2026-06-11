import crypto from 'node:crypto';

// Channel-credential encryption — AES-256-GCM with SUPPUO_CHANNEL_KEY
// (32-byte hex). The whole credentials object is JSON-encoded then
// encrypted; format: <iv hex>.<tag hex>.<ciphertext hex>. Mirrors
// ripllo's channel-crypto.

function key(): Buffer {
  const raw = process.env.SUPPUO_CHANNEL_KEY;
  if (!raw) throw new Error('SUPPUO_CHANNEL_KEY env var required for channel credentials');
  return Buffer.from(raw, 'hex');
}

export function encryptCredentials(obj: Record<string, unknown>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${ct.toString('hex')}`;
}

export function decryptCredentials<T = Record<string, string>>(blob: string): T {
  const [ivH, tagH, ctH] = blob.split('.');
  if (!ivH || !tagH || !ctH) throw new Error('malformed credential blob');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivH, 'hex'));
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctH, 'hex')), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}
