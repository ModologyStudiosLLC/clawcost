# ClawCost

Real-time token cost tracking and budget enforcement proxy for OpenClaw.

Sits between OpenClaw and Anthropic/OpenAI. Tracks every token, enforces daily/monthly budgets, and shows a live dashboard — no OpenClaw plugins required.

## Setup

```bash
npm install
npm run dev
```

Then add one line to `~/.openclaw/.env`:

```
ANTHROPIC_BASE_URL=http://localhost:4100/v1
```

Restart OpenClaw. All Anthropic API calls now route through ClawCost.

**Dashboard:** http://localhost:4100

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

1. OpenClaw sends API requests to `http://localhost:4100/v1` instead of `api.anthropic.com`
2. ClawCost checks current spend against your budgets — blocks with HTTP 429 if exceeded
3. Forwards the request upstream and streams the response back with zero added latency
4. Parses SSE events to extract token usage without buffering
5. Saves usage + cost to a local SQLite database (`~/.clawcost/usage.db`)

## Adding OpenAI support

Add to `~/.openclaw/.env`:

```
OPENAI_BASE_URL=http://localhost:4100/v1
```

Or in `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "openai": { "baseUrl": "http://localhost:4100/v1" }
    }
  }
}
```

## Production build

```bash
npm run build
npm start
```

## Data

All usage is stored locally at `~/.clawcost/usage.db` (SQLite). No data leaves your machine.
