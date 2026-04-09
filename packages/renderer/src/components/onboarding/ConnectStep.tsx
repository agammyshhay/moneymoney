// [CUSTOM-ONBOARDING-START]
import { openExternal, hasBase44Token, onBase44TokenReceived, getBase44ConnectUrl } from '#preload';
import { useState, useEffect, useCallback } from 'react';
import styles from './ConnectStep.module.css';

interface ConnectStepProps {
  onSkipStep: () => void;
  onConnected?: () => void;
}

export default function ConnectStep({ onSkipStep, onConnected }: ConnectStepProps) {
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [waitingForToken, setWaitingForToken] = useState(false);

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

  const handleConnect = async () => {
    setWaitingForToken(true);
    const url = await getBase44ConnectUrl();
    openExternal(url);
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

      <button type="button" className={styles.skipStepLink} onClick={onSkipStep}>
        אגדיר אחר כך
      </button>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
