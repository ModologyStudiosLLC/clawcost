import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factory runs (which is hoisted)
const { mockGetSetting, mockShouldSendAlert, mockMarkAlertSent, mockHasActiveLicense } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockShouldSendAlert: vi.fn(),
  mockMarkAlertSent: vi.fn(),
  mockHasActiveLicense: vi.fn(),
}));

vi.mock('../db.js', () => ({
  getSetting: mockGetSetting,
  shouldSendAlert: mockShouldSendAlert,
  markAlertSent: mockMarkAlertSent,
  hasActiveLicense: mockHasActiveLicense,
}));

// Mock fetch globally so no real HTTP calls happen
const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
vi.stubGlobal('fetch', mockFetch);

import { checkAndAlert } from '../alerts.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockHasActiveLicense.mockReturnValue(false);
  mockShouldSendAlert.mockReturnValue(true);
  mockGetSetting.mockReturnValue(undefined);
});

describe('checkAndAlert', () => {
  it('does not fire when under budget', async () => {
    await checkAndAlert(2, 5, 20, 50);
    expect(mockMarkAlertSent).not.toHaveBeenCalled();
  });

  it('fires daily warning at 80% (free tier)', async () => {
    // 4/5 = 80%
    await checkAndAlert(4, 5, 10, 50);
    const keys = mockMarkAlertSent.mock.calls.map(c => c[0]);
    expect(keys).toContain('alert_daily_warning');
  });

  it('fires daily blocked at 100%', async () => {
    await checkAndAlert(5, 5, 10, 50);
    const keys = mockMarkAlertSent.mock.calls.map(c => c[0]);
    expect(keys).toContain('alert_daily_blocked');
  });

  it('fires monthly warning at 80%', async () => {
    await checkAndAlert(1, 5, 40, 50);
    const keys = mockMarkAlertSent.mock.calls.map(c => c[0]);
    expect(keys).toContain('alert_monthly_warning');
  });

  it('fires monthly blocked at 100%', async () => {
    await checkAndAlert(1, 5, 50, 50);
    const keys = mockMarkAlertSent.mock.calls.map(c => c[0]);
    expect(keys).toContain('alert_monthly_blocked');
  });

  it('does not fire when shouldSendAlert returns false (cooldown)', async () => {
    mockShouldSendAlert.mockReturnValue(false);
    await checkAndAlert(5, 5, 50, 50);
    expect(mockMarkAlertSent).not.toHaveBeenCalled();
  });

  it('uses Pro configurable threshold when licensed', async () => {
    mockHasActiveLicense.mockReturnValue(true);
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'alert_threshold_warning') return '90';
      return undefined;
    });
    // 85% — should NOT fire at 90% threshold
    await checkAndAlert(4.25, 5, 10, 50);
    const keys = mockMarkAlertSent.mock.calls.map(c => c[0]);
    expect(keys).not.toContain('alert_daily_warning');
  });

  it('fires Discord webhook when url is configured', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'discord_webhook_url') return 'https://discord.com/api/webhooks/test';
      return undefined;
    });
    await checkAndAlert(5, 5, 10, 50);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fires Slack webhook when url is configured', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'slack_webhook_url') return 'https://hooks.slack.com/test';
      return undefined;
    });
    await checkAndAlert(5, 5, 10, 50);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not fire Pro webhook on free tier', async () => {
    mockHasActiveLicense.mockReturnValue(false);
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'alert_webhook_url') return 'https://my-server.com/hook';
      return undefined;
    });
    await checkAndAlert(5, 5, 10, 50);
    const proWebhookCalls = mockFetch.mock.calls.filter(c => c[0] === 'https://my-server.com/hook');
    expect(proWebhookCalls.length).toBe(0);
  });
});
