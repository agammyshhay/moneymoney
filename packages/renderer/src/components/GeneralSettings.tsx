import { observer } from 'mobx-react-lite';
import { Card, Form } from 'react-bootstrap';
import { useConfigStore } from '../store/ConfigStore';
import styles from './GeneralSettings.module.css';
import Base44Settings from './Base44Settings';
// [CUSTOM-UPDATE-START]
import CheckForUpdates from './CheckForUpdates';
// [CUSTOM-UPDATE-END]

function GeneralSettings() {
  const configStore = useConfigStore();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function _toggleShowBrowser() {
    configStore.toggleShowBrowser();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleTimeoutChanged = (timeout: string) => {
    const numberTimeout = Number(timeout);
    if (numberTimeout) {
      configStore.setTimeout(numberTimeout);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Card.Body className={styles.cardBody}>
          <Form>
            {/* [CUSTOM-BASE44-START] - Base44 Settings Component */}
            <Base44Settings />
            {/* [CUSTOM-BASE44-END] */}

            {/* [CUSTOM-STARTUP-START] */}
            <Form.Group className="mt-3">
              <Form.Check
                type="switch"
                id="run-at-startup-switch"
                label="פתח אוטומטית בהפעלת המחשב"
                checked={configStore.config?.runAtStartup ?? true}
                onChange={() => configStore.toggleRunAtStartup()}
              />
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Check
                type="switch"
                id="minimize-to-tray-switch"
                label="מזער למגש המערכת בסגירה"
                checked={configStore.config?.minimizeToTray ?? true}
                onChange={() => configStore.toggleMinimizeToTray()}
              />
            </Form.Group>
            {/* [CUSTOM-STARTUP-END] */}

            {/* [CUSTOM-UPDATE-START] */}
            <Form.Group className="mt-3">
              <Form.Label className="fw-bold">עדכוני תוכנה</Form.Label>
              <CheckForUpdates />
            </Form.Group>
            {/* [CUSTOM-UPDATE-END] */}
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default observer(GeneralSettings);
