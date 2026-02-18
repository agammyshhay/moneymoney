import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigStore, type SyncHistoryEntry } from '../store/ConfigStore';
import styles from './SyncHistoryPanel.module.css';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return '';
};

const getTotalTransactions = (entry: SyncHistoryEntry) =>
  Object.values(entry.newTransactions).reduce((sum, n) => sum + n, 0);

const getMaxTransactions = (entry: SyncHistoryEntry) => Math.max(...Object.values(entry.newTransactions), 1);

/* ── Single Entry Card ── */
const HistoryEntry = ({ entry, index }: { entry: SyncHistoryEntry; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const total = getTotalTransactions(entry);
  const maxTx = getMaxTransactions(entry);
  const hasErrors = entry.errors.length > 0;
  const relative = relativeTime(entry.date);

  return (
    <div className={`${styles.entryWrapper} ${styles.fadeSlideIn}`} style={{ animationDelay: `${index * 50}ms` }}>
      {/* Card */}
      <div className={styles.entryCard}>
        {/* Header — always visible */}
        <button className={styles.entryHeader} onClick={() => setExpanded((v) => !v)} type="button">
          {/* Date + relative */}
          <div className={styles.dateGroup}>
            <span className={styles.dateText}>{formatDate(entry.date)}</span>
            {relative && <span className={styles.relativeTime}>{relative}</span>}
          </div>

          {/* Transaction count pill */}
          {total > 0 && <span className={styles.txBadge}>{total} תנועות</span>}

          {/* Error count */}
          {hasErrors && (
            <span className={styles.errorCount}>
              {entry.errors.length} {entry.errors.length === 1 ? 'שגיאה' : 'שגיאות'}
            </span>
          )}

          {/* Expand chevron */}
          <i className={`bi bi-chevron-down ${styles.entryChevron} ${expanded ? styles.entryChevronExpanded : ''}`} />
        </button>

        {/* Body — expandable */}
        <div className={`${styles.entryBody} ${expanded ? styles.entryBodyExpanded : ''}`}>
          {Object.keys(entry.newTransactions).length > 0 ? (
            <>
              <div className={styles.sectionLabel}>סיכום תנועות חדשות:</div>
              {Object.entries(entry.newTransactions).map(([accNum, count]) => (
                <div key={accNum} className={styles.accountRow}>
                  <span className={styles.accountName}>חשבון {accNum}</span>
                  <div className={styles.miniBar}>
                    <div className={styles.miniBarFill} style={{ width: `${Math.round((count / maxTx) * 100)}%` }} />
                  </div>
                  <span className={styles.accountCount}>{count}</span>
                </div>
              ))}
            </>
          ) : (
            <p className={styles.noTransactions}>לא התווספו תנועות חדשות</p>
          )}

          {hasErrors && (
            <div className={styles.errorBox}>
              <div className={styles.errorBoxTitle}>פרטי השגיאה:</div>
              {entry.errors.map((error, idx) => (
                <div key={idx} className={styles.errorItem}>
                  {error.vendorId && <span className={styles.errorVendor}>{error.vendorId}: </span>}
                  {error.message}
                </div>
              ))}
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

  // Reset confirm state after 2 seconds
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
      {/* Section Header */}
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

      {/* Content */}
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
