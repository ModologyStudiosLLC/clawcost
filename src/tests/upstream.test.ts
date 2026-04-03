import { describe, it, expect } from 'vitest';

// Extract resolveUpstream logic for isolated testing
interface Upstream {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  pathPrefix: string;
  name: string;
}

function resolveUpstream(authHeader: string | undefined): Upstream {
  const key = authHeader?.replace(/^Bearer\s+/i, '') ?? '';

  if (key === 'metaclaw' || key.startsWith('sk-swesle')) {
    return { protocol: 'http', host: '127.0.0.1', port: 30000, pathPrefix: '', name: 'metaclaw' };
  }
  if (key.startsWith('sk-or-')) {
    return { protocol: 'https', host: 'openrouter.ai', port: 443, pathPrefix: '/api', name: 'openrouter' };
  }
  if (key.startsWith('sk-56557') || key.startsWith('sk-deepseek')) {
    return { protocol: 'https', host: 'api.deepseek.com', port: 443, pathPrefix: '', name: 'deepseek' };
  }
  if (authHeader && (key.startsWith('sk-ant') || key.startsWith('sk-proj'))) {
    return { protocol: 'https', host: 'api.anthropic.com', port: 443, pathPrefix: '', name: 'anthropic' };
  }
  return { protocol: 'https', host: 'api.openai.com', port: 443, pathPrefix: '', name: 'openai' };
}

describe('resolveUpstream', () => {
  it('routes Anthropic sk-ant keys to api.anthropic.com', () => {
    const up = resolveUpstream('Bearer sk-ant-abc123');
    expect(up.host).toBe('api.anthropic.com');
    expect(up.name).toBe('anthropic');
    expect(up.pathPrefix).toBe('');
  });

  it('routes Anthropic sk-proj keys to api.anthropic.com', () => {
    const up = resolveUpstream('Bearer sk-proj-xyz');
    expect(up.host).toBe('api.anthropic.com');
    expect(up.name).toBe('anthropic');
  });

  it('routes OpenRouter sk-or- keys to openrouter.ai with /api prefix', () => {
    const up = resolveUpstream('Bearer sk-or-v1-abc123');
    expect(up.host).toBe('openrouter.ai');
    expect(up.name).toBe('openrouter');
    expect(up.pathPrefix).toBe('/api');
    expect(up.protocol).toBe('https');
    expect(up.port).toBe(443);
  });

  it('routes DeepSeek keys to api.deepseek.com', () => {
    const up = resolveUpstream('Bearer sk-deepseek-abc');
    expect(up.host).toBe('api.deepseek.com');
    expect(up.name).toBe('deepseek');
  });

  it('routes metaclaw literal key to local port 30000', () => {
    const up = resolveUpstream('Bearer metaclaw');
    expect(up.host).toBe('127.0.0.1');
    expect(up.port).toBe(30000);
    expect(up.protocol).toBe('http');
    expect(up.name).toBe('metaclaw');
  });

  it('routes sk-swesle prefix to metaclaw', () => {
    const up = resolveUpstream('Bearer sk-swesle-xyz');
    expect(up.name).toBe('metaclaw');
  });

  it('defaults to OpenAI for unknown keys', () => {
    const up = resolveUpstream('Bearer sk-unknown-key');
    expect(up.host).toBe('api.openai.com');
    expect(up.name).toBe('openai');
  });

  it('defaults to OpenAI when no auth header', () => {
    const up = resolveUpstream(undefined);
    expect(up.name).toBe('openai');
  });

  it('handles case-insensitive Bearer prefix', () => {
    const up = resolveUpstream('bearer sk-ant-abc');
    expect(up.name).toBe('anthropic');
  });

  it('OpenRouter path builds correct full URL', () => {
    // When proxy appends /v1/chat/completions to pathPrefix /api
    // result should be /api/v1/chat/completions on openrouter.ai
    const up = resolveUpstream('Bearer sk-or-v1-test');
    const fullPath = up.pathPrefix + '/v1/chat/completions';
    expect(fullPath).toBe('/api/v1/chat/completions');
  });
});
