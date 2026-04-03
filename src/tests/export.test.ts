import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db module to use an in-memory database for tests
vi.mock('../db.js', async () => {
  const BetterSqlite3 = (await import('better-sqlite3')).default;
  const db = new BetterSqlite3(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      session_id TEXT NOT NULL DEFAULT 'unknown',
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0
    );
  `);

  // Seed some test data
  const insert = db.prepare(`
    INSERT INTO usage (ts, session_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  insert.run(now - 1000, 'session-1', 'anthropic', 'claude-sonnet-4-6', 1000, 500, 0, 0, 0.0105);
  insert.run(now - 2000, 'session-1', 'anthropic', 'claude-sonnet-4-6', 2000, 1000, 0, 0, 0.021);
  insert.run(now - 3000, 'session-2', 'openai', 'gpt-4o', 500, 200, 0, 0, 0.003);

  return { db };
});

import { exportCsv, exportJson, exportSummary } from '../export.js';

describe('exportJson', () => {
  it('returns an array of usage rows', () => {
    const rows = exportJson(1);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('rows have expected fields', () => {
    const rows = exportJson(1);
    const row = rows[0];
    expect(row).toHaveProperty('timestamp');
    expect(row).toHaveProperty('session_id');
    expect(row).toHaveProperty('provider');
    expect(row).toHaveProperty('model');
    expect(row).toHaveProperty('input_tokens');
    expect(row).toHaveProperty('output_tokens');
    expect(row).toHaveProperty('cost_usd');
  });

  it('filters by model when provided', () => {
    const all = exportJson(1);
    const filtered = exportJson(1, 'claude-sonnet-4-6');
    expect(filtered.length).toBeLessThan(all.length);
    filtered.forEach(r => expect(r.model).toBe('claude-sonnet-4-6'));
  });

  it('returns empty array when no data in range', () => {
    const rows = exportJson(0);
    expect(rows.length).toBe(0);
  });
});

describe('exportCsv', () => {
  it('returns a CSV string with headers', () => {
    const csv = exportCsv(1);
    expect(typeof csv).toBe('string');
    expect(csv).toContain('timestamp');
    expect(csv).toContain('model');
    expect(csv).toContain('cost_usd');
  });

  it('returns empty string when no data', () => {
    const csv = exportCsv(0);
    expect(csv).toBe('');
  });

  it('has correct number of rows', () => {
    const csv = exportCsv(1);
    const lines = csv.split('\n').filter(Boolean);
    const dataRows = exportJson(1);
    expect(lines.length).toBe(dataRows.length + 1); // +1 for header
  });
});

describe('exportSummary', () => {
  it('returns summary with expected fields', () => {
    const summary = exportSummary(1);
    expect(summary).toHaveProperty('period');
    expect(summary).toHaveProperty('totalCost');
    expect(summary).toHaveProperty('totalRequests');
    expect(summary).toHaveProperty('byModel');
    expect(summary).toHaveProperty('byDay');
  });

  it('totalCost is positive', () => {
    const summary = exportSummary(1);
    expect(summary.totalCost).toBeGreaterThan(0);
  });

  it('byModel groups correctly', () => {
    const summary = exportSummary(1);
    expect(Array.isArray(summary.byModel)).toBe(true);
    const models = summary.byModel.map(m => m.model);
    expect(models).toContain('claude-sonnet-4-6');
  });
});
