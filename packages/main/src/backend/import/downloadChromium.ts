import {
  Browser,
  type BrowserPlatform,
  detectBrowserPlatform,
  getInstalledBrowsers,
  install,
  resolveBuildId,
} from '@puppeteer/browsers';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import os from 'os';
import logger from '/@/logging/logger';
import { initProxyIfNeeded, tearDownProxy } from './proxyConfig';

type PuppeteerProgressCallback = (downloadBytes: number, totalBytes: number) => void;
type PercentCallback = (percent: number) => void;

const getIntegerPercent = (callback: PercentCallback): PuppeteerProgressCallback => {
  let prevPercent = -1;

  return (downloadBytes: number, totalBytes: number) => {
    const p = Math.floor((downloadBytes / totalBytes) * 100);
    if (p > prevPercent) {
      prevPercent = p;
      callback(p);
    }
  };
};

const byBuildIdDesc = (a: { buildId: string }, b: { buildId: string }) => Number(b.buildId) - Number(a.buildId);

// [CUSTOM-FIX-START] — Reuse an installed Chromium instead of downloading 'latest' on every run.
// @puppeteer/browsers installs to <cacheDir>/chromium/<platform>-<buildId>/, so we ask it
// for installed builds rather than guessing the folder layout.
async function findInstalledChromium(installPath: string, platform: BrowserPlatform) {
  try {
    const installed = await getInstalledBrowsers({ cacheDir: installPath });
    return installed
      .filter((b) => b.browser === Browser.CHROMIUM && b.platform === platform && existsSync(b.executablePath))
      .sort(byBuildIdDesc)[0];
  } catch (e) {
    logger.log('Failed to check cached Chromium, will download', e);
    return undefined;
  }
}

// Uses async fs.rm rather than @puppeteer/browsers' uninstall(), which deletes with a blocking
// rmSync — removing many ~300MB builds that way would freeze the main process.
async function removeOtherChromiumBuilds(installPath: string, platform: BrowserPlatform, keepBuildId: string) {
  let installed;
  try {
    installed = await getInstalledBrowsers({ cacheDir: installPath });
  } catch (e) {
    logger.log('Failed to list Chromium builds for cleanup', e);
    return;
  }
  for (const b of installed) {
    if (b.browser !== Browser.CHROMIUM || b.platform !== platform || b.buildId === keepBuildId) continue;
    try {
      await rm(b.path, { recursive: true, force: true });
      logger.log('Cleaned up old Chromium build:', b.buildId);
    } catch (e) {
      logger.log('Failed to clean up old Chromium build', b.buildId, e);
    }
  }
}
// [CUSTOM-FIX-END]

let downloadProm: Promise<string> | null = null;

export default function downloadChromium(installPath: string, onProgress?: PercentCallback): Promise<string> {
  if (!downloadProm) {
    downloadProm = getOrInstallChromium(installPath, onProgress).finally(() => {
      downloadProm = null;
    });
  }
  return downloadProm;
}

async function getOrInstallChromium(installPath: string, onProgress?: PercentCallback): Promise<string> {
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error(`Cannot download a binary for the provided platform: ${os.platform()} (${os.arch()})`);
  }

  const cached = await findInstalledChromium(installPath, platform);
  if (cached) {
    logger.log('Using cached Chromium at', cached.executablePath);
    void removeOtherChromiumBuilds(installPath, platform, cached.buildId);
    return cached.executablePath;
  }

  initProxyIfNeeded();
  try {
    const buildId = await resolveBuildId(Browser.CHROMIUM, platform, 'latest');
    logger.log(`Browser: ${Browser.CHROMIUM}, Platform: ${platform}, Tag: latest, BuildId: ${buildId}`);

    const { executablePath } = await install({
      cacheDir: installPath,
      browser: Browser.CHROMIUM,
      buildId,
      downloadProgressCallback: onProgress && getIntegerPercent(onProgress),
    });
    logger.log('Chromium downloaded to', executablePath);

    void removeOtherChromiumBuilds(installPath, platform, buildId);
    return executablePath;
  } finally {
    tearDownProxy();
  }
}
