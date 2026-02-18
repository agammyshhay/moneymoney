// [CUSTOM-UPDATE-START]
import { checkForUpdate, getUpdateStatus, onUpdateStatus, openExternal, quitAndInstall } from '#preload';
import { useEffect, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useAppInfoStore } from '../store';

const UPDATE_STATES = {
  INIT: 'INIT',
  LOADING: 'LOADING',
  ERROR: 'ERROR',
  DOWNLOADING: 'DOWNLOADING',
  NO_NEW_VERSION: 'NO_NEW_VERSION',
  READY_TO_INSTALL: 'READY_TO_INSTALL',
};

interface UpdateInfo {
  version: string;
}

function CheckForUpdates() {
  const [updateState, setUpdateState] = useState(UPDATE_STATES.INIT);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>();
  const store = useAppInfoStore();

  useEffect(() => {
    // Bug 3 fix: check if update already downloaded before mount
    getUpdateStatus()
      .then((status) => {
        if (status?.status === 'downloaded' && status.version) {
          setUpdateInfo({ version: status.version });
          setUpdateState(UPDATE_STATES.READY_TO_INSTALL);
        }
      })
      .catch(() => undefined);

    const cleanup = onUpdateStatus((data) => {
      if (data.status === 'downloaded' && data.version) {
        setUpdateInfo({ version: data.version });
        setUpdateState(UPDATE_STATES.READY_TO_INSTALL);
      } else if (data.status === 'error') {
        setUpdateState(UPDATE_STATES.ERROR);
      }
    });
    return cleanup;
  }, []);

  const checkForUpdates = async () => {
    setUpdateState(UPDATE_STATES.LOADING);
    try {
      const info = await checkForUpdate();
      if (info) {
        setUpdateInfo(info);
        // autoDownload is true, so download starts automatically
        setUpdateState(UPDATE_STATES.DOWNLOADING);
      } else {
        setUpdateState(UPDATE_STATES.NO_NEW_VERSION);
      }
    } catch (error) {
      console.error(error);
      setUpdateState(UPDATE_STATES.ERROR);
    }
  };

  const openGithubRelease = () => {
    openExternal(`${store.appInfo?.repository}/releases/tag/v${updateInfo?.version}`);
  };

  return (
    <div>
      {store.appInfo?.currentVersion && (
        <small className="text-muted d-block mb-2">גרסה נוכחית: {store.appInfo.currentVersion}</small>
      )}
      {updateState === UPDATE_STATES.INIT && (
        <Button variant="dark" size="sm" onClick={checkForUpdates}>
          בדיקת עדכונים
        </Button>
      )}
      {updateState === UPDATE_STATES.LOADING && <Spinner animation="border" size="sm" role="status" />}
      {updateState === UPDATE_STATES.NO_NEW_VERSION && <span className="text-muted">אין עדכונים זמינים</span>}
      {updateState === UPDATE_STATES.ERROR && (
        <div>
          <span className="text-danger">שגיאה בבדיקת עדכונים</span>{' '}
          <Button variant="outline-dark" size="sm" onClick={checkForUpdates}>
            נסה שוב
          </Button>
        </div>
      )}
      {updateState === UPDATE_STATES.DOWNLOADING && (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>מוריד גרסה {updateInfo?.version}...</span>
        </div>
      )}
      {updateState === UPDATE_STATES.READY_TO_INSTALL && (
        <div className="d-flex align-items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => quitAndInstall()}>
            יציאה והתקנה
          </Button>
          <Button variant="outline-dark" size="sm" onClick={openGithubRelease}>
            פרטי הגרסה
          </Button>
        </div>
      )}
    </div>
  );
}

export default CheckForUpdates;
// [CUSTOM-UPDATE-END]
