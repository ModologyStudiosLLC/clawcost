import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Use a temp directory so the real db module creates a file-based SQLite there.
// This must be done before any db import so the config loads the right path.
const testDir = mkdtempSync(join(tmpdir(), 'clawcost-test-'));
process.env.CLAWCOST_DATA_DIR = testDir;

import {
  db,
  saveUsage,
  getSpendSince,
  getSetting,
  setSetting,
  hasActiveLicense,
  setModelBudget,
  getModelBudget,
  getModelBudgets,
  getModelSpendSince,
  deleteModelBudget,
  shouldSendAlert,
  markAlertSent,
} from '../db.js';

afterAll(() => {
  try { rmSync(testDir, { recursive: true }); } catch {}
});

beforeEach(() => {
  db.exec('DELETE FROM usage; DELETE FROM settings; DELETE FROM licenses; DELETE FROM model_budgets;');
});

describe('saveUsage / getSpendSince', () => {
  it('saves usage and returns spend', () => {
    const now = Date.now();
    saveUsage({ ts: now, session_id: 's1', provider: 'anthropic', model: 'claude-sonnet-4-6', input_tokens: 1000, output_tokens: 500, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.01 });
    const spend = getSpendSince(now - 1000);
    expect(spend).toBeCloseTo(0.01);
  });

  it('returns 0 when no rows in range', () => {
    expect(getSpendSince(Date.now() + 1000)).toBe(0);
  });

  it('accumulates spend across multiple rows', () => {
    const now = Date.now();
    saveUsage({ ts: now, session_id: 's1', provider: 'anthropic', model: 'claude-sonnet-4-6', input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.01 });
    saveUsage({ ts: now, session_id: 's1', provider: 'openai', model: 'gpt-4o', input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.02 });
    expect(getSpendSince(now - 1000)).toBeCloseTo(0.03);
  });
});

describe('getSetting / setSetting', () => {
  it('returns undefined for missing key', () => {
    expect(getSetting('nonexistent')).toBeUndefined();
  });

  it('saves and retrieves a setting', () => {
    setSetting('daily_budget', '10.00');
    expect(getSetting('daily_budget')).toBe('10.00');
  });

  it('overwrites existing setting', () => {
    setSetting('daily_budget', '5.00');
    setSetting('daily_budget', '15.00');
    expect(getSetting('daily_budget')).toBe('15.00');
  });
});

describe('hasActiveLicense', () => {
  it('returns false with no licenses', () => {
    expect(hasActiveLicense()).toBe(false);
  });

  it('returns true after inserting active license', () => {
    db.prepare(`INSERT INTO licenses (license_key, email, plan, status, created_at) VALUES (?, ?, 'pro', 'active', ?)`)
      .run('cc_testkey', 'test@example.com', Date.now());
    expect(hasActiveLicense()).toBe(true);
  });

  it('returns false for cancelled license', () => {
    db.prepare(`INSERT INTO licenses (license_key, email, plan, status, created_at) VALUES (?, ?, 'pro', 'cancelled', ?)`)
      .run('cc_testkey2', 'test2@example.com', Date.now());
    expect(hasActiveLicense()).toBe(false);
  });
});

describe('model budgets', () => {
  it('sets and retrieves a model budget', () => {
    setModelBudget('claude-opus-4-6', 1.00, 10.00);
    const budget = getModelBudget('claude-opus-4-6');
    expect(budget).toBeDefined();
    expect(budget.daily_limit).toBe(1.00);
    expect(budget.monthly_limit).toBe(10.00);
  });

  it('returns undefined for model with no budget', () => {
    expect(getModelBudget('no-budget-model')).toBeUndefined();
  });

  it('getModelBudgets returns all budgets', () => {
    setModelBudget('model-a', 1, 10);
    setModelBudget('model-b', 2, 20);
    expect(getModelBudgets().length).toBe(2);
  });

  it('deletes a model budget', () => {
    setModelBudget('model-to-delete', 1, 10);
    deleteModelBudget('model-to-delete');
    expect(getModelBudget('model-to-delete')).toBeUndefined();
  });

  it('getModelSpendSince sums correctly per model', () => {
    const now = Date.now();
    saveUsage({ ts: now, session_id: 's1', provider: 'anthropic', model: 'claude-opus-4-6', input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.50 });
    saveUsage({ ts: now, session_id: 's1', provider: 'openai', model: 'gpt-4o', input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.05 });
    expect(getModelSpendSince('claude-opus-4-6', now - 1000)).toBeCloseTo(0.50);
    expect(getModelSpendSince('gpt-4o', now - 1000)).toBeCloseTo(0.05);
  });
});

describe('alert cooldown', () => {
  it('returns true when no alert has been sent', () => {
    expect(shouldSendAlert('alert_daily_warning', 3_600_000)).toBe(true);
  });

  it('returns false immediately after marking sent', () => {
    markAlertSent('alert_daily_warning');
    expect(shouldSendAlert('alert_daily_warning', 3_600_000)).toBe(false);
  });

  it('returns true after cooldown has elapsed', () => {
    setSetting('alert_daily_warning', String(Date.now() - 4_000_000));
    expect(shouldSendAlert('alert_daily_warning', 3_600_000)).toBe(true);
  });
});
