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
