import { Browser, computeExecutablePath, detectBrowserPlatform, install, resolveBuildId } from '@puppeteer/browsers';
import { existsSync, readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import logger from '/@/logging/logger';
import { initProxyIfNeeded, tearDownProxy } from './proxyConfig';

type PuppeteerProgressCallback = (downloadBytes: number, totalBytes: number) => void;
type PercentCallback = (percent: number) => void;

let isCached = true;
const getIntegerPercent = (callback: PercentCallback): PuppeteerProgressCallback => {
  isCached = false;
  let prevPercent = -1;

  return (downloadBytes: number, totalBytes: number) => {
    const p = Math.floor((downloadBytes / totalBytes) * 100);
    if (p > prevPercent) {
      prevPercent = p;
      callback(p);
    }
  };
};

let downloadProm: ReturnType<typeof downloadChromium> | null = null;

export default async function downloadChromium(installPath: string, onProgress?: PercentCallback): Promise<string> {
  if (downloadProm) return downloadProm;

  const progressCallback = onProgress && getIntegerPercent(onProgress);

  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error(`Cannot download a binary for the provided platform: ${os.platform()} (${os.arch()})`);
  }

  // Check if a previously downloaded Chromium version exists in cache before resolving 'latest'
  const browserDir = path.join(installPath, 'chromium', `${platform}`);
  if (existsSync(browserDir)) {
    try {
      const cached = readdirSync(browserDir);
      if (cached.length > 0) {
        const cachedBuildId = cached[cached.length - 1];
        const execPath = computeExecutablePath({
          cacheDir: installPath,
          browser: Browser.CHROMIUM,
          buildId: cachedBuildId,
        });
        if (existsSync(execPath)) {
          logger.log('Using cached Chromium at', execPath);
          return execPath;
        }
      }
    } catch (e) {
      logger.log('Failed to check cached Chromium, will download', e);
    }
  }

  const buildId = await resolveBuildId(Browser.CHROMIUM, platform, 'latest');

  logger.log(`Browser: ${Browser.CHROMIUM}, Platform: ${platform}, Tag: stable, BuildId: ${buildId}`);

  initProxyIfNeeded();

  const installOptions = {
    cacheDir: installPath,
    browser: Browser.CHROMIUM,
    buildId,
    downloadProgressCallback: progressCallback,
  };

  downloadProm = install(installOptions)
    .then(({ executablePath }) => {
      downloadProm = null;
      if (!isCached) {
        logger.log('Chromium downloaded to', executablePath);
      } else {
        logger.log('Chromium cached at', executablePath);
      }
      isCached = true;

      // Clean up old Chromium builds to prevent disk accumulation
      try {
        const browserDir = path.join(installPath, 'chromium', `${platform}`);
        if (existsSync(browserDir)) {
          const dirs = readdirSync(browserDir);
          for (const dir of dirs) {
            if (dir !== buildId) {
              const oldDir = path.join(browserDir, dir);
              rmSync(oldDir, { recursive: true, force: true });
              logger.log('Cleaned up old Chromium build:', dir);
            }
          }
        }
      } catch (e) {
        logger.log('Failed to clean up old Chromium builds', e);
      }

      return executablePath;
    })
    .finally(() => {
      tearDownProxy();
    });

  return downloadProm!;
}
