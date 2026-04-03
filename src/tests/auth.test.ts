import { describe, it, expect } from 'vitest';
import { generateApiKey } from '../auth.js';

describe('generateApiKey', () => {
  it('generates a key with cc_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('cc_')).toBe(true);
  });

  it('generates a key of expected length', () => {
    const key = generateApiKey();
    expect(key.length).toBe(35); // 'cc_' (3) + 32 chars
  });

  it('generates unique keys each call', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });

  it('generates only alphanumeric characters after prefix', () => {
    const key = generateApiKey();
    const suffix = key.slice(3);
    expect(/^[A-Za-z0-9]+$/.test(suffix)).toBe(true);
  });
});
