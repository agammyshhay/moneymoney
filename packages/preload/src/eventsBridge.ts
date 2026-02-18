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

export async function getYnabAccountData(ynabOptions: YnabConfig['options']): Promise<YnabAccountDataType> {
  return electron.ipcRenderer.invoke('getYnabAccountData', ynabOptions);
}

export async function scrape(handleScrapingEvent: HandleScrapingEvent, config?: Config) {
  // [CUSTOM-FIX-START]
  // Reset listener to ensure we use the latest callback and avoid duplicates
  electron.ipcRenderer.removeAllListeners('scrapingProgress');

  electron.ipcRenderer.on('scrapingProgress', (_, progressEventStr) => {
    const progressEvent = JSON.parse(progressEventStr);
    const { eventName, eventData } = progressEvent;
    console.log('Received scraping progress event', eventName, eventData);
    handleScrapingEvent(eventName, eventData);
  });

  console.log('Sending scrape event to main');
  await electron.ipcRenderer.send('scrape', config);
  // [CUSTOM-FIX-END]
}

export async function stopPeriodicScraping() {
  return electron.ipcRenderer.invoke('stopPeriodicScraping');
}

export async function openExternal(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    console.warn('Blocked openExternal for non-http URL:', url);
    return;
  }
  await electron.shell.openExternal(url);
}

export async function openItem(filePath: string) {
  const dangerous = /\.(exe|bat|cmd|com|msi|ps1|vbs|js|wsf|scr)$/i;
  if (dangerous.test(filePath)) {
    console.warn('Blocked openItem for dangerous file type:', filePath);
    return;
  }
  await electron.shell.openPath(filePath);
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
