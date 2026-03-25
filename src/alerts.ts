import { getSetting, shouldSendAlert, markAlertSent } from './db.js';

export interface AlertPayload {
  event: 'budget_warning' | 'budget_blocked';
  period: 'daily' | 'monthly';
  pct: number;
  spent: number;
  budget: number;
}

// Called after every usage record. Checks thresholds and fires alerts once per cooldown window.
export async function checkAndAlert(
  dailySpend: number,
  dailyBudget: number,
  monthlySpend: number,
  monthlyBudget: number,
): Promise<void> {
  const checks: Array<{ key: string; payload: AlertPayload; cooldownMs: number }> = [
    {
      key: 'alert_daily_warning',
      cooldownMs: 6 * 3_600_000, // once per 6 hours
      payload: {
        event: 'budget_warning',
        period: 'daily',
        pct: dailySpend / dailyBudget,
        spent: dailySpend,
        budget: dailyBudget,
      },
    },
    {
      key: 'alert_daily_blocked',
      cooldownMs: 3_600_000, // once per hour
      payload: {
        event: 'budget_blocked',
        period: 'daily',
        pct: dailySpend / dailyBudget,
        spent: dailySpend,
        budget: dailyBudget,
      },
    },
    {
      key: 'alert_monthly_warning',
      cooldownMs: 24 * 3_600_000, // once per day
      payload: {
        event: 'budget_warning',
        period: 'monthly',
        pct: monthlySpend / monthlyBudget,
        spent: monthlySpend,
        budget: monthlyBudget,
      },
    },
    {
      key: 'alert_monthly_blocked',
      cooldownMs: 6 * 3_600_000,
      payload: {
        event: 'budget_blocked',
        period: 'monthly',
        pct: monthlySpend / monthlyBudget,
        spent: monthlySpend,
        budget: monthlyBudget,
      },
    },
  ];

  for (const check of checks) {
    const isWarning = check.payload.event === 'budget_warning';
    const isBlocked = check.payload.event === 'budget_blocked';
    const overWarning = check.payload.pct >= 0.8 && check.payload.pct < 1.0;
    const overBudget = check.payload.pct >= 1.0;

    if ((isWarning && !overWarning) || (isBlocked && !overBudget)) continue;
    if (!shouldSendAlert(check.key, check.cooldownMs)) continue;

    markAlertSent(check.key);
    await sendAlerts(check.payload);
  }
}

async function sendAlerts(payload: AlertPayload): Promise<void> {
  await Promise.allSettled([sendSlack(payload), sendEmail(payload)]);
}

// ── Slack ─────────────────────────────────────────────────────────────────
async function sendSlack(payload: AlertPayload): Promise<void> {
  const webhookUrl = getSetting('slack_webhook_url');
  if (!webhookUrl) return;

  const isBlocked = payload.event === 'budget_blocked';
  const emoji = isBlocked ? '🛑' : '⚠️';
  const color = isBlocked ? '#ef4444' : '#f59e0b';
  const title = isBlocked
    ? `${payload.period} budget exceeded — requests are being blocked`
    : `${payload.period} budget at ${Math.round(payload.pct * 100)}%`;

  const body = {
    attachments: [
      {
        color,
        fallback: `ClawCost: ${title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *ClawCost — ${title}*`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Spent*\n$${payload.spent.toFixed(4)}` },
              { type: 'mrkdwn', text: `*Budget*\n$${payload.budget.toFixed(2)}` },
            ],
          },
          ...(isBlocked
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'All API requests are now blocked until the next period or you raise your budget in the dashboard.',
                  },
                },
              ]
            : []),
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`[ClawCost] Slack alert failed: ${res.status}`);
    else console.log(`[ClawCost] Slack alert sent: ${payload.event} (${payload.period})`);
  } catch (err) {
    console.error('[ClawCost] Slack alert error:', err);
  }
}

// ── Email via Resend ──────────────────────────────────────────────────────
async function sendEmail(payload: AlertPayload): Promise<void> {
  const resendKey = getSetting('resend_api_key');
  const alertEmail = getSetting('alert_email');
  if (!resendKey || !alertEmail) return;

  const isBlocked = payload.event === 'budget_blocked';
  const pctStr = Math.round(payload.pct * 100) + '%';
  const subject = isBlocked
    ? `🛑 ClawCost: ${payload.period} budget exceeded — requests blocked`
    : `⚠️ ClawCost: ${pctStr} of ${payload.period} budget used`;

  const accentColor = isBlocked ? '#ef4444' : '#f59e0b';
  const bodyText = isBlocked
    ? `All API requests are currently being blocked. Raise your budget in the dashboard or wait for the next period to resume.`
    : `You're at ${pctStr} of your ${payload.period} budget. At 100%, requests will be blocked automatically.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#070709;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:24px">
      <span style="display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#f0f0f4">
        <span style="display:inline-block;width:24px;height:24px;background:#7c3aed;border-radius:6px;text-align:center;line-height:24px;font-size:12px">⚡</span>
        ClawCost
      </span>
    </div>
    <div style="background:#0f0f12;border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden">
      <div style="height:4px;background:${accentColor}"></div>
      <div style="padding:32px">
        <p style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:${accentColor};margin:0 0 12px">
          ${isBlocked ? 'Budget exceeded' : 'Budget warning'}
        </p>
        <h1 style="font-size:22px;font-weight:700;color:#f0f0f4;margin:0 0 16px;line-height:1.3">
          ${subject.replace(/^[^ ]+ /, '')}
        </h1>
        <p style="font-size:15px;color:#8b8fa8;margin:0 0 24px;line-height:1.6">${bodyText}</p>
        <div style="display:flex;gap:12px;margin-bottom:28px">
          <div style="flex:1;background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:16px">
            <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#4a4d62;margin:0 0 6px">Spent</p>
            <p style="font-size:22px;font-weight:700;color:#f0f0f4;margin:0">$${payload.spent.toFixed(4)}</p>
          </div>
          <div style="flex:1;background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:16px">
            <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#4a4d62;margin:0 0 6px">${payload.period} budget</p>
            <p style="font-size:22px;font-weight:700;color:#f0f0f4;margin:0">$${payload.budget.toFixed(2)}</p>
          </div>
        </div>
        <a href="http://localhost:4100" style="display:block;text-align:center;background:#7c3aed;color:#fff;font-size:14px;font-weight:600;padding:12px;border-radius:8px;text-decoration:none">
          Open Dashboard →
        </a>
      </div>
    </div>
    <p style="font-size:12px;color:#4a4d62;margin-top:20px;text-align:center">
      ClawCost · <a href="http://localhost:4100" style="color:#4a4d62">Manage alerts</a>
    </p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ClawCost <alerts@getclawcost.com>',
        to: alertEmail,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[ClawCost] Email alert failed: ${res.status} ${err}`);
    } else {
      console.log(`[ClawCost] Email alert sent to ${alertEmail}: ${payload.event} (${payload.period})`);
    }
  } catch (err) {
    console.error('[ClawCost] Email alert error:', err);
  }
}
