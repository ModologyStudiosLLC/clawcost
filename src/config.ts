import fs from 'fs';
import path from 'path';
import os from 'os';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Load .env from current dir and ~/.clawcost/.env
loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(os.homedir(), '.clawcost', '.env'));

export const config = {
  proxyPort: parseInt(process.env.CLAWCOST_PORT ?? '4100'),
  dailyBudgetUsd: parseFloat(process.env.CLAWCOST_DAILY_BUDGET ?? '5.00'),
  monthlyBudgetUsd: parseFloat(process.env.CLAWCOST_MONTHLY_BUDGET ?? '50.00'),
  dataDir: process.env.CLAWCOST_DATA_DIR ?? path.join(os.homedir(), '.clawcost'),
};
