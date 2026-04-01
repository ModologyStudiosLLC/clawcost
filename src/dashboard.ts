export function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClawCost</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0a;
    --surface: #141414;
    --border: #262626;
    --text: #e5e5e5;
    --muted: #737373;
    --accent: #22c55e;
    --warn: #f59e0b;
    --danger: #ef4444;
    --blue: #3b82f6;
    --violet: #8b5cf6;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
  header { padding: 16px 32px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 600; }
  .tag { font-size: 11px; background: var(--accent); color: #000; padding: 2px 8px; border-radius: 99px; font-weight: 700; }
  .pro-tag { font-size: 11px; background: var(--violet); color: #fff; padding: 2px 8px; border-radius: 99px; font-weight: 700; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent); animation: pulse 2s infinite; flex-shrink: 0; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  #last-updated { margin-left: auto; font-size: 12px; color: var(--muted); }
  main { padding: 24px 32px; max-width: 1200px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 12px; margin-top: 24px; }
  .section-title:first-child { margin-top: 0; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 14px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; }
  .card-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 10px; }
  .big-num { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .sub-num { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .budget-bar { height: 5px; background: var(--border); border-radius: 3px; margin-top: 10px; overflow: hidden; }
  .budget-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
  .budget-label { font-size: 11px; color: var(--muted); margin-top: 5px; display: flex; justify-content: space-between; }
  .forecast-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .forecast-row:last-child { border-bottom: none; }
  .forecast-label { font-size: 12px; color: var(--muted); }
  .forecast-val { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--border); font-weight: 600; }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .model-tag { font-size: 11px; background: rgba(59,130,246,0.12); color: var(--blue); padding: 2px 7px; border-radius: 4px; font-family: monospace; }
  .history-chart { display: flex; align-items: flex-end; gap: 5px; height: 72px; padding-top: 8px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; height: 100%; justify-content: flex-end; }
  .bar { width: 100%; background: var(--accent); border-radius: 3px 3px 0 0; opacity: 0.75; min-height: 2px; transition: opacity 0.2s; cursor: default; }
  .bar:hover { opacity: 1; }
  .bar-label { font-size: 10px; color: var(--muted); }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  input[type=number], input[type=text], input[type=email], input[type=password], input[type=url] {
    width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 7px 11px; color: var(--text); font-size: 13px;
  }
  input:focus { outline: none; border-color: var(--accent); }
  .field { margin-bottom: 12px; }
  button { padding: 7px 14px; background: var(--accent); color: #000; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:hover { opacity: 0.85; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); }
  button.ghost:hover { border-color: var(--text); color: var(--text); }
  button.danger { background: transparent; border: 1px solid var(--danger); color: var(--danger); padding: 4px 10px; font-size: 12px; }
  button.danger:hover { background: rgba(239,68,68,0.1); }
  .btn-row { display: flex; gap: 8px; margin-top: 4px; }
  .empty { color: var(--muted); text-align: center; padding: 20px; font-size: 13px; }
  .status-pill { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
  .status-pill.on  { background: rgba(34,197,94,0.12); color: var(--accent); }
  .status-pill.off { background: rgba(115,115,115,0.1); color: var(--muted); }
  .channel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .channel-title { font-size: 13px; font-weight: 600; }
  .alerts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .alerts-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .msg { font-size: 12px; color: var(--accent); margin-top: 10px; height: 16px; }
  .pro-gate { background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.25); border-radius: 10px; padding: 20px; text-align: center; }
  .pro-gate h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .pro-gate p { font-size: 13px; color: var(--muted); margin-bottom: 14px; }
  .pro-gate a { display: inline-block; background: var(--violet); color: #fff; padding: 8px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px; }
  .pro-gate a:hover { opacity: 0.85; }
  .model-budget-row { display: grid; grid-template-columns: 1fr 120px 120px auto; gap: 10px; align-items: end; margin-bottom: 10px; }
  .model-budget-row.header { align-items: center; margin-bottom: 6px; }
  .model-budget-row.header span { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .threshold-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
</style>
</head>
<body>
<header>
  <div class="status-dot"></div>
  <h1>ClawCost</h1>
  <span class="tag">PROXY ACTIVE</span>
  <span id="pro-badge" style="display:none" class="pro-tag">PRO</span>
  <span id="last-updated">Loading...</span>
</header>
<main>

  <!-- Spend Overview -->
  <div class="section-title">Spend Overview</div>
  <div class="grid-4">
    <div class="card">
      <div class="card-title">Today</div>
      <div class="big-num" id="today-cost">—</div>
      <div class="sub-num" id="today-sub">—</div>
      <div class="budget-bar"><div class="budget-fill" id="today-bar" style="width:0%"></div></div>
      <div class="budget-label"><span>Daily limit</span><span id="today-budget-label">—</span></div>
    </div>
    <div class="card">
      <div class="card-title" id="month-card-title">This Month</div>
      <div class="big-num" id="month-cost">—</div>
      <div class="sub-num" id="month-sub">—</div>
      <div class="budget-bar"><div class="budget-fill" id="month-bar" style="width:0%"></div></div>
      <div class="budget-label"><span>Monthly limit</span><span id="month-budget-label">—</span></div>
    </div>
    <div class="card">
      <div class="card-title">Projected Month-End</div>
      <div class="big-num" id="forecast-projected">—</div>
      <div class="sub-num" id="forecast-sub">— / day avg</div>
      <div style="margin-top:10px">
        <div class="forecast-row">
          <span class="forecast-label">Month-to-date</span>
          <span class="forecast-val" id="forecast-mtd">—</span>
        </div>
        <div class="forecast-row">
          <span class="forecast-label">Days remaining</span>
          <span class="forecast-val" id="forecast-days">—</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Today's Requests</div>
      <div class="big-num" id="today-requests">—</div>
      <div class="sub-num" id="today-tokens">— tokens</div>
    </div>
  </div>

  <!-- History + Budget Settings -->
  <div class="grid-2">
    <div class="card">
      <div class="card-title" id="history-title">Spend History</div>
      <div class="history-chart" id="history-chart"></div>
    </div>
    <div class="card">
      <div class="card-title">Budget Limits</div>
      <div class="grid-2" style="margin-bottom:0">
        <div class="field">
          <label>Daily Budget (USD)</label>
          <input type="number" id="input-daily" step="0.01" min="0" placeholder="5.00">
        </div>
        <div class="field">
          <label>Monthly Budget (USD)</label>
          <input type="number" id="input-monthly" step="0.01" min="0" placeholder="50.00">
        </div>
      </div>
      <button onclick="saveBudgets()">Save Budgets</button>
      <div class="msg" id="budget-msg"></div>
    </div>
  </div>

  <!-- Model Breakdown -->
  <div class="grid-2">
    <div class="card">
      <div class="card-title" id="model-table-title">Cost by Model</div>
      <table>
        <thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cost</th></tr></thead>
        <tbody id="model-body"><tr><td colspan="4" class="empty">No data yet</td></tr></tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Recent Sessions (today)</div>
      <table>
        <thead><tr><th>Session</th><th>Requests</th><th>Cost</th><th>Last</th></tr></thead>
        <tbody id="session-body"><tr><td colspan="4" class="empty">No data yet</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Alert Settings -->
  <div class="section-title" style="margin-top:28px">Alert Channels</div>
  <div class="card" style="margin-bottom:14px">
    <div class="alerts-grid-3" id="alert-channels">

      <div>
        <div class="channel-header">
          <span class="channel-title">Slack</span>
          <span class="status-pill off" id="slack-status">Not configured</span>
        </div>
        <div class="field">
          <label>Webhook URL</label>
          <input type="url" id="input-slack" placeholder="https://hooks.slack.com/services/...">
        </div>
        <div class="btn-row">
          <button onclick="saveAlerts()">Save</button>
          <button class="ghost" onclick="testAlert()">Test</button>
        </div>
      </div>

      <div>
        <div class="channel-header">
          <span class="channel-title">Discord</span>
          <span class="status-pill off" id="discord-status">Not configured</span>
        </div>
        <div class="field">
          <label>Webhook URL</label>
          <input type="url" id="input-discord" placeholder="https://discord.com/api/webhooks/...">
        </div>
        <div class="btn-row">
          <button onclick="saveAlerts()">Save</button>
          <button class="ghost" onclick="testAlert()">Test</button>
        </div>
      </div>

      <div>
        <div class="channel-header">
          <span class="channel-title">Email</span>
          <span class="status-pill off" id="email-status">Not configured</span>
        </div>
        <div class="field">
          <label>Alert address</label>
          <input type="email" id="input-email" placeholder="you@example.com">
        </div>
        <div class="field">
          <label>Resend API key</label>
          <input type="password" id="input-resend" placeholder="re_••••••••">
        </div>
        <button onclick="saveAlerts()">Save</button>
      </div>

    </div>
    <div class="msg" id="alert-msg"></div>
  </div>

  <!-- Pro: Alert Threshold + Webhook -->
  <div id="pro-alert-section" style="display:none">
    <div class="section-title">Pro — Alert Settings</div>
    <div class="card" style="margin-bottom:14px">
      <div class="threshold-row">
        <div>
          <div class="field">
            <label>Warning threshold (%)</label>
            <input type="number" id="input-threshold" min="1" max="99" step="1" placeholder="80">
          </div>
          <p style="font-size:12px;color:var(--muted)">Alert fires when spend reaches this % of your budget. Default: 80%.</p>
        </div>
        <div>
          <div class="field">
            <label>Outbound webhook URL</label>
            <input type="url" id="input-webhook" placeholder="https://your-service.com/hooks/clawcost">
          </div>
          <p style="font-size:12px;color:var(--muted)">POST JSON payload to any URL on every alert event.</p>
        </div>
      </div>
      <button onclick="saveProAlerts()">Save Pro Alert Settings</button>
      <div class="msg" id="pro-alert-msg"></div>
    </div>
  </div>

  <!-- Pro: Per-Model Budgets -->
  <div id="pro-model-budget-section" style="display:none">
    <div class="section-title">Pro — Per-Model Budgets</div>
    <div class="card" style="margin-bottom:14px">
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Cap daily or monthly spend on specific models. Requests are blocked once the limit is hit, independent of your global budget.</p>
      <div class="model-budget-row header">
        <span>Model</span><span>Daily limit ($)</span><span>Monthly limit ($)</span><span></span>
      </div>
      <div id="model-budget-list"></div>
      <hr class="divider">
      <p style="font-size:12px;font-weight:600;margin-bottom:10px">Add / update limit</p>
      <div class="model-budget-row">
        <div>
          <label>Model name</label>
          <input type="text" id="mb-model" placeholder="claude-opus-4-6">
        </div>
        <div>
          <label>Daily ($)</label>
          <input type="number" id="mb-daily" step="0.01" min="0" placeholder="—">
        </div>
        <div>
          <label>Monthly ($)</label>
          <input type="number" id="mb-monthly" step="0.01" min="0" placeholder="—">
        </div>
        <div style="padding-top:18px">
          <button onclick="addModelBudget()">Add</button>
        </div>
      </div>
      <div class="msg" id="mb-msg"></div>
    </div>
  </div>

  <!-- Upgrade / Activate prompt (shown when not Pro) -->
  <div id="upgrade-prompt" style="display:none;margin-top:8px">
    <div class="pro-gate">
      <h3>Unlock Pro features</h3>
      <p>Per-model budgets, 90-day history, custom alert thresholds, cost forecasting, and outbound webhooks.</p>
      <a href="https://buy.stripe.com/8x214ocjp83lapTafG2Fa01" target="_blank">Upgrade to Pro — $19/mo →</a>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">
        <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Already purchased? Enter your purchase email to activate.</p>
        <div style="display:flex;gap:8px;max-width:420px;margin:0 auto">
          <input type="email" id="activate-email" placeholder="you@example.com" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12)">
          <button onclick="activatePro()" style="white-space:nowrap">Activate Pro</button>
        </div>
        <div class="msg" id="activate-msg" style="margin-top:8px"></div>
      </div>
    </div>
  </div>

</main>
<script>
function fmt(usd) {
  if (usd == null || isNaN(usd)) return '$0.0000';
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return '$' + (usd * 100).toFixed(2) + '¢';
  return '$' + usd.toFixed(4);
}
function fmtNum(n) { return n == null ? '0' : Number(n).toLocaleString(); }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function barColor(pct) {
  if (pct >= 0.9) return 'var(--danger)';
  if (pct >= 0.7) return 'var(--warn)';
  return 'var(--accent)';
}

let isPro = false;

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    isPro = data.pro?.active ?? false;
    document.getElementById('pro-badge').style.display = isPro ? '' : 'none';
    document.getElementById('pro-alert-section').style.display = isPro ? '' : 'none';
    document.getElementById('pro-model-budget-section').style.display = isPro ? '' : 'none';
    document.getElementById('upgrade-prompt').style.display = isPro ? 'none' : '';

    const historyDays = data.pro?.history_days ?? 30;
    document.getElementById('month-card-title').textContent = 'This Month (' + historyDays + 'd)';
    document.getElementById('model-table-title').textContent = 'Cost by Model (' + historyDays + 'd)';
    document.getElementById('history-title').textContent = historyDays + '-Day History';

    // Today
    const todayCost = data.today?.cost ?? 0;
    const dailyBudget = data.budgets?.daily ?? 5;
    document.getElementById('today-cost').textContent = fmt(todayCost);
    document.getElementById('today-sub').textContent = fmtNum(data.today?.requests) + ' requests';
    document.getElementById('today-requests').textContent = fmtNum(data.today?.requests);
    document.getElementById('today-tokens').textContent = fmtNum((data.today?.input_tokens ?? 0) + (data.today?.output_tokens ?? 0)) + ' tokens';
    const todayPct = Math.min(todayCost / dailyBudget, 1);
    const todayBar = document.getElementById('today-bar');
    todayBar.style.width = (todayPct * 100) + '%';
    todayBar.style.background = barColor(todayPct);
    document.getElementById('today-budget-label').textContent = fmt(todayCost) + ' / ' + fmt(dailyBudget);

    // Month
    const monthCost = data.month?.cost ?? 0;
    const monthlyBudget = data.budgets?.monthly ?? 50;
    document.getElementById('month-cost').textContent = fmt(monthCost);
    document.getElementById('month-sub').textContent = fmtNum(data.month?.requests) + ' requests';
    const monthPct = Math.min(monthCost / monthlyBudget, 1);
    const monthBar = document.getElementById('month-bar');
    monthBar.style.width = (monthPct * 100) + '%';
    monthBar.style.background = barColor(monthPct);
    document.getElementById('month-budget-label').textContent = fmt(monthCost) + ' / ' + fmt(monthlyBudget);

    // Forecast
    const fc = data.forecast ?? {};
    document.getElementById('forecast-projected').textContent = fmt(fc.projected_month_end ?? 0);
    document.getElementById('forecast-sub').textContent = fmt(fc.daily_rate ?? 0) + ' / day avg';
    document.getElementById('forecast-mtd').textContent = fmt(fc.mtd_spend ?? 0);
    document.getElementById('forecast-days').textContent = ((fc.days_in_month ?? 30) - (fc.days_elapsed ?? 0)) + ' days';

    // History chart
    const chart = document.getElementById('history-chart');
    chart.innerHTML = '';
    const history = data.history ?? [];
    const maxCost = Math.max(...history.map(h => h.cost), 0.0001);
    history.slice(-30).forEach(h => {
      const pct = Math.max(h.cost / maxCost, 0.02);
      const label = h.date.slice(5);
      chart.innerHTML += \`<div class="bar-wrap">
        <div class="bar" style="height:\${Math.round(pct*100)}%" title="\${fmt(h.cost)} · \${h.date}"></div>
        <div class="bar-label">\${label}</div>
      </div>\`;
    });
    if (history.length === 0) chart.innerHTML = '<div class="empty" style="width:100%">No history yet</div>';

    // Models table
    const modelBody = document.getElementById('model-body');
    if (data.byModel?.length) {
      modelBody.innerHTML = data.byModel.map(m => \`<tr>
        <td><span class="model-tag">\${m.model}</span></td>
        <td>\${fmtNum(m.requests)}</td>
        <td>\${fmtNum((m.input_tokens ?? 0) + (m.output_tokens ?? 0))}</td>
        <td>\${fmt(m.cost)}</td>
      </tr>\`).join('');
    } else {
      modelBody.innerHTML = '<tr><td colspan="4" class="empty">No data yet — make some API calls!</td></tr>';
    }

    // Sessions table
    const sessionBody = document.getElementById('session-body');
    if (data.bySessions?.length) {
      sessionBody.innerHTML = data.bySessions.map(s => \`<tr>
        <td style="font-family:monospace;font-size:11px">\${s.session_id.slice(0, 18)}</td>
        <td>\${fmtNum(s.requests)}</td>
        <td>\${fmt(s.cost)}</td>
        <td>\${fmtTime(s.last_ts)}</td>
      </tr>\`).join('');
    } else {
      sessionBody.innerHTML = '<tr><td colspan="4" class="empty">No sessions today</td></tr>';
    }

    // Budget inputs
    document.getElementById('input-daily').value = data.budgets?.daily ?? 5;
    document.getElementById('input-monthly').value = data.budgets?.monthly ?? 50;

    // Pro threshold
    if (isPro && data.pro?.warning_threshold != null) {
      document.getElementById('input-threshold').value = data.pro.warning_threshold;
    }

    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();

    if (isPro) loadModelBudgets();
  } catch (e) {
    console.error(e);
  }
}

async function saveBudgets() {
  const daily = parseFloat(document.getElementById('input-daily').value);
  const monthly = parseFloat(document.getElementById('input-monthly').value);
  if (isNaN(daily) || isNaN(monthly)) return;
  await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ daily, monthly }) });
  flash('budget-msg', 'Saved!');
  loadStats();
}

async function loadAlertSettings() {
  try {
    const res = await fetch('/api/alerts/settings');
    const data = await res.json();
    document.getElementById('input-slack').value = data.slack_webhook_url || '';
    document.getElementById('input-discord').value = data.discord_webhook_url || '';
    document.getElementById('input-email').value = data.alert_email || '';
    if (data.resend_api_key) document.getElementById('input-resend').placeholder = data.resend_api_key;
    if (data.alert_webhook_url) document.getElementById('input-webhook').value = data.alert_webhook_url;
    if (data.alert_threshold_warning != null) document.getElementById('input-threshold').value = data.alert_threshold_warning;

    setpill('slack-status', !!data.slack_webhook_url);
    setpill('discord-status', !!data.discord_webhook_url);
    setpill('email-status', !!(data.alert_email && data.resend_api_key));
  } catch {}
}

function setpill(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = on ? 'Active' : 'Not configured';
  el.className = 'status-pill ' + (on ? 'on' : 'off');
}

async function saveAlerts() {
  const payload = {};
  const slack = document.getElementById('input-slack').value.trim();
  const discord = document.getElementById('input-discord').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const resend = document.getElementById('input-resend').value.trim();
  if (slack !== undefined) payload.slack_webhook_url = slack;
  if (discord !== undefined) payload.discord_webhook_url = discord;
  if (email !== undefined) payload.alert_email = email;
  if (resend && !resend.startsWith('•')) payload.resend_api_key = resend;
  await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  flash('alert-msg', 'Saved!');
  loadAlertSettings();
}

async function saveProAlerts() {
  const threshold = parseInt(document.getElementById('input-threshold').value);
  const webhook = document.getElementById('input-webhook').value.trim();
  const payload = {};
  if (!isNaN(threshold) && threshold > 0 && threshold < 100) payload.alert_threshold_warning = String(threshold);
  if (webhook) payload.alert_webhook_url = webhook;
  await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  flash('pro-alert-msg', 'Saved!');
}

async function testAlert() {
  flash('alert-msg', 'Sending test...');
  try {
    await fetch('/api/alerts/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    flash('alert-msg', 'Test sent!');
  } catch {
    flash('alert-msg', 'Test failed.', true);
  }
}

// ── Per-model budgets (Pro) ─────────────────────────────────────────────

async function loadModelBudgets() {
  try {
    const res = await fetch('/api/budgets/models');
    if (!res.ok) return;
    const data = await res.json();
    const list = document.getElementById('model-budget-list');
    if (!data.budgets?.length) {
      list.innerHTML = '<div class="empty" style="padding:12px 0">No model limits set — all models share the global budget.</div>';
      return;
    }
    list.innerHTML = data.budgets.map(b => \`
      <div class="model-budget-row" style="align-items:center">
        <span class="model-tag" style="display:inline-block">\${b.model}</span>
        <span style="font-size:13px">\${b.daily_limit != null ? fmt(b.daily_limit) + '/day' : '—'}</span>
        <span style="font-size:13px">\${b.monthly_limit != null ? fmt(b.monthly_limit) + '/mo' : '—'}</span>
        <button class="danger" onclick="removeModelBudget('\${b.model}')">Remove</button>
      </div>
    \`).join('');
  } catch {}
}

async function addModelBudget() {
  const model = document.getElementById('mb-model').value.trim();
  const daily = parseFloat(document.getElementById('mb-daily').value) || null;
  const monthly = parseFloat(document.getElementById('mb-monthly').value) || null;
  if (!model) { flash('mb-msg', 'Model name required.', true); return; }
  if (!daily && !monthly) { flash('mb-msg', 'Set at least one limit.', true); return; }
  await fetch('/api/budgets/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, daily_limit: daily, monthly_limit: monthly }) });
  document.getElementById('mb-model').value = '';
  document.getElementById('mb-daily').value = '';
  document.getElementById('mb-monthly').value = '';
  flash('mb-msg', 'Saved!');
  loadModelBudgets();
}

async function removeModelBudget(model) {
  await fetch('/api/budgets/models/' + encodeURIComponent(model), { method: 'DELETE' });
  loadModelBudgets();
}

async function activatePro() {
  const email = document.getElementById('activate-email').value.trim();
  if (!email) { flash('activate-msg', 'Enter your purchase email.', true); return; }
  flash('activate-msg', 'Checking subscription...');
  try {
    const res = await fetch('/api/billing/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.ok) {
      flash('activate-msg', data.message);
      setTimeout(() => loadStats(), 1500);
    } else {
      flash('activate-msg', data.message, true);
    }
  } catch {
    flash('activate-msg', 'Activation failed — check your connection.', true);
  }
}

function flash(id, msg, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--danger)' : 'var(--accent)';
  setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 2500);
}

loadStats();
loadAlertSettings();
setInterval(loadStats, 10000);
</script>
</body>
</html>`;
}
