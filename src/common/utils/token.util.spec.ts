import { generateVerificationToken, normalizeToken } from './token.util';

describe('generateVerificationToken', () => {
  it('matches the CPDS-XXXX-XXXX-XXXX-XXXX shape', () => {
    expect(generateVerificationToken()).toMatch(/^CPDS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('excludes visually ambiguous characters (0, O, 1, I, L)', () => {
    const token = generateVerificationToken();
    expect(token).not.toMatch(/[0OIL1]/);
  });

  it('is not sequential/predictable across many calls', () => {
    const tokens = Array.from({ length: 500 }, () => generateVerificationToken());
    expect(new Set(tokens).size).toBe(500); // no collisions in 500 draws
    // Consecutive tokens should not share a common prefix pattern (sanity check, not a strict proof).
    expect(tokens[0]).not.toBe(tokens[1]);
  });
});

describe('normalizeToken', () => {
  it('trims, uppercases, and strips invalid characters', () => {
    expect(normalizeToken('  cpds-8f7k-x29p-4lmq-7tz1  ')).toBe('CPDS-8F7K-X29P-4LMQ-7TZ1');
  });

  it('drops characters outside A-Z, 0-9 and hyphen', () => {
    expect(normalizeToken('cpds 8f7k#x29p')).toBe('CPDS8F7KX29P');
  });
});
