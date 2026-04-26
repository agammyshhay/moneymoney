import { AccountStatus, type Log, type LogSeverity } from '../../types';
import { describeError } from '../../utils/errorMessages';
import { formatRelativeDate, formatTime, getBankDisplayName } from '../../utils/hebrewFormat';
import { shouldSkipProgressMessage, translateProgressMessage } from '../../utils/progressMessages';
import styles from './AccountLogs.module.css';

interface AccountLogsProps {
  logs: Log[];
  vendorId?: string;
  accountStatus?: AccountStatus;
}

const SEVERITY_META: Record<LogSeverity, { icon: string; cls: string }> = {
  success: { icon: 'bi-check-circle-fill', cls: 'sevSuccess' },
  error: { icon: 'bi-x-circle-fill', cls: 'sevError' },
  warn: { icon: 'bi-exclamation-triangle-fill', cls: 'sevWarn' },
  info: { icon: 'bi-info-circle-fill', cls: 'sevInfo' },
};

const inferSeverity = (log: Log): LogSeverity => {
  if (log.severity) return log.severity;
  if (log.originalEvent?.error !== undefined || log.errorType !== undefined) return 'error';
  const status = log.originalEvent?.accountStatus;
  if (status === AccountStatus.DONE) return 'success';
  if (status === AccountStatus.ERROR) return 'error';
  return 'info';
};

const lastTimestamp = (logs: Log[]): string | undefined => {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (logs[i].timestamp) return logs[i].timestamp;
  }
  return undefined;
};

export default function AccountLogs({ logs, vendorId, accountStatus }: AccountLogsProps) {
  const bankName = getBankDisplayName(vendorId);
  const lastTs = lastTimestamp(logs);

  // Build a clean, user-friendly view: hide boilerplate scraper events and collapse
  // consecutive entries that translate to the same Hebrew message.
  const visibleLogs: { log: Log; message: string; severity: LogSeverity; hint?: string }[] = [];
  let lastShownMessage: string | undefined;
  for (const log of logs) {
    const severity = inferSeverity(log);
    const isError = severity === 'error';
    if (!isError && shouldSkipProgressMessage(log.message)) continue;

    let message = translateProgressMessage(log.message);
    let hint: string | undefined;
    if (isError) {
      const friendly = describeError({
        errorType: log.errorType ?? log.originalEvent?.errorType,
        vendorId: log.originalEvent?.vendorId ?? vendorId,
        rawMessage: log.message,
      });
      message = friendly.title;
      hint = friendly.hint;
    }

    if (message === lastShownMessage) continue;
    visibleLogs.push({ log, message, severity, hint });
    lastShownMessage = message;
  }

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <i className="bi bi-activity" />
          <span>פעילות חשבון{bankName ? ` — ${bankName}` : ''}</span>
        </div>
        {lastTs && <div className={styles.headerSubtitle}>עודכן {formatRelativeDate(lastTs)}</div>}
      </div>

      {visibleLogs.length === 0 ? (
        <div className={styles.emptyState}>
          <i className={`bi bi-inbox ${styles.emptyIcon}`} />
          <span>אין פעילות עדיין</span>
        </div>
      ) : (
        <ul className={styles.timeline}>
          {visibleLogs.map(({ log, message, severity, hint }, idx) => {
            const meta = SEVERITY_META[severity];
            return (
              <li key={idx} className={`${styles.row} ${styles[meta.cls]}`}>
                <i className={`bi ${meta.icon} ${styles.rowIcon}`} />
                {log.timestamp && <span className={styles.rowTime}>{formatTime(log.timestamp)}</span>}
                <div className={styles.rowContent}>
                  <div className={styles.rowMessage}>{message}</div>
                  {hint && <div className={styles.rowHint}>{hint}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {accountStatus === AccountStatus.IN_PROGRESS && (
        <div className={styles.runningHint}>
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          <span>הסנכרון עדיין רץ…</span>
        </div>
      )}
    </div>
  );
}
