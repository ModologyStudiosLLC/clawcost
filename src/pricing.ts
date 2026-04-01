// USD per million tokens
interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Claude 4.x
  'claude-opus-4-6':              { input: 15,   output: 75,  cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-sonnet-4-6':            { input: 3,    output: 15,  cacheRead: 0.30,  cacheWrite: 3.75  },
  // Claude 3.x
  'claude-3-5-sonnet-20241022':   { input: 3,    output: 15,  cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-3-5-haiku-20241022':    { input: 0.80, output: 4,   cacheRead: 0.08,  cacheWrite: 1.00  },
  'claude-haiku-4-5':             { input: 0.80, output: 4,   cacheRead: 0.08,  cacheWrite: 1.00  },
  'claude-3-opus-20240229':       { input: 15,   output: 75,  cacheRead: 1.50,  cacheWrite: 18.75 },
  // OpenAI
  'gpt-4o':                       { input: 2.50, output: 10,  cacheRead: 1.25,  cacheWrite: 0     },
  'gpt-4o-mini':                  { input: 0.15, output: 0.60, cacheRead: 0.075, cacheWrite: 0    },
  'gpt-4-turbo':                  { input: 10,   output: 30,  cacheRead: 0,     cacheWrite: 0     },
  'o1':                           { input: 15,   output: 60,  cacheRead: 7.50,  cacheWrite: 0     },
  'o1-mini':                      { input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 0     },
  'o3-mini':                      { input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 0     },
  // Gemini
  'gemini-2.5-pro':               { input: 1.25, output: 10,  cacheRead: 0.31,  cacheWrite: 0     },
  'gemini-2.0-flash':             { input: 0.10, output: 0.40, cacheRead: 0.025, cacheWrite: 0    },
  // MiMo / Xiaomi (per million tokens)
  'mimo-v2-pro':                  { input: 1,    output: 3,   cacheRead: 0.20,  cacheWrite: 0     },
  // DeepSeek
  'deepseek-chat':                { input: 0.27, output: 1.10, cacheRead: 0.07,  cacheWrite: 0    },
  'deepseek-reasoner':            { input: 0.55, output: 2.19, cacheRead: 0.14,  cacheWrite: 0    },
  // ZAI / GLM (free tier — $0 cost)
  'glm-5':                        { input: 0,    output: 0,   cacheRead: 0,     cacheWrite: 0     },
  'glm-4.7':                      { input: 0,    output: 0,   cacheRead: 0,     cacheWrite: 0     },
  'glm-4.7-flash':                { input: 0,    output: 0,   cacheRead: 0,     cacheWrite: 0     },
  'glm-4.7-flashx':               { input: 0,    output: 0,   cacheRead: 0,     cacheWrite: 0     },
};

// Fallback by prefix matching
const FALLBACK: ModelPricing = { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 };

export function getPricing(model: string): ModelPricing {
  if (PRICING[model]) return PRICING[model];
  // Try prefix match (e.g. "claude-sonnet-4-6-20251022" → "claude-sonnet-4-6")
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (model.startsWith(key) || key.startsWith(model.split('-').slice(0, 4).join('-'))) {
      return pricing;
    }
  }
  return FALLBACK;
}

export function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number {
  const p = getPricing(model);
  return (
    (inputTokens * p.input +
      outputTokens * p.output +
      cacheReadTokens * p.cacheRead +
      cacheWriteTokens * p.cacheWrite) /
    1_000_000
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}
