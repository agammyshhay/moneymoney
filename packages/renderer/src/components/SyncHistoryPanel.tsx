import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigStore, type SyncHistoryEntry } from '../store/ConfigStore';
import { describeError } from '../utils/errorMessages';
import { errorsPlural, formatAccountLabel, formatRelativeDate, transactionsPlural } from '../utils/hebrewFormat';
import styles from './SyncHistoryPanel.module.css';

const getTotalTransactions = (entry: SyncHistoryEntry) =>
  Object.values(entry.newTransactions).reduce((sum, item) => sum + item.count, 0);

const getMaxTransactions = (entry: SyncHistoryEntry) =>
  Math.max(...Object.values(entry.newTransactions).map((item) => item.count), 1);

const STATUS_LABELS: Record<SyncHistoryEntry['status'], { label: string; className: string; icon: string }> = {
  success: { label: 'הצליח', className: 'pillSuccess', icon: 'bi-check-circle-fill' },
  partial: { label: 'הצליח חלקית', className: 'pillWarn', icon: 'bi-exclamation-triangle-fill' },
  failed: { label: 'נכשל', className: 'pillError', icon: 'bi-x-circle-fill' },
};

const buildHeadline = (entry: SyncHistoryEntry, total: number): string => {
  if (entry.status === 'failed') {
    if (entry.errors.length > 0) {
      const firstFriendly = describeError({
        errorType: entry.errors[0].errorType,
        vendorId: entry.errors[0].vendorId,
        rawMessage: entry.errors[0].message,
      });
      return firstFriendly.title;
    }
    return 'הסנכרון נכשל';
  }
  if (entry.status === 'partial') {
    if (entry.accountsAttempted > 0) {
      return `${entry.accountsSucceeded} מתוך ${entry.accountsAttempted} חשבונות סונכרנו`;
    }
    return 'סנכרון חלקי';
  }
  if (total === 0) return 'אין תנועות חדשות';
  return transactionsPlural(total);
};

/* ── Single Entry Card ── */
const HistoryEntry = ({ entry, index }: { entry: SyncHistoryEntry; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const total = getTotalTransactions(entry);
  const maxTx = getMaxTransactions(entry);
  const hasErrors = entry.errors.length > 0;
  const relative = formatRelativeDate(entry.date);
  const headline = buildHeadline(entry, total);
  const statusMeta = STATUS_LABELS[entry.status] ?? STATUS_LABELS.success;

  return (
    <div className={`${styles.entryWrapper} ${styles.fadeSlideIn}`} style={{ animationDelay: `${index * 50}ms` }}>
      <div className={styles.entryCard}>
        {/* Header — always visible */}
        <button className={styles.entryHeader} onClick={() => setExpanded((v) => !v)} type="button">
          <div className={styles.dateGroup}>
            <span className={styles.dateText}>{relative}</span>
            <span className={styles.headlineText}>{headline}</span>
          </div>

          <span className={`${styles.statusPill} ${styles[statusMeta.className]}`}>
            <i className={`bi ${statusMeta.icon}`} />
            {statusMeta.label}
          </span>

          {total > 0 && <span className={styles.txBadge}>{total}</span>}

          {hasErrors && <span className={styles.errorCount}>{errorsPlural(entry.errors.length)}</span>}

          <i className={`bi bi-chevron-down ${styles.entryChevron} ${expanded ? styles.entryChevronExpanded : ''}`} />
        </button>

        {/* Body — expandable */}
        <div className={`${styles.entryBody} ${expanded ? styles.entryBodyExpanded : ''}`}>
          {Object.keys(entry.newTransactions).length > 0 ? (
            <>
              <div className={styles.sectionLabel}>תנועות חדשות לפי חשבון</div>
              {Object.entries(entry.newTransactions).map(([accNum, item]) => (
                <div key={accNum} className={styles.accountRow}>
                  <span className={styles.accountName}>{formatAccountLabel(item.vendorId, accNum)}</span>
                  <div className={styles.miniBar}>
                    <div
                      className={styles.miniBarFill}
                      style={{ width: `${Math.round((item.count / maxTx) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.accountCount}>{item.count}</span>
                </div>
              ))}
            </>
          ) : (
            <p className={styles.noTransactions}>לא הורדו תנועות חדשות מהבנק</p>
          )}

          {hasErrors && (
            <div className={styles.errorBox}>
              <div className={styles.errorBoxTitle}>מה קרה?</div>
              {entry.errors.map((error, idx) => {
                const friendly = describeError({
                  errorType: error.errorType,
                  vendorId: error.vendorId,
                  rawMessage: error.message,
                });
                return (
                  <div key={idx} className={styles.errorItem}>
                    <div className={styles.errorItemTitle}>{friendly.title}</div>
                    {friendly.hint && <div className={styles.errorItemHint}>{friendly.hint}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main Panel ── */
const SyncHistoryPanel = () => {
  const configStore = useConfigStore();
  const [expanded, setExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 2000);
      return;
    }
    configStore.clearSyncHistory();
    setConfirmClear(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, [confirmClear, configStore]);

  if (configStore.syncHistory.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.headerButton} onClick={() => setExpanded((v) => !v)} type="button">
          <i className={`bi bi-chevron-down ${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`} />
          <i className={`bi bi-clock-history ${styles.headerIcon}`} />
          <span className={styles.headerTitle}>היסטוריה</span>
        </button>

        {expanded && (
          <button
            className={`${styles.clearButton} ${confirmClear ? styles.clearButtonConfirm : ''}`}
            onClick={handleClear}
            type="button"
            title="נקה היסטוריה"
          >
            <i className="bi bi-trash3" />
            <span>{confirmClear ? 'בטוח?' : 'נקה'}</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className={styles.scrollAreaWrapper}>
          <div className={styles.scrollArea}>
            {configStore.syncHistory.length === 0 ? (
              <div className={styles.emptyState}>
                <i className={`bi bi-clock-history ${styles.emptyIcon}`} />
                <span className={styles.emptyText}>אין היסטוריית סנכרונים</span>
              </div>
            ) : (
              <div className={styles.timeline}>
                {configStore.syncHistory.map((entry, idx) => (
                  <HistoryEntry key={entry.date} entry={entry} index={idx} />
                ))}
              </div>
            )}
          </div>
          {configStore.syncHistory.length > 3 && <div className={styles.scrollFade} />}
        </div>
      )}
    </div>
  );
};

export default observer(SyncHistoryPanel);
