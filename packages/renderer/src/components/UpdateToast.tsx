// [CUSTOM-UPDATE-START]
import { getUpdateStatus, onUpdateStatus, quitAndInstall } from '#preload';
import { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import styles from './UpdateToast.module.css';

function UpdateToast() {
  const [version, setVersion] = useState<string>();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if an update was already downloaded before mount
    getUpdateStatus()
      .then((status) => {
        if (status?.status === 'downloaded' && status.version) {
          setVersion(status.version);
          setVisible(true);
        }
      })
      .catch(() => undefined);

    // Listen for future update status events
    const cleanup = onUpdateStatus((data) => {
      if (data.status === 'downloaded' && data.version) {
        setVersion(data.version);
        setVisible(true);
      }
    });

    return cleanup;
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.toastContainer}>
      <Alert variant="info" className={styles.toast} dismissible onClose={() => setVisible(false)}>
        <i className="bi bi-download" />
        <span>גרסה {version} הורדה ותותקן בסגירה הבאה</span>
        <Button size="sm" variant="primary" onClick={() => quitAndInstall()}>
          התקן עכשיו
        </Button>
      </Alert>
    </div>
  );
}

export default UpdateToast;
// [CUSTOM-UPDATE-END]
