import { configFilePath } from '@/app-globals';
import { getConfig, updateConfig } from '@/backend/configManager/configManager';
// [CUSTOM-STARTUP-START]
import { app } from 'electron';
import { platform } from 'node:process';
// [CUSTOM-STARTUP-END]

export async function getConfigHandler(): Promise<string> {
  const config = await getConfig();
  return JSON.stringify({ config });
}

export async function updateConfigHandler(_: unknown, configStr: string) {
  const config = JSON.parse(configStr);
  await updateConfig(configFilePath, config);
  // [CUSTOM-STARTUP-START]
  // Apply runAtStartup setting immediately
  if (platform === 'win32' && import.meta.env.PROD) {
    const runAtStartup = config.runAtStartup ?? true;
    const appFolder = app.getPath('exe');
    app.setLoginItemSettings({
      openAtLogin: runAtStartup,
      path: appFolder,
      args: ['--hidden'],
    });
  }
  // [CUSTOM-STARTUP-END]
}
