import { randomBytes } from 'crypto';

// Crockford-style alphabet with ambiguous characters (0/O, 1/I/L) removed,
// so a human reading a code off a package can't misread it.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUP_LENGTH = 4;
const GROUP_COUNT = 4; // 16 random chars total => 16 * log2(32) = 80 bits of entropy

/**
 * Generates an unpredictable, non-sequential public verification token, e.g.
 * "CPDS-8F7K-X29P-4LMQ-7TZ1". Uses crypto.randomBytes (CSPRNG), never Math.random.
 * The token encodes nothing about the database ID, manufacturer, or record order.
 */
export function generateVerificationToken(): string {
  const bytes = randomBytes(GROUP_LENGTH * GROUP_COUNT);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    groups.push(out.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH));
  }
  return ['CPDS', ...groups].join('-');
}

/** Normalizes user/scanner input before it's compared against stored tokens. */
export function normalizeToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
