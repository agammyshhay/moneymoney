import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useConfigStore } from '../store/ConfigStore';
import { type AccountWarning } from '../utils/accountHealth';
import { getBankDisplayName } from '../utils/hebrewFormat';
import styles from './AccountWarningsBanner.module.css';

interface Props {
  onOpenAccount: (accountId: string) => void;
}

const AccountWarningsBanner = ({ onOpenAccount }: Props) => {
  const configStore = useConfigStore();
  const [expanded, setExpanded] = useState(false);

  const warnings: AccountWarning[] = configStore.accountWarnings;
  if (warnings.length === 0) return null;

  const hasCritical = warnings.some((w) => w.severity === 'critical');
  const variantClass = hasCritical ? styles.criticalVariant : styles.warningVariant;
  const iconClass = hasCritical ? 'bi bi-exclamation-triangle-fill' : 'bi bi-exclamation-circle-fill';

  const headline =
    warnings.length === 1
      ? `${getBankDisplayName(warnings[0].vendorId) ?? 'חשבון'} דורש תשומת לב`
      : `${warnings.length} חשבונות דורשים תשומת לב`;

  return (
    <div className={`${styles.banner} ${variantClass}`}>
      <div className={styles.header}>
        <div className={styles.icon}>
          <i className={iconClass} />
        </div>
        <div className={styles.title}>{headline}</div>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span>{expanded ? 'הסתר' : 'הצג פרטים'}</span>
          <i className={expanded ? 'bi bi-chevron-up' : 'bi bi-chevron-down'} />
        </button>
      </div>
      <div className={`${styles.list} ${expanded ? styles.listOpen : ''}`} aria-hidden={!expanded}>
        {warnings.map((warning) => (
          <div key={warning.accountId} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{warning.title}</span>
              {warning.hint && <span className={styles.rowHint}>{warning.hint}</span>}
            </div>
            <button type="button" className={styles.rowAction} onClick={() => onOpenAccount(warning.accountId)}>
              פתח הגדרות
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default observer(AccountWarningsBanner);
