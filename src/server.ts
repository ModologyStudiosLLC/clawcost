import Fastify from 'fastify';
import https from 'https';
import http from 'http';
import { config } from './config.js';
import { db, saveUsage, getSpendSince, getStats, getSetting, setSetting } from './db.js';
import { calcCost } from './pricing.js';
import { renderDashboard } from './dashboard.js';
import { checkAndAlert } from './alerts.js';

import { requireDashboardAuth } from './auth.js';
import { calcCost as calcCostDynamic, getPricing, getAllPricing, getPricingMeta, loadPricing } from './pricing_dynamic.js';
import { exportCsv, exportJson, exportSummary } from './export.js';

const app = Fastify({ logger: false });

// Raw body passthrough for all content types
app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

// ── Auth hook for all API routes (except proxy /v1/*) ─────────────────────
app.addHook('preHandler', async (req, reply) => {
  if (req.url.startsWith('/v1/') || req.url === '/' || req.url.startsWith('/assets')) return;
  requireDashboardAuth(req, reply, () => {});
  if (reply.sent) return; // Auth failed, reply already sent
});

// ── Dashboard ──────────────────────────────────────────────────────────────
app.get('/', async (_req, reply) => {
  reply.type('text/html').send(renderDashboard());
});

app.get('/api/stats', async (_req, reply) => {
  const stats = getStats();
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
  reply.send({ ...stats, budgets: { daily: dailyBudget, monthly: monthlyBudget } });
});

app.post('/api/budgets', async (req, reply) => {
  const body = req.body as Buffer;
  const { daily, monthly } = JSON.parse(body.toString()) as { daily: number; monthly: number };
  if (daily > 0) setSetting('daily_budget', String(daily));
  if (monthly > 0) setSetting('monthly_budget', String(monthly));
  reply.send({ ok: true });
});

app.post('/api/alerts', async (req, reply) => {
  const body = req.body as Buffer;
  const data = JSON.parse(body.toString()) as Record<string, string>;
  const allowed = ['slack_webhook_url', 'alert_email', 'resend_api_key'];
  for (const key of allowed) {
    if (data[key] !== undefined) setSetting(key, data[key]);
  }
  reply.send({ ok: true });
});

app.get('/api/alerts/settings', async (_req, reply) => {
  reply.send({
    slack_webhook_url: getSetting('slack_webhook_url') ?? '',
    alert_email: getSetting('alert_email') ?? '',
    resend_api_key: getSetting('resend_api_key') ? '••••••••' : '',
  });
});

app.post('/api/alerts/test', async (req, reply) => {
  const body = req.body as Buffer;
  const { channel } = JSON.parse(body.toString()) as { channel: 'slack' | 'email' };
  const { checkAndAlert } = await import('./alerts.js');
  // Send a test alert at 85% to trigger warning path
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  await checkAndAlert(dailyBudget * 0.85, dailyBudget, 0, 999);
  reply.send({ ok: true });
});

// ── Dynamic Pricing API ───────────────────────────────────────────────────
app.get('/api/pricing', async (_req, reply) => {
  reply.send({
    models: getAllPricing(),
    meta: getPricingMeta(),
  });
});

app.post('/api/pricing', async (req, reply) => {
  const body = req.body as Buffer;
  const data = JSON.parse(body.toString()) as Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }>;
  for (const [model, pricing] of Object.entries(data)) {
    const { updatePricing } = await import('./pricing_dynamic.js');
    updatePricing(model, pricing);
  }
  reply.send({ ok: true, models: getAllPricing() });
});

// ── Data Export API ────────────────────────────────────────────────────────
app.get('/api/export/csv', async (req, reply) => {
  const url = new URL(req.url, 'http://localhost');
  const days = parseInt(url.searchParams.get('days') ?? '30');
  const model = url.searchParams.get('model') ?? undefined;
  const csv = exportCsv(days, model);
  reply.type('text/csv').header('Content-Disposition', `attachment; filename="clawcost-usage-${days}d.csv"`).send(csv);
});

app.get('/api/export/json', async (req, reply) => {
  const url = new URL(req.url, 'http://localhost');
  const days = parseInt(url.searchParams.get('days') ?? '30');
  const model = url.searchParams.get('model') ?? undefined;
  reply.send(exportJson(days, model));
});

app.get('/api/export/summary', async (req, reply) => {
  const url = new URL(req.url, 'http://localhost');
  const days = parseInt(url.searchParams.get('days') ?? '30');
  reply.send(exportSummary(days));
});

// ── Harness / Optimization API ─────────────────────────────────────────────

// Simple in-memory pattern tracker for the harness
const usagePatterns: Map<string, { sessionId: string; model: string; count: number; totalInput: number; totalOutput: number; totalCost: number }> = new Map();

function trackPattern(sessionId: string, model: string, inputTokens: number, outputTokens: number, cost: number) {
  const key = `${sessionId}:${model}`;
  const existing = usagePatterns.get(key);
  if (existing) {
    existing.count++;
    existing.totalInput += inputTokens;
    existing.totalOutput += outputTokens;
    existing.totalCost += cost;
  } else {
    usagePatterns.set(key, { sessionId, model, count: 1, totalInput: inputTokens, totalOutput: outputTokens, totalCost: cost });
  }
}

app.get('/api/optimizations', async (_req, reply) => {
  const suggestions: any[] = [];
  for (const [key, p] of usagePatterns) {
    if (p.count < 5) continue;
    const avgOutput = p.totalOutput / p.count;
    // Detect: expensive model with short outputs
    if ((p.model.includes('opus') || p.model.includes('o1')) && avgOutput < 500) {
      suggestions.push({
        type: 'model_downgrade',
        severity: 'warning',
        currentModel: p.model,
        suggestedModel: p.model.includes('opus') ? 'claude-sonnet-4-6' : 'o3-mini',
        reason: `${p.count} requests with avg ${Math.round(avgOutput)} output tokens on ${p.model}. A cheaper model could handle these.`,
        estimatedSavings: p.totalCost * 0.7,
        confidence: 0.7,
      });
    }
    // Detect: session runaway
    if (p.totalCost > 2.0 && p.count > 50) {
      suggestions.push({
        type: 'session_warning',
        severity: 'critical',
        currentModel: p.model,
        reason: `Session ${p.sessionId.slice(0, 8)} has ${p.count} requests costing $${p.totalCost.toFixed(2)}.`,
        estimatedSavings: p.totalCost * 0.3,
        confidence: 0.9,
      });
    }
  }
  reply.send({
    suggestions,
    stats: {
      totalPatterns: usagePatterns.size,
      totalOptimizations: suggestions.length,
      estimatedTotalSavings: suggestions.reduce((sum, s) => sum + (s.estimatedSavings ?? 0), 0),
    },
  });
});

app.get('/api/recommend/:taskType', async (req, reply) => {
  const taskType = (req.params as any).taskType;
  const recommendations: Record<string, { model: string; reason: string }> = {
    simple_qa: { model: 'gpt-4o-mini', reason: 'Cheapest fast model for simple Q&A' },
    summarization: { model: 'claude-haiku-4-5', reason: 'Fast and cheap for text processing' },
    chat: { model: 'claude-sonnet-4-6', reason: 'Best balance of quality and cost for conversation' },
    coding: { model: 'claude-sonnet-4-6', reason: 'Strong coding at balanced price' },
    reasoning: { model: 'claude-opus-4-6', reason: 'Most capable for complex reasoning' },
  };
  const rec = recommendations[taskType] ?? { model: 'claude-sonnet-4-6', reason: 'Default balanced recommendation' };
  reply.send({ taskType, ...rec });
});

// ── Proxy ──────────────────────────────────────────────────────────────────
app.all('/v1/*', async (req, reply) => {
  // Detect provider from headers and path
  const isAnthropic = !!req.headers['anthropic-version'] || req.url.includes('/messages');
  const upstream = isAnthropic
    ? { host: 'api.anthropic.com', port: 443 }
    : { host: 'api.openai.com', port: 443 };

  // Budget check
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
  const daySpend = getSpendSince(Date.now() - 86_400_000);
  const monthSpend = getSpendSince(Date.now() - 30 * 86_400_000);

  if (daySpend >= dailyBudget) {
    const msg = `ClawCost: Daily budget of $${dailyBudget.toFixed(2)} exceeded (spent $${daySpend.toFixed(4)})`;
    console.log(`[ClawCost] BLOCKED: ${msg}`);
    reply.code(429).send({
      type: 'error',
      error: { type: 'budget_exceeded', message: msg },
    });
    return;
  }
  if (monthSpend >= monthlyBudget) {
    const msg = `ClawCost: Monthly budget of $${monthlyBudget.toFixed(2)} exceeded (spent $${monthSpend.toFixed(4)})`;
    console.log(`[ClawCost] BLOCKED: ${msg}`);
    reply.code(429).send({
      type: 'error',
      error: { type: 'budget_exceeded', message: msg },
    });
    return;
  }

  const sessionId = (req.headers['x-session-id'] as string | undefined) ?? 'unknown';
  const body = req.body as Buffer;

  // Forward headers, replace host
  const forwardHeaders: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === 'host' || !v) continue;
    forwardHeaders[k] = v as string | string[];
  }
  forwardHeaders['host'] = upstream.host;

  await new Promise<void>((resolve, reject) => {
    const proxyReq = https.request(
      {
        hostname: upstream.host,
        port: upstream.port,
        path: req.url,
        method: req.method,
        headers: forwardHeaders,
      },
      (proxyRes) => {
        // Forward status + headers to client
        const resHeaders: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v != null) resHeaders[k] = v as string | string[];
        }
        reply.raw.writeHead(proxyRes.statusCode ?? 200, resHeaders);

        const isSSE = proxyRes.headers['content-type']?.includes('text/event-stream');
        const provider = isAnthropic ? 'anthropic' : 'openai';

        if (isSSE) {
          handleStreamingResponse(proxyRes, reply.raw, provider, sessionId, resolve, reject);
        } else {
          handleJsonResponse(proxyRes, reply.raw, provider, sessionId, resolve, reject);
        }
      },
    );

    proxyReq.on('error', (err) => {
      console.error('[ClawCost] Proxy request error:', err.message);
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(502);
      }
      reply.raw.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }));
      reject(err);
    });

    if (body?.length) proxyReq.write(body);
    proxyReq.end();
  }).catch(() => {/* already handled */});
});

// ── SSE streaming handler ──────────────────────────────────────────────────
function handleStreamingResponse(
  proxyRes: http.IncomingMessage,
  clientRes: http.ServerResponse,
  provider: string,
  sessionId: string,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let model = 'unknown';

  proxyRes.on('data', (chunk: Buffer) => {
    clientRes.write(chunk);
    buffer += chunk.toString('utf-8');

    // Parse complete SSE lines from buffer
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trimEnd();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;

      try {
        const evt = JSON.parse(raw) as Record<string, unknown>;

        if (provider === 'anthropic') {
          parseAnthropicSSEEvent(evt, { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }, (updates) => {
            if (updates.model) model = updates.model;
            if (updates.inputTokens != null) inputTokens = updates.inputTokens;
            if (updates.outputTokens != null) outputTokens = updates.outputTokens;
            if (updates.cacheReadTokens != null) cacheReadTokens = updates.cacheReadTokens;
            if (updates.cacheWriteTokens != null) cacheWriteTokens = updates.cacheWriteTokens;
          });
        } else {
          parseOpenAISSEEvent(evt, (updates) => {
            if (updates.model) model = updates.model;
            if (updates.inputTokens != null) inputTokens = updates.inputTokens;
            if (updates.outputTokens != null) outputTokens = updates.outputTokens;
          });
        }
      } catch {
        // Non-JSON SSE line, skip
      }
    }
  });

  proxyRes.on('end', () => {
    clientRes.end();
    recordUsage({ provider, model, sessionId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });
    resolve();
  });

  proxyRes.on('error', reject);
}

// ── JSON (non-streaming) handler ───────────────────────────────────────────
function handleJsonResponse(
  proxyRes: http.IncomingMessage,
  clientRes: http.ServerResponse,
  provider: string,
  sessionId: string,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  const chunks: Buffer[] = [];

  proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));

  proxyRes.on('end', () => {
    const bodyBuf = Buffer.concat(chunks);
    clientRes.end(bodyBuf);

    try {
      const json = JSON.parse(bodyBuf.toString('utf-8')) as Record<string, unknown>;
      const usage = json['usage'] as Record<string, number> | undefined;
      if (usage) {
        const inputTokens = provider === 'anthropic'
          ? (usage['input_tokens'] ?? 0)
          : (usage['prompt_tokens'] ?? 0);
        const outputTokens = provider === 'anthropic'
          ? (usage['output_tokens'] ?? 0)
          : (usage['completion_tokens'] ?? 0);
        const cacheReadTokens = usage['cache_read_input_tokens'] ?? 0;
        const cacheWriteTokens = usage['cache_creation_input_tokens'] ?? 0;
        const model = (json['model'] as string | undefined) ?? 'unknown';
        recordUsage({ provider, model, sessionId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });
      }
    } catch {
      // Non-JSON response (e.g. errors), ignore
    }
    resolve();
  });

  proxyRes.on('error', reject);
}

// ── SSE event parsers ──────────────────────────────────────────────────────
interface UsageState {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

type UsageUpdates = Partial<UsageState>;

function parseAnthropicSSEEvent(
  evt: Record<string, unknown>,
  _state: UsageState,
  update: (u: UsageUpdates) => void,
): void {
  if (evt['type'] === 'message_start') {
    const msg = evt['message'] as Record<string, unknown> | undefined;
    if (!msg) return;
    update({ model: (msg['model'] as string | undefined) ?? undefined });
    const u = msg['usage'] as Record<string, number> | undefined;
    if (u) {
      update({
        inputTokens: u['input_tokens'] ?? 0,
        cacheReadTokens: u['cache_read_input_tokens'] ?? 0,
        cacheWriteTokens: u['cache_creation_input_tokens'] ?? 0,
      });
    }
  } else if (evt['type'] === 'message_delta') {
    const u = evt['usage'] as Record<string, number> | undefined;
    if (u) update({ outputTokens: u['output_tokens'] ?? 0 });
  }
}

function parseOpenAISSEEvent(
  evt: Record<string, unknown>,
  update: (u: UsageUpdates) => void,
): void {
  if (evt['model']) update({ model: evt['model'] as string });
  // OpenAI includes usage in the final chunk when stream_options.include_usage=true
  const u = evt['usage'] as Record<string, number> | undefined;
  if (u) {
    update({
      inputTokens: u['prompt_tokens'] ?? 0,
      outputTokens: u['completion_tokens'] ?? 0,
    });
  }
}

// ── Usage recording ────────────────────────────────────────────────────────
function recordUsage(opts: {
  provider: string;
  model: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}): void {
  const { provider, model, sessionId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = opts;
  if (inputTokens === 0 && outputTokens === 0) return;

  const cost = calcCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
  saveUsage({
    ts: Date.now(),
    session_id: sessionId,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    cost_usd: cost,
  });

  // Track pattern for harness optimization
  trackPattern(sessionId, model, inputTokens, outputTokens, cost);

  console.log(
    `[ClawCost] ${provider}/${model} | in:${inputTokens} out:${outputTokens} | $${cost.toFixed(5)} | session:${sessionId.slice(0, 8)}`,
  );

  // Fire alerts asynchronously — don't block the response
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
  const daySpend = getSpendSince(Date.now() - 86_400_000);
  const monthSpend = getSpendSince(Date.now() - 30 * 86_400_000);
  checkAndAlert(daySpend, dailyBudget, monthSpend, monthlyBudget).catch(() => {});
}

export async function startServer(): Promise<void> {
  await app.listen({ port: config.proxyPort, host: '127.0.0.1' });
  console.log(`\n  ClawCost proxy  →  http://localhost:${config.proxyPort}/v1`);
  console.log(`  Dashboard       →  http://localhost:${config.proxyPort}`);
  console.log(`\n  Add to ~/.openclaw/.env:`);
  console.log(`    ANTHROPIC_BASE_URL=http://localhost:${config.proxyPort}/v1\n`);
}
