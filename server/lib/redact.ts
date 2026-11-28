// server/lib/redact.ts
// Removes credential material from anything the generic /api/db proxy sends back, so password hashes
// (stored in users.raw_user_meta_data) never reach a browser, including through relation includes.

const SECRET_KEYS = new Set(['password_hash', 'encrypted_password', 'password', 'passwordhash', 'reset_token', 'refresh_token']);

function scrubMetaString(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return JSON.stringify(scrubSecrets(parsed));
    return raw;
  } catch {
    // Not valid JSON: it cannot be inspected safely, so do not return it.
    return '{}';
  }
}

export function scrubSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => scrubSecrets(v)) as unknown as T;
  // Objects that know how to serialise themselves (Prisma Decimal, Date, ...) must be left alone: rebuilding them
  // as plain objects would expose their internals ({ s, e, d }) instead of the value.
  if (value && typeof value === 'object' && typeof (value as any).toJSON === 'function') return value;
  if (value && typeof value === 'object' && !(typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (SECRET_KEYS.has(k.toLowerCase())) continue;
      if (k === 'raw_user_meta_data' || k === 'raw_app_meta_data') {
        out[k] = typeof v === 'string' ? scrubMetaString(v) : scrubSecrets(v);
        continue;
      }
      out[k] = scrubSecrets(v);
    }
    return out as T;
  }
  return value;
}
