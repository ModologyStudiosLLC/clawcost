/**
 * Dashboard Authentication Middleware
 *
 * Simple API key auth for dashboard endpoints.
 * If CLAWCOST_DASHBOARD_KEY is set, all dashboard API routes require
 * Authorization: Bearer <key> header.
 *
 * Proxy routes (/v1/*) are NOT protected — they're localhost-only
 * and need to work without auth for OpenClaw to function.
 */

import { config } from './config.js';

export function requireDashboardAuth(req: any, reply: any, done: () => void): void {
  // If no dashboard key is set, allow all (backwards compatible)
  if (!config.dashboardKey) {
    done();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      error: {
        type: 'auth_required',
        message: 'Dashboard API key required. Set CLAWCOST_DASHBOARD_KEY in .env and pass Authorization: Bearer <key>',
      },
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  if (token !== config.dashboardKey) {
    reply.code(403).send({
      error: {
        type: 'invalid_key',
        message: 'Invalid dashboard API key.',
      },
    });
    return;
  }

  done();
}

/**
 * Generate a random API key for initial setup.
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'cc_'; // ClawCost prefix
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}
