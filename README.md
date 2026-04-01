# ClawCost

Real-time token cost tracking and budget enforcement proxy for any LLM API.

Sits between your app and OpenAI, Anthropic, Gemini, DeepSeek, or any OpenAI-compatible API. Tracks every token, enforces daily/monthly budgets, and shows a live dashboard — drop it in with a one-line config change, no code changes required.

## Quick Start

```bash
npm install
npm run dev
```

Point your app's LLM base URL to ClawCost:

```
http://localhost:4100/v1
```

**Dashboard:** http://localhost:4100

### Claude Code / OpenClaw

Add to `~/.openclaw/.env`:

```
ANTHROPIC_BASE_URL=http://localhost:4100/v1
```

### OpenAI SDK

```python
client = OpenAI(base_url="http://localhost:4100/v1", api_key=os.environ["OPENAI_API_KEY"])
```

### Any OpenAI-compatible provider

Set your SDK's `base_url` or `OPENAI_BASE_URL` env var to `http://localhost:4100/v1`. ClawCost routes to the correct upstream automatically based on the model name.

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `CLAWCOST_PORT` | `4100` | Proxy port |
| `CLAWCOST_DAILY_BUDGET` | `5.00` | Daily spend limit (USD) |
| `CLAWCOST_MONTHLY_BUDGET` | `50.00` | Monthly spend limit (USD) |
| `CLAWCOST_DATA_DIR` | `~/.clawcost` | SQLite database location |

Budgets can also be updated live in the dashboard without restarting.

## How it works

1. Your app sends API requests to `http://localhost:4100/v1` instead of the provider directly
2. ClawCost checks current spend against your budgets — blocks with HTTP 429 if exceeded
3. Forwards the request upstream and streams the response back with zero added latency
4. Parses SSE events to extract token usage without buffering
5. Saves usage + cost to a local SQLite database (`~/.clawcost/usage.db`)

## ClawCost Pro

[ClawCost Pro](https://getclawcost.com) ($19/mo) adds:

- **Per-model budgets** — set independent limits for each model
- **90-day history** — longer usage trends and cost analysis
- **Spend forecasting** — projected month-end cost based on current burn rate
- **Custom alert thresholds** — trigger warnings at any % of budget, not just 80%
- **Outbound webhooks** — POST alerts to Slack, Discord, or any endpoint

After purchasing, enter your email in the Pro panel on the dashboard to activate.

## Production build

```bash
npm run build
npm start
```

## Data

All usage is stored locally at `~/.clawcost/usage.db` (SQLite). No data leaves your machine.

## License

MIT — [Modology Studios](https://modology.dev)
