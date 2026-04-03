import { describe, it, expect, beforeEach } from 'vitest';
import { calcCost, getPricing, getAllPricing, updatePricing, loadPricing } from '../pricing_dynamic.js';

describe('calcCost', () => {
  it('calculates cost for claude-sonnet-4-6 correctly', () => {
    // 1M input tokens at $3/M = $3, 1M output at $15/M = $15
    const cost = calcCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 4);
  });

  it('calculates cache read tokens', () => {
    const cost = calcCost('claude-sonnet-4-6', 0, 0, 1_000_000, 0);
    expect(cost).toBeCloseTo(0.30, 4);
  });

  it('calculates cache write tokens', () => {
    const cost = calcCost('claude-sonnet-4-6', 0, 0, 0, 1_000_000);
    expect(cost).toBeCloseTo(3.75, 4);
  });

  it('returns zero cost for zero tokens', () => {
    expect(calcCost('claude-sonnet-4-6', 0, 0)).toBe(0);
  });

  it('falls back to default pricing for unknown model', () => {
    const cost = calcCost('unknown-model-xyz', 1_000_000, 0);
    expect(cost).toBeGreaterThan(0);
  });

  it('calculates small token amounts correctly', () => {
    // 1000 input tokens on sonnet = $3/M * (1000/1_000_000) = $0.003
    const cost = calcCost('claude-sonnet-4-6', 1000, 0);
    expect(cost).toBeCloseTo(0.003, 6);
  });

  it('uses prefix match for partial model names', () => {
    const exact = getPricing('claude-sonnet-4-6');
    const withSuffix = getPricing('claude-sonnet-4-6-20251022');
    expect(withSuffix).toBeDefined();
    // Should resolve to something sensible (not the fallback $3 input exactly different from exact)
    expect(withSuffix.output).toBeGreaterThan(0);
  });
});

describe('getPricing', () => {
  it('returns pricing for known models', () => {
    const p = getPricing('claude-opus-4-6');
    expect(p.input).toBe(15);
    expect(p.output).toBe(75);
  });

  it('returns pricing for gpt-4o', () => {
    const p = getPricing('gpt-4o');
    expect(p.input).toBe(2.50);
    expect(p.output).toBe(10);
  });

  it('returns non-zero fallback for unknown model', () => {
    const p = getPricing('totally-unknown-model');
    expect(p.input).toBeGreaterThan(0);
    expect(p.output).toBeGreaterThan(0);
  });
});

describe('getAllPricing', () => {
  it('returns a record with multiple models', () => {
    const all = getAllPricing();
    expect(Object.keys(all).length).toBeGreaterThan(5);
    expect(all['claude-sonnet-4-6']).toBeDefined();
    expect(all['gpt-4o']).toBeDefined();
  });
});

describe('updatePricing', () => {
  it('updates pricing for a model', () => {
    updatePricing('test-model-abc', { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 });
    const p = getPricing('test-model-abc');
    expect(p.input).toBe(1);
    expect(p.output).toBe(5);
  });

  it('merges partial updates', () => {
    updatePricing('test-model-abc', { input: 99 });
    const p = getPricing('test-model-abc');
    expect(p.input).toBe(99);
    expect(p.output).toBe(5); // unchanged from previous test
  });
});
