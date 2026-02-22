import { getConfig } from '#preload';
import { runInAction } from 'mobx';
import { useEffect } from 'react';
import { type Config } from '../types';
import { AppInfoStoreProvider, useInitAppInfoStore } from './AppInfoStore';
import { ConfigStoreProvider, configStore } from './ConfigStore';
import Store, { StoreProvider } from './Store';

export { useAppInfoStore } from './AppInfoStore';
export { useStore } from './Store';

const store = new Store();

export const StoresProvider = ({ children }: { children: React.ReactNode }) => {
  useInitAppInfoStore();
  // TODO: create useInitConfigStore
  useEffect(() => {
    getConfig()
      .then((config) => {
        configStore.updateConfig(config as Config);
      })
      .catch((e) => {
        console.error('Failed to load config, using defaults', e);
        runInAction(() => {
          configStore.configLoaded = true;
        });
      });
  }, []);
  return (
    <StoreProvider value={store}>
      <ConfigStoreProvider>
        <AppInfoStoreProvider>{children}</AppInfoStoreProvider>
      </ConfigStoreProvider>
    </StoreProvider>
  );
};
