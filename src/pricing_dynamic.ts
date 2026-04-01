/**
 * Dynamic Pricing Module
 *
 * Loads model pricing from a JSON config file instead of hardcoding.
 * Allows updating prices without code changes.
 *
 * Config file: ~/.clawcost/pricing.json
 * Falls back to built-in defaults if file doesn't exist.
 * API endpoint: POST /api/pricing — update pricing at runtime
 */

import fs from 'fs';
import path from 'path';
import { config as appConfig } from './config.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ModelPricing {
  input: number;    // USD per million tokens
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

// ── Built-in Defaults ────────────────────────────────────────────────────

const DEFAULTS: Record<string, ModelPricing> = {
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
  'o1-mini':                      { input: 1.10, output: 4.40, cacheRead: 0.55,  cacheWrite: 0     },
  'o3-mini':                      { input: 1.10, output: 4.40, cacheRead: 0.55,  cacheWrite: 0     },
  // Gemini
  'gemini-2.5-pro':               { input: 1.25, output: 10,  cacheRead: 0.31,  cacheWrite: 0     },
  'gemini-2.0-flash':             { input: 0.10, output: 0.40, cacheRead: 0.025, cacheWrite: 0    },
};

const FALLBACK: ModelPricing = { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 };

// ── Runtime pricing store ─────────────────────────────────────────────────

let pricing: Record<string, ModelPricing> = { ...DEFAULTS };
let lastLoaded: number = 0;

const PRICING_FILE = path.join(appConfig.dataDir, 'pricing.json');

/**
 * Load pricing from disk. Falls back to defaults if file doesn't exist.
 */
export function loadPricing(): void {
  try {
    if (fs.existsSync(PRICING_FILE)) {
      const raw = fs.readFileSync(PRICING_FILE, 'utf-8');
      const loaded = JSON.parse(raw) as Record<string, ModelPricing>;

      // Validate structure
      for (const [model, p] of Object.entries(loaded)) {
        if (typeof p.input !== 'number' || typeof p.output !== 'number') {
          console.warn(`[ClawCost] Invalid pricing for ${model}, using default`);
          continue;
        }
        pricing[model] = {
          input: p.input,
          output: p.output,
          cacheRead: p.cacheRead ?? 0,
          cacheWrite: p.cacheWrite ?? 0,
        };
      }

      lastLoaded = Date.now();
      console.log(`[ClawCost] Loaded ${Object.keys(loaded).length} model prices from ${PRICING_FILE}`);
    } else {
      console.log(`[ClawCost] No pricing file found, using built-in defaults (${Object.keys(DEFAULTS).length} models)`);
    }
  } catch (err) {
    console.error(`[ClawCost] Failed to load pricing file: ${err}. Using defaults.`);
  }
}

/**
 * Save current pricing to disk.
 */
export function savePricing(): void {
  try {
    if (!fs.existsSync(appConfig.dataDir)) {
      fs.mkdirSync(appConfig.dataDir, { recursive: true });
    }
    fs.writeFileSync(PRICING_FILE, JSON.stringify(pricing, null, 2));
    console.log(`[ClawCost] Saved ${Object.keys(pricing).length} model prices to ${PRICING_FILE}`);
  } catch (err) {
    console.error(`[ClawCost] Failed to save pricing: ${err}`);
  }
}

/**
 * Update pricing for a specific model at runtime.
 */
export function updatePricing(model: string, p: Partial<ModelPricing>): void {
  const existing = pricing[model] ?? { ...FALLBACK };
  pricing[model] = {
    input: p.input ?? existing.input,
    output: p.output ?? existing.output,
    cacheRead: p.cacheRead ?? existing.cacheRead,
    cacheWrite: p.cacheWrite ?? existing.cacheWrite,
  };
  savePricing();
}

/**
 * Get pricing for a model (with prefix matching fallback).
 */
export function getPricing(model: string): ModelPricing {
  if (pricing[model]) return pricing[model];

  // Try prefix match
  for (const [key, p] of Object.entries(pricing)) {
    if (model.startsWith(key) || key.startsWith(model.split('-').slice(0, 4).join('-'))) {
      return p;
    }
  }

  return FALLBACK;
}

/**
 * Calculate cost for a request.
 */
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

/**
 * Format cost for display.
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

/**
 * Get all pricing (for API/export).
 */
export function getAllPricing(): Record<string, ModelPricing> {
  return { ...pricing };
}

/**
 * Get pricing metadata.
 */
export function getPricingMeta(): {
  modelCount: number;
  lastLoaded: number | null;
  source: string;
} {
  return {
    modelCount: Object.keys(pricing).length,
    lastLoaded: lastLoaded || null,
    source: fs.existsSync(PRICING_FILE) ? 'file' : 'defaults',
  };
}

// Auto-load on import
loadPricing();
