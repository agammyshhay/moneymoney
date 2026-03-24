// [CUSTOM-ONBOARDING-START]
import { useState } from 'react';
import { type Importer } from '../../types';
import { useConfigStore } from '../../store/ConfigStore';
import CreateImporter from '../accounts/CreateImporter';
import styles from './AddAccountStep.module.css';

const CONFETTI_DOTS = [
  { color: '#1a73e8', tx: '-28px', ty: '-24px', delay: '0s' },
  { color: '#34a853', tx: '30px', ty: '-20px', delay: '0.05s' },
  { color: '#fbbc04', tx: '-24px', ty: '26px', delay: '0.1s' },
  { color: '#ea4335', tx: '28px', ty: '22px', delay: '0.08s' },
  { color: '#1a73e8', tx: '0px', ty: '-32px', delay: '0.03s' },
];

interface AddAccountStepProps {
  onAccountAdded: () => void;
}

export default function AddAccountStep({ onAccountAdded }: AddAccountStepProps) {
  const configStore = useConfigStore();
  const [addedAccounts, setAddedAccounts] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(true);

  const handleSave = async (importer: Importer) => {
    await configStore.addImporter(importer);
    setAddedAccounts((prev) => [...prev, importer.displayName]);
    setShowForm(false);
  };

  const handleAddAnother = () => {
    setShowForm(true);
  };

  if (!showForm && addedAccounts.length > 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.header}>הוספת חשבון בנק או כרטיס אשראי</h3>
        <div className={styles.successState}>
          {/* Confetti + checkmark */}
          <div className={styles.successIconWrapper}>
            <i className={`bi bi-check-circle-fill ${styles.successIcon}`}></i>
            {CONFETTI_DOTS.map((dot, i) => (
              <div
                key={i}
                className={styles.confettiDot}
                style={{
                  backgroundColor: dot.color,
                  '--tx': dot.tx,
                  '--ty': dot.ty,
                  animationDelay: dot.delay,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Account count badge */}
          <span className={styles.countBadge}>
            {addedAccounts.length === 1
              ? 'חשבון 1 נוסף'
              : `${addedAccounts.length} חשבונות נוספו`}
          </span>

          <div className={styles.successText}>
            {addedAccounts.map((name) => (
              <div key={name} className={styles.addedAccount}>
                <i className="bi bi-check2"></i>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.infoCallout}>
          <i className={`bi bi-info-circle ${styles.infoIcon}`}></i>
          <div className={styles.infoText}>
            <strong>זהו! מעכשיו האפליקציה תעבוד ברקע באופן אוטומטי.</strong>
            <span>אין צורך לפתוח אותה שוב — כל הנתונים מסתנכרנים ישירות ל-MoneyMoney באתר.</span>
          </div>
        </div>
        <div className={styles.successActions}>
          <button type="button" className={styles.addAnotherButton} onClick={handleAddAnother}>
            <i className="bi bi-plus-lg"></i>
            הוסף חשבון נוסף
          </button>
          <button type="button" className={styles.finishButton} onClick={onAccountAdded}>
            סיים והפעל סנכרון ראשון
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.header}>הוספת חשבון בנק או כרטיס אשראי</h3>
      <div className={styles.tipCard}>
        <i className={`bi bi-lightbulb ${styles.tipIcon}`}></i>
        <span>בחר את הבנק או חברת האשראי שלך. תצטרך את פרטי ההתחברות שאתה משתמש בהם באתר הבנק.</span>
      </div>
      <div className={styles.importerWrapper}>
        <CreateImporter handleSave={handleSave} cancel={() => onAccountAdded()} />
      </div>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
