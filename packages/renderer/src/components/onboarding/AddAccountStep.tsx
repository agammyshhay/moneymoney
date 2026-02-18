// [CUSTOM-ONBOARDING-START]
import { useState } from 'react';
import { type Importer } from '../../types';
import { useConfigStore } from '../../store/ConfigStore';
import CreateImporter from '../accounts/CreateImporter';
import styles from './AddAccountStep.module.css';

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
          <i className={`bi bi-check-circle-fill ${styles.successIcon}`}></i>
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
      <p className={styles.description}>בחר את הבנק או חברת כרטיס האשראי שלך והזן את פרטי ההתחברות.</p>
      <div className={styles.importerWrapper}>
        <CreateImporter handleSave={handleSave} cancel={() => onAccountAdded()} />
      </div>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
