import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/app-globals', () => ({ userDataPath: '', configFilePath: 'config.json' }));
vi.mock('electron', () => ({ app: { getPath: vi.fn(), setLoginItemSettings: vi.fn() } }));
vi.mock('@/backend/configManager/configManager', () => ({ getConfig: vi.fn(), updateConfig: vi.fn() }));

import { getConfig, updateConfig } from '@/backend/configManager/configManager';
import { type Config } from '@/backend/commonTypes';
import { updateChromiumPath, updateConfigHandler } from './configHandlers';

const makeConfig = (chromiumPath?: string) =>
  ({
    outputVendors: {},
    scraping: { accountsToScrape: [], chromiumPath },
  }) as unknown as Config;

beforeEach(() => {
  vi.mocked(getConfig).mockReset();
  vi.mocked(updateConfig).mockReset();
});

describe('config handlers chromiumPath', () => {
  test('renderer save without chromiumPath keeps the one on disk', async () => {
    vi.mocked(getConfig).mockResolvedValue(makeConfig('C:/chrome.exe'));

    await updateConfigHandler(undefined, JSON.stringify(makeConfig()));

    const saved = vi.mocked(updateConfig).mock.calls[0][1] as Config;
    expect(saved.scraping.chromiumPath).toBe('C:/chrome.exe');
  });

  test('updateChromiumPath writes the new path', async () => {
    vi.mocked(getConfig).mockResolvedValue(makeConfig());

    await updateChromiumPath('C:/new/chrome.exe');

    const saved = vi.mocked(updateConfig).mock.calls[0][1] as Config;
    expect(saved.scraping.chromiumPath).toBe('C:/new/chrome.exe');
  });
});
