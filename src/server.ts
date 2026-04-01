import Fastify from 'fastify';
import https from 'https';
import http from 'http';
import { config } from './config.js';
import { saveUsage, getSpendSince, getStats, getSetting, setSetting } from './db.js';
import { calcCost } from './pricing.js';
import { renderDashboard } from './dashboard.js';
import { checkAndAlert } from './alerts.js';
import { createCheckoutSession, createPortalSession, handleWebhook, getLicenseStatus, STRIPE_SETTING_KEYS } from './billing.js';

const app = Fastify({ logger: false });

// Raw body passthrough for all content types (override Fastify's built-in JSON parser too)
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

// ── Upstream resolution ────────────────────────────────────────────────────
// Detect which upstream to forward to based on the Authorization header.
// Providers route through clawcost by setting baseUrl = http://127.0.0.1:4100/v1
// The API key identifies which real upstream to forward to.
interface Upstream {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  pathPrefix: string; // prepended to the request path when forwarding
  name: string;       // label for logging
}

function resolveUpstream(authHeader: string | undefined): Upstream {
  const key = authHeader?.replace(/^Bearer\s+/i, '') ?? '';

  // MiMo / metaclaw — API key is literally "metaclaw" or the xiaomi key prefix
  if (key === 'metaclaw' || key.startsWith('sk-swesle')) {
    return { protocol: 'http', host: '127.0.0.1', port: 30000, pathPrefix: '', name: 'metaclaw' };
  }
  // DeepSeek
  if (key.startsWith('sk-56557') || key.startsWith('sk-deepseek')) {
    return { protocol: 'https', host: 'api.deepseek.com', port: 443, pathPrefix: '', name: 'deepseek' };
  }
  // ZAI (GLM)
  if (key.length > 20 && !key.startsWith('sk-ant') && !key.startsWith('sk-proj') && !key.startsWith('sk-') ) {
    // ZAI keys don't follow a known prefix — fall through to Anthropic/OpenAI detection below
  }
  // Anthropic
  if (authHeader && (key.startsWith('sk-ant') || key.startsWith('sk-proj'))) {
    return { protocol: 'https', host: 'api.anthropic.com', port: 443, pathPrefix: '', name: 'anthropic' };
  }
  // Default: OpenAI
  return { protocol: 'https', host: 'api.openai.com', port: 443, pathPrefix: '', name: 'openai' };
}

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

// ── Budget status (for external checks e.g. mimo-proxy) ───────────────────
app.get('/api/budget-status', async (_req, reply) => {
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
  const daySpend = getSpendSince(Date.now() - 86_400_000);
  const monthSpend = getSpendSince(Date.now() - 30 * 86_400_000);
  reply.send({
    ok: true,
    daily: { spend: daySpend, budget: dailyBudget, pct: daySpend / dailyBudget, exceeded: daySpend >= dailyBudget },
    monthly: { spend: monthSpend, budget: monthlyBudget, pct: monthSpend / monthlyBudget, exceeded: monthSpend >= monthlyBudget },
  });
});

// ── Direct usage injection (for sources not going through the proxy) ───────
app.post('/api/usage', async (req, reply) => {
  const body = req.body as Buffer;
  try {
    const data = JSON.parse(body.toString()) as {
      provider: string;
      model: string;
      session_id?: string;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens?: number;
      cache_write_tokens?: number;
      cost_usd?: number;
      ts?: number;
    };
    const cost = data.cost_usd ?? calcCost(
      data.model,
      data.input_tokens,
      data.output_tokens,
      data.cache_read_tokens ?? 0,
      data.cache_write_tokens ?? 0,
    );
    saveUsage({
      ts: data.ts ?? Date.now(),
      session_id: data.session_id ?? 'external',
      provider: data.provider,
      model: data.model,
      input_tokens: data.input_tokens,
      output_tokens: data.output_tokens,
      cache_read_tokens: data.cache_read_tokens ?? 0,
      cache_write_tokens: data.cache_write_tokens ?? 0,
      cost_usd: cost,
    });
    const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
    const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
    const daySpend = getSpendSince(Date.now() - 86_400_000);
    const monthSpend = getSpendSince(Date.now() - 30 * 86_400_000);
    checkAndAlert(daySpend, dailyBudget, monthSpend, monthlyBudget).catch(() => {});
    reply.send({ ok: true, cost_usd: cost });
  } catch (err) {
    reply.code(400).send({ ok: false, error: String(err) });
  }
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
  const allowed = ['slack_webhook_url', 'discord_webhook_url', 'alert_email', 'resend_api_key'];
  for (const key of allowed) {
    if (data[key] !== undefined) setSetting(key, data[key]);
  }
  reply.send({ ok: true });
});

app.get('/api/alerts/settings', async (_req, reply) => {
  reply.send({
    slack_webhook_url: getSetting('slack_webhook_url') ?? '',
    discord_webhook_url: getSetting('discord_webhook_url') ?? '',
    alert_email: getSetting('alert_email') ?? '',
    resend_api_key: getSetting('resend_api_key') ? '••••••••' : '',
  });
});

app.post('/api/alerts/test', async (_req, reply) => {
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  await checkAndAlert(dailyBudget * 0.85, dailyBudget, 0, 999);
  reply.send({ ok: true });
});

// ── Billing / Stripe ───────────────────────────────────────────────────────

app.get('/billing/checkout', async (req, reply) => {
  try {
    const base = `http://localhost:${config.proxyPort}`;
    const { url } = await createCheckoutSession(`${base}/billing/success`, `${base}/billing/cancel`);
    reply.redirect(url);
  } catch (err) {
    reply.code(500).send({ ok: false, error: String(err) });
  }
});

app.get('/billing/success', async (_req, reply) => {
  reply.type('text/html').send(`
    <!doctype html><html><head><title>ClawCost Pro — Activated</title>
    <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f0f0f;color:#e2e8f0;}
    .box{text-align:center;padding:2rem;max-width:480px;}
    h1{color:#10b981;font-size:2rem;margin-bottom:1rem;}
    p{color:#94a3b8;margin-bottom:1.5rem;}
    a{background:#10b981;color:#fff;padding:.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;}
    </style></head><body><div class="box">
    <h1>You're on Pro 🎉</h1>
    <p>Your ClawCost Pro license has been activated. Check your email for your license key.</p>
    <a href="/">Go to Dashboard →</a>
    </div></body></html>
  `);
});

app.get('/billing/cancel', async (_req, reply) => {
  reply.redirect('/');
});

app.post('/billing/portal', async (req, reply) => {
  const body = req.body as Buffer;
  const { customer_id } = JSON.parse(body.toString()) as { customer_id: string };
  try {
    const base = `http://localhost:${config.proxyPort}`;
    const { url } = await createPortalSession(customer_id, base);
    reply.send({ url });
  } catch (err) {
    reply.code(500).send({ ok: false, error: String(err) });
  }
});

// Stripe webhook — must receive raw body (already handled by our Buffer parser)
app.post('/billing/webhook', async (req, reply) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) {
    reply.code(400).send({ ok: false, error: 'Missing stripe-signature header' });
    return;
  }
  try {
    const result = await handleWebhook(req.body as Buffer, sig);
    reply.send(result);
  } catch (err) {
    console.error('[ClawCost] Webhook error:', String(err));
    reply.code(400).send({ ok: false, error: String(err) });
  }
});

app.get('/api/billing/status', async (_req, reply) => {
  reply.send(getLicenseStatus());
});

app.post('/api/billing/settings', async (req, reply) => {
  const body = req.body as Buffer;
  const data = JSON.parse(body.toString()) as Record<string, string>;
  for (const key of STRIPE_SETTING_KEYS) {
    if (data[key]) setSetting(key, data[key]);
  }
  reply.send({ ok: true });
});

// ── Proxy ──────────────────────────────────────────────────────────────────
app.all('/v1/*', async (req, reply) => {
  const upstream = resolveUpstream(req.headers['authorization'] as string | undefined);

  // Budget check
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
  const daySpend = getSpendSince(Date.now() - 86_400_000);
  const monthSpend = getSpendSince(Date.now() - 30 * 86_400_000);

  if (daySpend >= dailyBudget) {
    const msg = `ClawCost: Daily budget of $${dailyBudget.toFixed(2)} exceeded (spent $${daySpend.toFixed(4)})`;
    console.log(`[ClawCost] BLOCKED: ${msg}`);
    reply.code(429).send({ type: 'error', error: { type: 'budget_exceeded', message: msg } });
    return;
  }
  if (monthSpend >= monthlyBudget) {
    const msg = `ClawCost: Monthly budget of $${monthlyBudget.toFixed(2)} exceeded (spent $${monthSpend.toFixed(4)})`;
    console.log(`[ClawCost] BLOCKED: ${msg}`);
    reply.code(429).send({ type: 'error', error: { type: 'budget_exceeded', message: msg } });
    return;
  }

  const sessionId = (req.headers['x-session-id'] as string | undefined) ?? 'unknown';
  const body = req.body as Buffer;

  // Forward headers, strip internal headers, replace host
  const forwardHeaders: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === 'host' || !v) continue;
    forwardHeaders[k] = v as string | string[];
  }
  forwardHeaders['host'] = upstream.host;

  const isAnthropic = upstream.name === 'anthropic';
  const reqModule = upstream.protocol === 'https' ? https : http;

  await new Promise<void>((resolve, reject) => {
    const proxyReq = reqModule.request(
      {
        hostname: upstream.host,
        port: upstream.port,
        path: upstream.pathPrefix + req.url,
        method: req.method,
        headers: forwardHeaders,
      },
      (proxyRes) => {
        const resHeaders: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v != null) resHeaders[k] = v as string | string[];
        }
        reply.raw.writeHead(proxyRes.statusCode ?? 200, resHeaders);

        const isSSE = proxyRes.headers['content-type']?.includes('text/event-stream');

        if (isSSE) {
          handleStreamingResponse(proxyRes, reply.raw, upstream.name, isAnthropic, sessionId, resolve, reject);
        } else {
          handleJsonResponse(proxyRes, reply.raw, upstream.name, isAnthropic, sessionId, resolve, reject);
        }
      },
    );

    proxyReq.on('error', (err) => {
      console.error(`[ClawCost] Proxy error (${upstream.name}):`, err.message);
      if (!reply.raw.headersSent) reply.raw.writeHead(502);
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
  isAnthropic: boolean,
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

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trimEnd();
      buffer = buffer.slice(newlineIdx + 1);
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const evt = JSON.parse(raw) as Record<string, unknown>;
        if (isAnthropic) {
          parseAnthropicSSEEvent(evt, { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }, (u) => {
            if (u.model) model = u.model;
            if (u.inputTokens != null) inputTokens = u.inputTokens;
            if (u.outputTokens != null) outputTokens = u.outputTokens;
            if (u.cacheReadTokens != null) cacheReadTokens = u.cacheReadTokens;
            if (u.cacheWriteTokens != null) cacheWriteTokens = u.cacheWriteTokens;
          });
        } else {
          parseOpenAISSEEvent(evt, (u) => {
            if (u.model) model = u.model;
            if (u.inputTokens != null) inputTokens = u.inputTokens;
            if (u.outputTokens != null) outputTokens = u.outputTokens;
          });
        }
      } catch { /* skip */ }
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
  isAnthropic: boolean,
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
        const inputTokens = isAnthropic ? (usage['input_tokens'] ?? 0) : (usage['prompt_tokens'] ?? 0);
        const outputTokens = isAnthropic ? (usage['output_tokens'] ?? 0) : (usage['completion_tokens'] ?? 0);
        const cacheReadTokens = usage['cache_read_input_tokens'] ?? 0;
        const cacheWriteTokens = usage['cache_creation_input_tokens'] ?? 0;
        const model = (json['model'] as string | undefined) ?? 'unknown';
        recordUsage({ provider, model, sessionId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });
      }
    } catch { /* ignore */ }
    resolve();
  });
  proxyRes.on('error', reject);
}

// ── SSE event parsers ──────────────────────────────────────────────────────
interface UsageState { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; }
type UsageUpdates = Partial<UsageState>;

function parseAnthropicSSEEvent(evt: Record<string, unknown>, _state: UsageState, update: (u: UsageUpdates) => void): void {
  if (evt['type'] === 'message_start') {
    const msg = evt['message'] as Record<string, unknown> | undefined;
    if (!msg) return;
    update({ model: (msg['model'] as string | undefined) ?? undefined });
    const u = msg['usage'] as Record<string, number> | undefined;
    if (u) update({ inputTokens: u['input_tokens'] ?? 0, cacheReadTokens: u['cache_read_input_tokens'] ?? 0, cacheWriteTokens: u['cache_creation_input_tokens'] ?? 0 });
  } else if (evt['type'] === 'message_delta') {
    const u = evt['usage'] as Record<string, number> | undefined;
    if (u) update({ outputTokens: u['output_tokens'] ?? 0 });
  }
}

function parseOpenAISSEEvent(evt: Record<string, unknown>, update: (u: UsageUpdates) => void): void {
  if (evt['model']) update({ model: evt['model'] as string });
  const u = evt['usage'] as Record<string, number> | undefined;
  if (u) update({ inputTokens: u['prompt_tokens'] ?? 0, outputTokens: u['completion_tokens'] ?? 0 });
}

// ── Usage recording ────────────────────────────────────────────────────────
function recordUsage(opts: { provider: string; model: string; sessionId: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): void {
  const { provider, model, sessionId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = opts;
  if (inputTokens === 0 && outputTokens === 0) return;
  const cost = calcCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
  saveUsage({ ts: Date.now(), session_id: sessionId, provider, model, input_tokens: inputTokens, output_tokens: outputTokens, cache_read_tokens: cacheReadTokens, cache_write_tokens: cacheWriteTokens, cost_usd: cost });
  console.log(`[ClawCost] ${provider}/${model} | in:${inputTokens} out:${outputTokens} | $${cost.toFixed(5)} | session:${sessionId.slice(0, 8)}`);
  const dailyBudget = parseFloat(getSetting('daily_budget') ?? String(config.dailyBudgetUsd));
  const monthlyBudget = parseFloat(getSetting('monthly_budget') ?? String(config.monthlyBudgetUsd));
  checkAndAlert(getSpendSince(Date.now() - 86_400_000), dailyBudget, getSpendSince(Date.now() - 30 * 86_400_000), monthlyBudget).catch(() => {});
}

export async function startServer(): Promise<void> {
  await app.listen({ port: config.proxyPort, host: '127.0.0.1' });
  console.log(`\n  ⚡ ClawCost proxy   →  http://localhost:${config.proxyPort}/v1`);
  console.log(`     Dashboard        →  http://localhost:${config.proxyPort}`);
  console.log(`     Budget status    →  http://localhost:${config.proxyPort}/api/budget-status`);
  console.log(`     Billing checkout →  http://localhost:${config.proxyPort}/billing/checkout`);
  console.log(`     Stripe webhook   →  http://localhost:${config.proxyPort}/billing/webhook\n`);
}
