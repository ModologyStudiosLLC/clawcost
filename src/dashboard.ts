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
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
  header { padding: 20px 32px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 600; }
  header .tag { font-size: 11px; background: var(--accent); color: #000; padding: 2px 8px; border-radius: 99px; font-weight: 700; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent); animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  main { padding: 32px; max-width: 1100px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
  .card-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 12px; }
  .big-num { font-size: 36px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .sub-num { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .budget-bar { height: 6px; background: var(--border); border-radius: 3px; margin-top: 12px; overflow: hidden; }
  .budget-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
  .budget-label { font-size: 11px; color: var(--muted); margin-top: 6px; display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: 600; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .model-tag { font-size: 11px; background: rgba(59,130,246,0.15); color: var(--blue); padding: 2px 8px; border-radius: 4px; font-family: monospace; }
  .history-chart { display: flex; align-items: flex-end; gap: 6px; height: 80px; padding-top: 8px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
  .bar { width: 100%; background: var(--accent); border-radius: 3px 3px 0 0; opacity: 0.8; min-height: 2px; transition: opacity 0.2s; }
  .bar:hover { opacity: 1; }
  .bar-label { font-size: 10px; color: var(--muted); }
  .settings-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  input[type=number] { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); font-size: 14px; }
  input[type=number]:focus, input[type=text]:focus, input[type=email]:focus, input[type=password]:focus { outline: none; border-color: var(--accent); }
  input[type=text], input[type=email], input[type=password] { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); font-size: 14px; }
  button { padding: 8px 16px; background: var(--accent); color: #000; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 4px; }
  button:hover { opacity: 0.85; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); }
  button.ghost:hover { border-color: var(--text); color: var(--text); }
  .empty { color: var(--muted); text-align: center; padding: 24px; font-size: 13px; }
  #last-updated { margin-left: auto; font-size: 12px; color: var(--muted); }
  .alerts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .input-row { display: flex; gap: 8px; align-items: flex-end; }
  .input-row input { flex: 1; }
  .channel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .channel-title { font-size: 13px; font-weight: 600; color: var(--text); }
  .status-pill { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
  .status-pill.on  { background: rgba(34,197,94,0.15);  color: var(--accent); }
  .status-pill.off { background: rgba(115,115,115,0.12); color: var(--muted); }
</style>
</head>
<body>
<header>
  <div class="status-dot" id="status-dot"></div>
  <h1>ClawCost</h1>
  <span class="tag">PROXY ACTIVE</span>
  <span id="last-updated">Loading...</span>
</header>
<main>
  <div class="grid-2">
    <div class="card" id="card-today">
      <div class="card-title">Today's Spend</div>
      <div class="big-num" id="today-cost">—</div>
      <div class="sub-num" id="today-sub">— requests · — tokens</div>
      <div class="budget-bar"><div class="budget-fill" id="today-bar" style="width:0%"></div></div>
      <div class="budget-label"><span>Daily budget</span><span id="today-budget-label">—</span></div>
    </div>
    <div class="card">
      <div class="card-title">This Month (30 days)</div>
      <div class="big-num" id="month-cost">—</div>
      <div class="sub-num" id="month-sub">— requests</div>
      <div class="budget-bar"><div class="budget-fill" id="month-bar" style="width:0%"></div></div>
      <div class="budget-label"><span>Monthly budget</span><span id="month-budget-label">—</span></div>
    </div>
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-title">7-Day History</div>
      <div class="history-chart" id="history-chart"></div>
    </div>
    <div class="card">
      <div class="card-title">Budget Settings</div>
      <div class="settings-form">
        <div>
          <label>Daily Budget (USD)</label>
          <input type="number" id="input-daily" step="0.01" min="0" placeholder="5.00">
        </div>
        <div>
          <label>Monthly Budget (USD)</label>
          <input type="number" id="input-monthly" step="0.01" min="0" placeholder="50.00">
        </div>
      </div>
      <button onclick="saveBudgets()">Save Budgets</button>
      <div id="budget-msg" style="font-size:12px;color:var(--accent);margin-top:8px;height:16px"></div>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Alert Settings</div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Get notified at 80% and 100% of your daily and monthly budgets.</p>
    <div class="alerts-grid">

      <div>
        <div class="channel-header">
          <span class="channel-title">Slack</span>
          <span class="status-pill off" id="slack-status">Not configured</span>
        </div>
        <label>Webhook URL</label>
        <div class="input-row" style="margin-bottom:8px">
          <input type="text" id="input-slack" placeholder="https://hooks.slack.com/services/...">
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="saveAlerts()">Save</button>
          <button class="ghost" onclick="testAlert('slack')">Send test</button>
        </div>
      </div>

      <div>
        <div class="channel-header">
          <span class="channel-title">Email</span>
          <span class="status-pill off" id="email-status">Not configured</span>
        </div>
        <label>Alert email</label>
        <input type="email" id="input-email" placeholder="you@example.com" style="margin-bottom:8px">
        <label>Resend API key</label>
        <div class="input-row" style="margin-bottom:8px">
          <input type="password" id="input-resend" placeholder="re_••••••••">
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="saveAlerts()">Save</button>
          <button class="ghost" onclick="testAlert('email')">Send test</button>
        </div>
      </div>

    </div>
    <div id="alert-msg" style="font-size:12px;color:var(--accent);margin-top:12px;height:16px"></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">Cost by Model (30 days)</div>
      <table id="model-table">
        <thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cost</th></tr></thead>
        <tbody id="model-body"><tr><td colspan="4" class="empty">No data yet</td></tr></tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Recent Sessions (today)</div>
      <table id="session-table">
        <thead><tr><th>Session</th><th>Requests</th><th>Cost</th><th>Last</th></tr></thead>
        <tbody id="session-body"><tr><td colspan="4" class="empty">No data yet</td></tr></tbody>
      </table>
    </div>
  </div>
</main>
<script>
function fmt(usd) {
  if (usd == null || isNaN(usd)) return '$0.0000';
  if (usd < 0.01) return '$' + (usd * 100).toFixed(3) + '¢';
  return '$' + usd.toFixed(4);
}
function fmtNum(n) { return n == null ? '0' : Number(n).toLocaleString(); }
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function barColor(pct) {
  if (pct >= 0.9) return 'var(--danger)';
  if (pct >= 0.7) return 'var(--warn)';
  return 'var(--accent)';
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    // Today
    const todayCost = data.today?.cost ?? 0;
    const dailyBudget = data.budgets?.daily ?? 5;
    const monthCost = data.month?.cost ?? 0;
    const monthlyBudget = data.budgets?.monthly ?? 50;

    document.getElementById('today-cost').textContent = fmt(todayCost);
    document.getElementById('today-sub').textContent =
      fmtNum(data.today?.requests) + ' requests · ' +
      fmtNum((data.today?.input_tokens ?? 0) + (data.today?.output_tokens ?? 0)) + ' tokens';

    const todayPct = Math.min(todayCost / dailyBudget, 1);
    const todayBar = document.getElementById('today-bar');
    todayBar.style.width = (todayPct * 100) + '%';
    todayBar.style.background = barColor(todayPct);
    document.getElementById('today-budget-label').textContent = fmt(todayCost) + ' / ' + fmt(dailyBudget);

    // Month
    document.getElementById('month-cost').textContent = fmt(monthCost);
    document.getElementById('month-sub').textContent = fmtNum(data.month?.requests) + ' requests';
    const monthPct = Math.min(monthCost / monthlyBudget, 1);
    const monthBar = document.getElementById('month-bar');
    monthBar.style.width = (monthPct * 100) + '%';
    monthBar.style.background = barColor(monthPct);
    document.getElementById('month-budget-label').textContent = fmt(monthCost) + ' / ' + fmt(monthlyBudget);

    // History chart
    const chart = document.getElementById('history-chart');
    chart.innerHTML = '';
    const history = data.history ?? [];
    const maxCost = Math.max(...history.map(h => h.cost), 0.0001);
    history.forEach(h => {
      const pct = Math.max(h.cost / maxCost, 0.02);
      const label = h.date.slice(5); // MM-DD
      chart.innerHTML += \`<div class="bar-wrap">
        <div class="bar" style="height:\${Math.round(pct*100)}%" title="\${fmt(h.cost)} on \${h.date}"></div>
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
        <td style="font-family:monospace;font-size:12px">\${s.session_id.slice(0, 16)}</td>
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

    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById('status-dot').style.background = 'var(--danger)';
  }
}

async function saveBudgets() {
  const daily = parseFloat(document.getElementById('input-daily').value);
  const monthly = parseFloat(document.getElementById('input-monthly').value);
  if (isNaN(daily) || isNaN(monthly)) return;
  await fetch('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily, monthly })
  });
  const msg = document.getElementById('budget-msg');
  msg.textContent = 'Saved!';
  setTimeout(() => msg.textContent = '', 2000);
  loadStats();
}

async function loadAlertSettings() {
  try {
    const res = await fetch('/api/alerts/settings');
    const data = await res.json();
    document.getElementById('input-slack').value = data.slack_webhook_url || '';
    document.getElementById('input-email').value = data.alert_email || '';
    if (data.resend_api_key) document.getElementById('input-resend').placeholder = data.resend_api_key;

    const slackPill = document.getElementById('slack-status');
    const emailPill = document.getElementById('email-status');
    if (data.slack_webhook_url) { slackPill.textContent = 'Active'; slackPill.className = 'status-pill on'; }
    if (data.alert_email && data.resend_api_key) { emailPill.textContent = 'Active'; emailPill.className = 'status-pill on'; }
  } catch {}
}

async function saveAlerts() {
  const slack = document.getElementById('input-slack').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const resend = document.getElementById('input-resend').value.trim();
  const payload = {};
  if (slack) payload.slack_webhook_url = slack;
  if (email) payload.alert_email = email;
  if (resend && !resend.startsWith('•')) payload.resend_api_key = resend;
  await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const msg = document.getElementById('alert-msg');
  msg.textContent = 'Saved!';
  setTimeout(() => msg.textContent = '', 2000);
  loadAlertSettings();
}

async function testAlert(channel) {
  const msg = document.getElementById('alert-msg');
  msg.textContent = 'Sending test...';
  try {
    await fetch('/api/alerts/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }) });
    msg.textContent = 'Test sent! Check ' + channel + '.';
  } catch {
    msg.textContent = 'Test failed — check your settings.';
    msg.style.color = 'var(--danger)';
  }
  setTimeout(() => { msg.textContent = ''; msg.style.color = 'var(--accent)'; }, 3000);
}

loadStats();
loadAlertSettings();
setInterval(loadStats, 10000);
</script>
</body>
</html>`;
}
