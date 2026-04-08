import electron from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';

export const App: Electron.App = electron.app;

if (import.meta.env.MODE !== 'production') {
  // Use app.getAppPath() for absolute resolution — path.resolve('userData')
  // would resolve relative to CWD, which is C:\WINDOWS\system32 when launched
  // via protocol handler (deep link).
  const localUserData = path.resolve(App.getAppPath(), 'userData');
  mkdirSync(localUserData, { recursive: true });
  App.setPath('userData', localUserData);
}

export const userDataPath = App.getPath('userData');
export const configFilePath = path.resolve(userDataPath, 'config.encrypt');
