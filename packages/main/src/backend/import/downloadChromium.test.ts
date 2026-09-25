import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('/@/logging/logger', () => ({
  default: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./proxyConfig', () => ({ initProxyIfNeeded: vi.fn(), tearDownProxy: vi.fn() }));

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));
vi.mock('fs/promises', () => ({ rm: vi.fn() }));

vi.mock('@puppeteer/browsers', () => ({
  Browser: { CHROMIUM: 'chromium', CHROME: 'chrome' },
  detectBrowserPlatform: vi.fn(() => 'win64'),
  getInstalledBrowsers: vi.fn(),
  install: vi.fn(),
  resolveBuildId: vi.fn(),
}));

import { getInstalledBrowsers, install, resolveBuildId } from '@puppeteer/browsers';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import downloadChromium from './downloadChromium';

const installed = (buildId: string, browser = 'chromium', platform = 'win64') => ({
  browser,
  platform,
  buildId,
  path: `C:/cache/${browser}/${platform}-${buildId}`,
  executablePath: `C:/cache/${browser}/${platform}-${buildId}/chrome.exe`,
});

// Cleanup runs in the background; let its awaits settle before asserting on it.
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.mocked(getInstalledBrowsers).mockReset();
  vi.mocked(install).mockReset();
  vi.mocked(resolveBuildId).mockReset();
  vi.mocked(rm).mockReset();
  vi.mocked(existsSync).mockReturnValue(true);
});

describe('downloadChromium', () => {
  test('returns the newest installed build without touching the network, and removes older builds', async () => {
    vi.mocked(getInstalledBrowsers).mockResolvedValue([
      installed('900'),
      installed('1200'),
      installed('1500', 'chrome'),
      installed('1400', 'chromium', 'linux'),
    ] as never);

    await expect(downloadChromium('C:/cache')).resolves.toBe('C:/cache/chromium/win64-1200/chrome.exe');
    await flush();
    expect(resolveBuildId).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(rm).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledWith('C:/cache/chromium/win64-900', expect.anything());
  });

  test('skips an installed build whose executable is missing', async () => {
    vi.mocked(getInstalledBrowsers).mockResolvedValue([installed('900'), installed('1200')] as never);
    vi.mocked(existsSync).mockImplementation((p) => !String(p).includes('1200'));

    await expect(downloadChromium('C:/cache')).resolves.toBe('C:/cache/chromium/win64-900/chrome.exe');
  });

  test('downloads when nothing is installed and removes other chromium builds', async () => {
    vi.mocked(getInstalledBrowsers)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([installed('900'), installed('1300'), installed('1500', 'chrome')] as never);
    vi.mocked(resolveBuildId).mockResolvedValue('1300');
    vi.mocked(install).mockResolvedValue({ executablePath: 'C:/cache/chromium/win64-1300/chrome.exe' } as never);

    await expect(downloadChromium('C:/cache')).resolves.toBe('C:/cache/chromium/win64-1300/chrome.exe');
    await flush();
    expect(install).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledWith('C:/cache/chromium/win64-900', expect.anything());
  });

  test('concurrent calls share one download', async () => {
    vi.mocked(getInstalledBrowsers).mockResolvedValue([]);
    vi.mocked(resolveBuildId).mockResolvedValue('1300');
    vi.mocked(install).mockResolvedValue({ executablePath: 'x' } as never);

    await Promise.all([downloadChromium('C:/cache'), downloadChromium('C:/cache')]);
    expect(install).toHaveBeenCalledOnce();
  });

  test('a failed download is retried on the next call instead of failing forever', async () => {
    vi.mocked(getInstalledBrowsers).mockResolvedValue([]);
    vi.mocked(resolveBuildId).mockResolvedValue('1300');
    vi.mocked(install)
      .mockRejectedValueOnce(new Error('read ECONNRESET'))
      .mockResolvedValueOnce({ executablePath: 'x' } as never);

    await expect(downloadChromium('C:/cache')).rejects.toThrow('ECONNRESET');
    await expect(downloadChromium('C:/cache')).resolves.toBe('x');
  });
});
