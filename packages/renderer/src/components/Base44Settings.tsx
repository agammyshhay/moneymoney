// [CUSTOM-BASE44-START]
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Button } from 'react-bootstrap';
import {
  testBase44Connection,
  syncJsonToBase44,
  updateConfig,
  hasBase44Token,
  clearBase44Token,
  onBase44TokenReceived,
  onBase44TokenExpired,
  openExternal,
  getBase44ConnectUrl,
} from '#preload';
import { useState, useEffect, useCallback } from 'react';
import { useConfigStore } from '../store/ConfigStore';
import styles from './Base44Settings.module.css';

function Base44Settings() {
  const configStore = useConfigStore();
  const [isTestingBase44, setIsTestingBase44] = useState(false);
  const [base44TestResult, setBase44TestResult] = useState<string>('');
  const [isSyncingBase44, setIsSyncingBase44] = useState(false);
  const [base44SyncResult, setBase44SyncResult] = useState<string>('');
  const [hasToken, setHasToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);

  const checkToken = useCallback(async () => {
    setIsCheckingToken(true);
    try {
      const result = await hasBase44Token();
      setHasToken(result);
      if (result) {
        setTokenExpired(false);
      }
    } finally {
      setIsCheckingToken(false);
    }
  }, []);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  useEffect(() => {
    const unsubReceived = onBase44TokenReceived(() => {
      setHasToken(true);
      setTokenExpired(false);
    });
    const unsubExpired = onBase44TokenExpired(() => {
      setHasToken(false);
      setTokenExpired(true);
    });
    return () => {
      unsubReceived();
      unsubExpired();
    };
  }, []);

  const handleDisconnect = async () => {
    await clearBase44Token();
    setHasToken(false);
    setTokenExpired(false);
  };

  const handleConnect = async () => {
    const url = await getBase44ConnectUrl();
    openExternal(url);
  };

  const isConnected = hasToken;

  if (isCheckingToken) {
    return (
      <div className={styles.container}>
        <h3 className={styles.header}>חיבור ל-MoneyMoney</h3>
        <span className={styles.statusText}>בודק חיבור...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.header}>חיבור ל-MoneyMoney</h3>

      {/* Connection status indicator */}
      <div className={styles.connectionStatus}>
        <span
          className={`${styles.statusDot} ${
            isConnected ? styles.statusConnected : tokenExpired ? styles.statusExpired : styles.statusDisconnected
          }`}
        />
        <span className={styles.connectionText}>
          {isConnected && 'מחובר ל-MoneyMoney'}
          {tokenExpired && 'החיבור פג תוקף, יש להתחבר מחדש'}
          {!isConnected && !tokenExpired && 'לא מחובר'}
        </span>
      </div>

      {/* Connected state: show disconnect + sync/test */}
      {isConnected && (
        <div className={styles.actionButtonsWrapper}>
          <Button className={styles.buttonSecondary} onClick={handleDisconnect}>
            נתק חשבון
          </Button>
          <Button
            className={styles.buttonSecondary}
            onClick={async () => {
              setIsTestingBase44(true);
              setBase44TestResult('');
              try {
                const res = await testBase44Connection();
                if (res.ok) {
                  setBase44TestResult(`החיבור הצליח (סטטוס ${res.status})`);
                } else {
                  setBase44TestResult(`החיבור נכשל: ${res.error ?? `סטטוס ${res.status}`}`);
                  if (res.status === 401) {
                    setHasToken(false);
                    setTokenExpired(true);
                  }
                }
              } catch (e) {
                setBase44TestResult(`שגיאת בדיקה: ${(e as Error).message}`);
              } finally {
                setIsTestingBase44(false);
              }
            }}
            disabled={isTestingBase44}
          >
            בדוק חיבור
          </Button>
          {!!base44TestResult && <span className={styles.statusText}>{base44TestResult}</span>}
          <Button
            className={styles.buttonPrimary}
            onClick={async () => {
              setIsSyncingBase44(true);
              setBase44SyncResult('');
              try {
                await updateConfig(toJS(configStore.config));
                const res = await syncJsonToBase44();
                if (res.ok) {
                  setBase44SyncResult(`סנכרון הצליח: ${res.count} תנועות נשלחו`);
                } else {
                  if (res.error === 'token_expired') {
                    setHasToken(false);
                    setTokenExpired(true);
                    setBase44SyncResult('הטוקן פג תוקף, יש להתחבר מחדש');
                  } else {
                    setBase44SyncResult(`סנכרון נכשל: ${res.error}`);
                  }
                }
              } catch (e) {
                setBase44SyncResult(`שגיאת סנכרון: ${(e as Error).message}`);
              } finally {
                setIsSyncingBase44(false);
              }
            }}
            disabled={isSyncingBase44}
          >
            סנכרן עכשיו
          </Button>
          {!!base44SyncResult && <span className={styles.statusText}>{base44SyncResult}</span>}
        </div>
      )}

      {/* Not connected / expired: show connect button */}
      {!isConnected && (
        <div className={styles.actionButtonsWrapper}>
          <Button className={styles.buttonPrimary} onClick={handleConnect}>
            {tokenExpired ? 'התחבר מחדש' : 'חבר חשבון'}
          </Button>
          <span className={styles.statusText}>לחיצה תפתח את הדפדפן לחיבור החשבון</span>
        </div>
      )}
    </div>
  );
}

export default observer(Base44Settings);
// [CUSTOM-BASE44-END]
