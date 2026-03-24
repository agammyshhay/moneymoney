// [CUSTOM-ONBOARDING-START]
import { openExternal, testBase44Connection } from '#preload';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useConfigStore } from '../../store/ConfigStore';
import base44GuideImg from '../../assets/base44-connect-guide.png';
import styles from './ConnectStep.module.css';

interface ConnectStepProps {
  onSkipStep: () => void;
}

export default function ConnectStep({ onSkipStep }: ConnectStepProps) {
  const configStore = useConfigStore();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const uuid = configStore.config?.outputVendors?.json?.options?.base44UserUuid ?? '';

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

  return (
    <div className={styles.container}>
      <h3 className={styles.header}>חיבור לאפליקציית MoneyMoney</h3>
      <p className={styles.description}>
        כדי שהנתונים יסונכרנו אוטומטית, צריך לחבר את האפליקציה לחשבון MoneyMoney שלך.
      </p>

      {/* Visual stepper */}
      <div className={styles.stepper}>
        <div className={styles.stepItem}>
          <div className={styles.stepMarker}>
            <div className={styles.stepCircle}>1</div>
            <div className={styles.stepLine} />
          </div>
          <div className={styles.stepBody}>
            <span>היכנס לאפליקציית MoneyMoney באתר</span>
            <Button
              size="sm"
              variant="outline-primary"
              className={styles.openButton}
              onClick={() => openExternal('https://moneym.base44.app/settings')}
            >
              <i className="bi bi-box-arrow-up-left"></i>
              פתח את MoneyMoney
            </Button>
          </div>
        </div>

        <div className={styles.stepItem}>
          <div className={styles.stepMarker}>
            <div className={styles.stepCircle}>2</div>
          </div>
          <div className={styles.stepBody}>
            <span>העתק את קוד החיבור מהמסך הזה:</span>
          </div>
        </div>
      </div>

      {/* Screenshot in browser frame */}
      <div className={styles.browserFrame}>
        <div className={styles.browserBar}>
          <div className={`${styles.browserDot} ${styles.browserDotRed}`} />
          <div className={`${styles.browserDot} ${styles.browserDotYellow}`} />
          <div className={`${styles.browserDot} ${styles.browserDotGreen}`} />
        </div>
        <img src={base44GuideImg} alt="מסך קוד החיבור באתר MoneyMoney" className={styles.guideImage} />
      </div>

      {/* Paste label + input */}
      <div className={styles.pasteLabel}>הדבק את הקוד כאן:</div>
      <div className={styles.inputWrapper}>
        <i className={`bi bi-key ${styles.inputIcon}`}></i>
        <Form.Control
          type="password"
          className={styles.input}
          placeholder="הדבק כאן את קוד החיבור"
          value={uuid}
          onChange={(e) => handleUuidChange(e.target.value)}
        />
      </div>

      <div className={styles.testRow}>
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
        {testResult && (
          testResult.ok ? (
            <span className={styles.testSuccess}>
              <i className={`bi bi-check-circle-fill ${styles.successCheckmark}`}></i>
              {testResult.message}
            </span>
          ) : (
            <span className={styles.testError}>{testResult.message}</span>
          )
        )}
      </div>

      <button type="button" className={styles.skipStepLink} onClick={onSkipStep}>
        דלג לעת עתה — אפשר להגדיר אחר כך
      </button>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
