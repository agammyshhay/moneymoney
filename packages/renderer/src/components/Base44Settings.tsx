import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Form, Button } from 'react-bootstrap';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { testBase44Connection, syncJsonToBase44, updateConfig } from '#preload';
import { useState } from 'react';
import { useConfigStore } from '../store/ConfigStore';
import styles from './Base44Settings.module.css';

function Base44Settings() {
  const configStore = useConfigStore();
  const [isTestingBase44, setIsTestingBase44] = useState(false);
  const [base44TestResult, setBase44TestResult] = useState<string>('');
  const [isSyncingBase44, setIsSyncingBase44] = useState(false);
  const [base44SyncResult, setBase44SyncResult] = useState<string>('');
  const base44UserUuid = configStore.config?.outputVendors?.json?.options?.base44UserUuid ?? '';

  const handleBase44UserUuidChange = (value: string) => {
    configStore.setBase44UserUuid(value);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.header}>חיבור ל-MoneyMoney</h3>
      <Form.Group className={styles.inputGroup}>
        <Form.Label className={styles.label}>קוד חיבור ל-MoneyMoney</Form.Label>
        <Form.Control
          type="password"
          className={styles.input}
          placeholder="הדבק כאן את המזהה האישי שלך"
          value={base44UserUuid}
          onChange={(event) => handleBase44UserUuidChange(event.target.value)}
        />
        <Form.Text className="text-muted">ניתן למצוא את קוד החיבור באזור ההגדרות באפליקציה</Form.Text>
      </Form.Group>

      <div className={styles.actionButtonsWrapper}>
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
              }
            } catch (e) {
              setBase44TestResult(`שגיאת בדיקה: ${(e as Error).message}`);
            } finally {
              setIsTestingBase44(false);
            }
          }}
          disabled={isTestingBase44 || !base44UserUuid.trim()}
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
                setBase44SyncResult(`סנכרון נכשל: ${res.error}`);
              }
            } catch (e) {
              setBase44SyncResult(`שגיאת סנכרון: ${(e as Error).message}`);
            } finally {
              setIsSyncingBase44(false);
            }
          }}
          disabled={isSyncingBase44 || !base44UserUuid.trim()}
        >
          סנכרן עכשיו
        </Button>
        {!!base44SyncResult && <span className={styles.statusText}>{base44SyncResult}</span>}
      </div>
    </div>
  );
}

export default observer(Base44Settings);
