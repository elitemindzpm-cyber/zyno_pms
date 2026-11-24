// server/lib/config.ts
// Required secrets. The server refuses to start without them: there are no built-in fallbacks.
const MIN_SECRET_LENGTH = 32;
const KNOWN_WEAK = new Set(['secret', 'changeme', 'pms_jwt_secret_key_change_in_production']);

/** Returns the JWT signing secret from the environment, or throws if it is missing or weak. */
export function jwtSecret(): string {
  const s = process.env.JWT_SECRET ?? '';
  if (s.length < MIN_SECRET_LENGTH || KNOWN_WEAK.has(s)) {
    throw new Error(
      `JWT_SECRET is missing or too weak. Set JWT_SECRET in .env to at least ${MIN_SECRET_LENGTH} random characters.`,
    );
  }
  return s;
}

/** Checks required configuration. Call once at startup so a bad setup fails immediately. */
export function assertRequiredConfig(): void {
  jwtSecret();
}
