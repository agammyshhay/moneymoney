import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { ProgressBar } from 'react-bootstrap';
import { useConfigStore } from '../store/ConfigStore';

const LABEL = 'מוריד כרום כדי ששמות המשתמש והסיסמאות ישארו רק על המחשב שלך';

const ChromeDownloadProgress = () => {
  const configStore = useConfigStore();

  useEffect(() => {
    if (configStore.chromeDownloadPercent === 100) {
      const timer = setTimeout(() => {
        configStore.updateChromeDownloadPercent(0);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [configStore, configStore.chromeDownloadPercent]);

  if (!configStore.chromeDownloadPercent) {
    return null;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '28px',
        backgroundColor: '#f0f2f5',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <ProgressBar
        now={configStore.chromeDownloadPercent}
        label={LABEL}
        className="w-100"
        style={{ height: '100%', fontSize: '0.8rem', borderRadius: '4px' }}
      />
    </div>
  );
};

export default observer(ChromeDownloadProgress);
