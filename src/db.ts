import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

export const db = new BetterSqlite3(path.join(config.dataDir, 'usage.db'));
db.pragma('journal_mode = WAL');

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
  CREATE INDEX IF NOT EXISTS idx_ts ON usage(ts);
  CREATE INDEX IF NOT EXISTS idx_session ON usage(session_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'pro',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    cancelled_at INTEGER
  );
`);

export interface UsageRow {
  ts: number;
  session_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
}

const insertStmt = db.prepare<UsageRow>(`
  INSERT INTO usage (ts, session_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
  VALUES (@ts, @session_id, @provider, @model, @input_tokens, @output_tokens, @cache_read_tokens, @cache_write_tokens, @cost_usd)
`);

export function saveUsage(row: UsageRow): void {
  insertStmt.run(row);
}

export function getSpendSince(sinceTs: number): number {
  const row = db.prepare<[number], { total: number | null }>(
    'SELECT SUM(cost_usd) as total FROM usage WHERE ts >= ?'
  ).get(sinceTs);
  return row?.total ?? 0;
}

export function getStats() {
  const now = Date.now();
  const dayAgo = now - 86_400_000;
  const monthAgo = now - 30 * 86_400_000;

  const today = db.prepare<[number], { cost: number | null; requests: number; input_tokens: number | null; output_tokens: number | null }>(
    `SELECT SUM(cost_usd) as cost, COUNT(*) as requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens FROM usage WHERE ts >= ?`
  ).get(dayAgo)!;

  const month = db.prepare<[number], { cost: number | null; requests: number }>(
    `SELECT SUM(cost_usd) as cost, COUNT(*) as requests FROM usage WHERE ts >= ?`
  ).get(monthAgo)!;

  const byModel = db.prepare<[number], { model: string; cost: number; requests: number; input_tokens: number; output_tokens: number }>(
    `SELECT model, SUM(cost_usd) as cost, COUNT(*) as requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens
     FROM usage WHERE ts >= ? GROUP BY model ORDER BY cost DESC`
  ).all(monthAgo);

  const bySessions = db.prepare<[number], { session_id: string; cost: number; requests: number; last_ts: number }>(
    `SELECT session_id, SUM(cost_usd) as cost, COUNT(*) as requests, MAX(ts) as last_ts
     FROM usage WHERE ts >= ? GROUP BY session_id ORDER BY last_ts DESC LIMIT 20`
  ).all(dayAgo);

  // 7-day history
  const history = db.prepare<[], { date: string; cost: number; requests: number }>(
    `SELECT date(ts/1000, 'unixepoch') as date, SUM(cost_usd) as cost, COUNT(*) as requests
     FROM usage WHERE ts >= ${now - 7 * 86_400_000}
     GROUP BY date ORDER BY date ASC`
  ).all();

  return { today, month, byModel, bySessions, history };
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function shouldSendAlert(key: string, cooldownMs: number): boolean {
  const lastTs = getSetting(key);
  if (!lastTs) return true;
  return Date.now() - parseInt(lastTs) > cooldownMs;
}

export function markAlertSent(key: string): void {
  setSetting(key, String(Date.now()));
}

export interface LicenseRow {
  id: number;
  license_key: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  created_at: number;
  cancelled_at: number | null;
}

export function createLicense(license_key: string, email: string, stripe_customer_id: string, stripe_subscription_id: string): LicenseRow {
  return db.prepare<[string, string, string, string, number], LicenseRow>(
    `INSERT INTO licenses (license_key, email, stripe_customer_id, stripe_subscription_id, plan, status, created_at)
     VALUES (?, ?, ?, ?, 'pro', 'active', ?)
     RETURNING *`
  ).get(license_key, email, stripe_customer_id, stripe_subscription_id, Date.now())!;
}

export function getLicenseBySubscription(subscriptionId: string): LicenseRow | undefined {
  return db.prepare<[string], LicenseRow>('SELECT * FROM licenses WHERE stripe_subscription_id = ?').get(subscriptionId);
}

export function cancelLicense(subscriptionId: string): void {
  db.prepare('UPDATE licenses SET status = ?, cancelled_at = ? WHERE stripe_subscription_id = ?')
    .run('cancelled', Date.now(), subscriptionId);
}

export function getActiveLicenses(): LicenseRow[] {
  return db.prepare<[string], LicenseRow>('SELECT * FROM licenses WHERE status = ? ORDER BY created_at DESC').all('active');
}

export function hasActiveLicense(): boolean {
  const row = db.prepare<[string], { count: number }>('SELECT COUNT(*) as count FROM licenses WHERE status = ?').get('active');
  return (row?.count ?? 0) > 0;
}
