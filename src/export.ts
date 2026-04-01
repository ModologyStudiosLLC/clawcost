/**
 * Data Export Module
 *
 * Export usage data as CSV or JSON for external analysis.
 * Endpoints:
 *   GET /api/export/csv?days=30&model=claude-sonnet-4-6
 *   GET /api/export/json?days=30
 */

import { db } from './db.js';

interface ExportRow {
  timestamp: string;
  session_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
}

function getUsageRows(days: number, modelFilter?: string): ExportRow[] {
  const since = Date.now() - days * 86_400_000;
  let query = `SELECT ts, session_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd FROM usage WHERE ts >= ?`;
  const params: any[] = [since];

  if (modelFilter) {
    query += ` AND model = ?`;
    params.push(modelFilter);
  }

  query += ` ORDER BY ts ASC`;

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map(r => ({
    timestamp: new Date(r.ts).toISOString(),
    session_id: r.session_id,
    provider: r.provider,
    model: r.model,
    input_tokens: r.input_tokens,
    output_tokens: r.output_tokens,
    cache_read_tokens: r.cache_read_tokens,
    cache_write_tokens: r.cache_write_tokens,
    cost_usd: r.cost_usd,
  }));
}

/**
 * Export as CSV string.
 */
export function exportCsv(days: number, modelFilter?: string): string {
  const rows = getUsageRows(days, modelFilter);
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvRows = rows.map(r => headers.map(h => {
    const val = (r as any)[h];
    // Escape CSV values
    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return String(val);
  }).join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

/**
 * Export as JSON.
 */
export function exportJson(days: number, modelFilter?: string): ExportRow[] {
  return getUsageRows(days, modelFilter);
}

/**
 * Export summary stats as JSON.
 */
export function exportSummary(days: number): {
  period: string;
  totalCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Array<{ model: string; cost: number; requests: number; input_tokens: number; output_tokens: number }>;
  byDay: Array<{ date: string; cost: number; requests: number }>;
} {
  const since = Date.now() - days * 86_400_000;

  const totals = db.prepare(
    `SELECT SUM(cost_usd) as cost, COUNT(*) as requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens FROM usage WHERE ts >= ?`
  ).get(since) as any;

  const byModel = db.prepare(
    `SELECT model, SUM(cost_usd) as cost, COUNT(*) as requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens FROM usage WHERE ts >= ? GROUP BY model ORDER BY cost DESC`
  ).all(since) as any[];

  const byDay = db.prepare(
    `SELECT date(ts/1000, 'unixepoch') as date, SUM(cost_usd) as cost, COUNT(*) as requests FROM usage WHERE ts >= ? GROUP BY date ORDER BY date ASC`
  ).all(since) as any[];

  return {
    period: `${days} days`,
    totalCost: totals?.cost ?? 0,
    totalRequests: totals?.requests ?? 0,
    totalInputTokens: totals?.input_tokens ?? 0,
    totalOutputTokens: totals?.output_tokens ?? 0,
    byModel,
    byDay,
  };
}
