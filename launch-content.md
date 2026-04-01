# ClawCost Launch Content — Ready to Publish
## March 31, 2026

**Landing page:** https://getclawcost.com (pending DNS)
**Backup URL:** https://clawcost-delta.vercel.app
**GitHub:** https://github.com/ModologyStudiosLLC/clawcost

---

## Show HN Post

**Title:** Show HN: ClawCost – never get a surprise AI bill

**Body:**

Hey HN,

I got tired of surprise AI bills, so I built a transparent proxy that sits between my tools and the API providers.

ClawCost is an open-source proxy that routes your Anthropic and OpenAI API calls through a local server. It tracks every token, shows you a live dashboard, and blocks requests when you hit your budget.

How it works:
1. Point OpenClaw (or any tool) at http://localhost:4100/v1 instead of api.anthropic.com
2. ClawCost forwards the request, parses the SSE stream to extract token usage
3. Saves everything to a local SQLite database
4. Shows a live dashboard with spend per model, per session, per day

The key feature that makes it different: it doesn't just track costs, it helps you optimize them. It detects when you're using Opus for tasks Haiku could handle, flags runaway sessions, and suggests cheaper models for each task type.

All data stays local. No cloud, no telemetry, no account required.

Given the recent GitHub Copilot PR ads situation and Anthropic usage caps, I think there's a real need for transparent cost control. This is my attempt at solving it for myself — sharing because I think others might find it useful.

GitHub: https://github.com/ModologyStudiosLLC/clawcost
Demo: https://getclawcost.com

Happy to answer any questions.

---

## Reddit r/selfhosted Post

**Title:** Built an open-source proxy to track and cap AI API costs — all data stays local

**Body:**

I was getting surprise bills from Anthropic and OpenAI, so I built a transparent proxy that sits between my tools and their APIs.

ClawCost is a local proxy (Node.js/Fastify) that:
- Routes API calls through localhost
- Tracks every token in real-time via SSE parsing
- Shows a live dashboard with spend per model and session
- Enforces daily/monthly budgets — blocks with HTTP 429 when exceeded
- Detects wasteful patterns ("you're using Opus for 340-token responses")
- Stores everything in local SQLite — no data leaves your machine

It works with any tool that uses the Anthropic or OpenAI API. Setup is literally one line in your .env file.

Free and open source: https://github.com/ModologyStudiosLLC/clawcost

Would love feedback from the self-hosted community.

---

## Reddit r/LocalLLaMA Post

**Title:** Open-source cost tracking for hybrid local/cloud AI setups

**Body:**

With Ollama now supporting MLX on Apple Silicon, more people are running hybrid setups — local inference for some tasks, cloud APIs for others.

I built ClawCost to track costs across both. It's a transparent proxy that sits between your tools and the API providers, tracking every token and enforcing budgets.

Key features:
- Works with Anthropic and OpenAI APIs
- Per-model, per-session cost tracking
- Budget enforcement (block when you hit your limit)
- Smart suggestions ("Haiku would cost 95% less for this task type")
- All data in local SQLite — nothing leaves your machine

For local inference costs, it can estimate based on electricity and hardware amortization (coming soon).

GitHub: https://github.com/ModologyStudiosLLC/clawcost

---

## Twitter Thread

**Tweet 1 (hook):**
GitHub just injected ads into PRs without telling anyone.

Anthropic cut usage caps.

AI tool pricing is a mess.

So I built an open-source proxy that shows you exactly where your money goes — and helps you spend less.

ClawCost: getclawcost.com

**Tweet 2 (how it works):**
How it works:

1. Point your AI tools at localhost:4100 instead of api.anthropic.com
2. ClawCost tracks every token in real-time
3. Shows a live dashboard with spend per model
4. Blocks requests when you hit your budget
5. Detects waste: "You're using Opus for tasks Haiku could handle"

**Tweet 3 (the harness):**
The differentiator: it doesn't just track costs, it optimizes them.

• Flags when expensive models are overkill
• Detects runaway sessions burning money
• Suggests the cheapest model for each task type
• Tracks cost-per-session, not just per-model

"ClawCost doesn't just show you where your money goes — it helps you spend less."

**Tweet 4 (open source):**
All data stays local. No cloud, no telemetry, no account.

Open source on GitHub: github.com/ModologyStudiosLLC/clawcost

Works with any tool using Anthropic or OpenAI APIs. One line of config to set up.

**Tweet 5 (CTA):**
Given everything happening with AI pricing right now, I think transparent cost control matters more than ever.

Try it: getclawcost.com
Star it: github.com/ModologyStudiosLLC/clawcost

---

## LinkedIn Post

Just shipped something I've been wanting for a while: transparent AI cost control.

GitHub Copilot is injecting ads into PRs. Anthropic cut usage caps. AI tool pricing is getting opaque and metered.

I built ClawCost — an open-source proxy that sits between your AI tools and the API providers. It tracks every token, shows a live dashboard, and blocks requests when you hit your budget.

But the real value isn't tracking — it's optimization. ClawCost detects when you're using expensive models for simple tasks and suggests cheaper alternatives. "You're using Opus for 340-token responses. Haiku would cost 95% less."

All data stays local. No cloud, no telemetry, no account required.

Free and open source: getclawcost.com

If you're building with AI APIs, I'd love your feedback.

#AI #OpenSource #DeveloperTools #CostOptimization #Anthropic #OpenAI
