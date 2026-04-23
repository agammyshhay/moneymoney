import electron from 'electron';
import {
  type Config,
  type Credentials,
  type HandleScrapingEvent,
  type YnabAccountDataType,
  type YnabConfig,
} from './commonTypes';

export async function getConfig(): Promise<Config> {
  const configStr = await electron.ipcRenderer.invoke('getConfig');
  const { config } = JSON.parse(configStr);
  return config;
}

export async function updateConfig(config: Config) {
  await electron.ipcRenderer.invoke('updateConfig', JSON.stringify(config));
}

// [CUSTOM-FIX-START] — Send credentials directly to main, bypassing MobX store
export async function updateImporterCredentials(accountId: string, loginFields: Record<string, string>) {
  await electron.ipcRenderer.invoke('updateImporterCredentials', accountId, JSON.stringify(loginFields));
}
// [CUSTOM-FIX-END]

export async function getYnabAccountData(ynabOptions: YnabConfig['options']): Promise<YnabAccountDataType> {
  return electron.ipcRenderer.invoke('getYnabAccountData', ynabOptions);
}

export async function scrape(handleScrapingEvent: HandleScrapingEvent, accountIdFilter?: string) {
  // [CUSTOM-FIX-START]
  // Security: renderer no longer sends a Config (with credentials) to main. Main loads config
  // from disk; renderer can only optionally filter to a single account by id.
  // Reset listener to ensure we use the latest callback and avoid duplicates
  electron.ipcRenderer.removeAllListeners('scrapingProgress');

  electron.ipcRenderer.on('scrapingProgress', (_, progressEventStr) => {
    const progressEvent = JSON.parse(progressEventStr);
    const { eventName, eventData } = progressEvent;
    console.log('Received scraping progress event', eventName, eventData);
    handleScrapingEvent(eventName, eventData);
  });

  console.log('Sending scrape event to main');
  await electron.ipcRenderer.send('scrape', accountIdFilter);
  // [CUSTOM-FIX-END]
}

export async function stopPeriodicScraping() {
  return electron.ipcRenderer.invoke('stopPeriodicScraping');
}

// Shell operations are proxied to the main process via IPC so the renderer can run under
// sandbox: true. Main process performs authoritative validation (see handlers/index.ts).
export async function openExternal(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    console.warn('Blocked openExternal for non-http URL:', url);
    return;
  }
  await electron.ipcRenderer.invoke('openExternal', url);
}

export async function openItem(filePath: string) {
  await electron.ipcRenderer.invoke('openItem', filePath);
}

export async function getLogsInfo(numOfLastLines: number) {
  return electron.ipcRenderer.invoke('getLogsInfo', numOfLastLines);
}

export async function checkForUpdate() {
  return electron.ipcRenderer.invoke('checkForUpdate');
}

export async function getAppInfo() {
  return electron.ipcRenderer.invoke('getAppInfo');
}

export async function downloadUpdate() {
  return electron.ipcRenderer.invoke('downloadUpdate');
}

export async function showSaveDialog() {
  return electron.ipcRenderer.invoke('showSaveDialog');
}

export async function quitAndInstall() {
  console.log('preload invoking quitAndInstall');
  return electron.ipcRenderer.invoke('quitAndInstall');
}

// Google Sheets
export async function validateToken(credentials: Credentials): Promise<boolean> {
  return electron.ipcRenderer.invoke('validateToken', credentials);
}
export async function getAllUserSpreadsheets(credentials: Credentials) {
  return electron.ipcRenderer.invoke('getAllUserSpreadsheets', credentials);
}
export async function electronGoogleOAuth2Connector(): Promise<Credentials> {
  return electron.ipcRenderer.invoke('electronGoogleOAuth2Connector');
}
export async function createSpreadsheet(spreadsheetId: string, credentials: Credentials): Promise<string> {
  return electron.ipcRenderer.invoke('createSpreadsheet', spreadsheetId, credentials);
}

// [CUSTOM-UPDATE-START]
export async function getUpdateStatus(): Promise<{ status: string; version?: string } | null> {
  return electron.ipcRenderer.invoke('getUpdateStatus');
}

export function onUpdateStatus(callback: (data: { status: string; version?: string }) => void): () => void {
  const handler = (_: unknown, dataStr: string) => {
    callback(JSON.parse(dataStr));
  };
  electron.ipcRenderer.on('updateStatus', handler);
  return () => {
    electron.ipcRenderer.removeListener('updateStatus', handler);
  };
}
// [CUSTOM-UPDATE-END]

export async function testBase44Connection(): Promise<{ ok: boolean; status: number; error?: string; body?: string }> {
  return electron.ipcRenderer.invoke('testBase44Connection');
}

export async function syncJsonToBase44(): Promise<{ ok: boolean; count?: number; error?: string }> {
  return electron.ipcRenderer.invoke('syncJsonToBase44');
}

// [CUSTOM-BASE44-START]
export async function hasBase44Token(): Promise<boolean> {
  return electron.ipcRenderer.invoke('hasBase44Token');
}

export async function clearBase44Token(): Promise<{ ok: boolean }> {
  return electron.ipcRenderer.invoke('clearBase44Token');
}

export async function getBase44ConnectUrl(): Promise<string> {
  return electron.ipcRenderer.invoke('getBase44ConnectUrl');
}

export function onBase44TokenReceived(callback: () => void): () => void {
  const handler = () => callback();
  electron.ipcRenderer.on('base44-token-received', handler);
  return () => {
    electron.ipcRenderer.removeListener('base44-token-received', handler);
  };
}

export function onBase44TokenExpired(callback: () => void): () => void {
  const handler = () => callback();
  electron.ipcRenderer.on('base44-token-expired', handler);
  return () => {
    electron.ipcRenderer.removeListener('base44-token-expired', handler);
  };
}
// [CUSTOM-BASE44-END]

export async function cancelScrape(): Promise<void> {
  return electron.ipcRenderer.invoke('cancelScrape');
}

export async function getDataFolder(): Promise<string> {
  return electron.ipcRenderer.invoke('getDataFolder');
}
