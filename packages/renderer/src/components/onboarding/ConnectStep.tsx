// [CUSTOM-ONBOARDING-START]
import { openExternal, testBase44Connection, hasBase44Token, onBase44TokenReceived } from '#preload';
import { useState, useEffect, useCallback } from 'react';
import { Button, Form, Collapse } from 'react-bootstrap';
import { useConfigStore } from '../../store/ConfigStore';
import styles from './ConnectStep.module.css';

const CONNECT_URL = 'https://moneym.base44.app/desktop-connect-code';

interface ConnectStepProps {
  onSkipStep: () => void;
  onConnected?: () => void;
}

export default function ConnectStep({ onSkipStep, onConnected }: ConnectStepProps) {
  const configStore = useConfigStore();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [waitingForToken, setWaitingForToken] = useState(false);

  const uuid = configStore.config?.outputVendors?.json?.options?.base44UserUuid ?? '';

  const checkToken = useCallback(async () => {
    const result = await hasBase44Token();
    setHasToken(result);
    if (result && onConnected) {
      onConnected();
    }
  }, [onConnected]);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  useEffect(() => {
    const unsub = onBase44TokenReceived(() => {
      setHasToken(true);
      setWaitingForToken(false);
      setTestResult({ ok: true, message: 'החיבור הצליח!' });
      if (onConnected) {
        onConnected();
      }
    });
    return unsub;
  }, [onConnected]);

  const handleUuidChange = (value: string) => {
    configStore.setBase44UserUuid(value);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testBase44Connection();
      if (res.ok) {
        setTestResult({ ok: true, message: 'החיבור הצליח!' });
      } else {
        setTestResult({ ok: false, message: `החיבור נכשל: ${res.error ?? `סטטוס ${res.status}`}` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: `שגיאת בדיקה: ${(e as Error).message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = () => {
    setWaitingForToken(true);
    openExternal(CONNECT_URL);
  };

  // Connected via Bearer token
  if (hasToken) {
    return (
      <div className={styles.container}>
        <div className={styles.connectedCard}>
          <div className={styles.connectedIconWrapper}>
            <i className={`bi bi-check-lg ${styles.connectedCheckIcon}`}></i>
          </div>
          <h3 className={styles.connectedTitle}>מחובר בהצלחה!</h3>
          <p className={styles.connectedSubtitle}>החשבון מחובר ומוכן לסנכרון אוטומטי</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <div className={styles.heroIconWrapper}>
          <i className={`bi bi-link-45deg ${styles.heroIcon}`}></i>
        </div>
        <h3 className={styles.header}>חיבור החשבון</h3>
        <p className={styles.description}>היכנסו לחשבון ואשרו את החיבור</p>
      </div>

      <button type="button" className={styles.connectButton} onClick={handleConnect}>
        <i className={`bi bi-box-arrow-up-left ${styles.connectButtonIcon}`}></i>
        לחצו לחיבור
      </button>

      {waitingForToken && !testResult && (
        <div className={styles.waitingBanner}>
          <span className={styles.waitingSpinner}></span>
          ממתין לאישור מהאתר...
        </div>
      )}

      {testResult && (
        <div className={testResult.ok ? styles.successBanner : styles.errorBanner}>
          <i className={`bi ${testResult.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
          {testResult.message}
        </div>
      )}

      {/* Manual fallback (collapsible) */}
      <div className={styles.manualSection}>
        <button type="button" className={styles.manualToggle} onClick={() => setShowManualConnect(!showManualConnect)}>
          חיבור ידני באמצעות קוד
          <i className={`bi bi-chevron-${showManualConnect ? 'up' : 'down'} ${styles.chevronIcon}`} />
        </button>
        <Collapse in={showManualConnect}>
          <div className={styles.manualContent}>
            <Form.Group className={styles.inputGroup}>
              <Form.Label className={styles.label}>קוד חיבור</Form.Label>
              <div className={styles.inputWrapper}>
                <Form.Control
                  type="password"
                  className={styles.input}
                  placeholder="הדבק כאן את הקוד מאזור ההגדרות באתר"
                  value={uuid}
                  onChange={(e) => handleUuidChange(e.target.value)}
                />
              </div>
            </Form.Group>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !uuid.trim()}
              className={styles.testButton}
            >
              {isTesting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  &nbsp;בודק...
                </>
              ) : (
                'בדוק חיבור'
              )}
            </Button>
          </div>
        </Collapse>
      </div>

      <button type="button" className={styles.skipStepLink} onClick={onSkipStep}>
        אגדיר אחר כך
      </button>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
