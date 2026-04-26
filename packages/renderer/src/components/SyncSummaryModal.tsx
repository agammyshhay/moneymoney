import { observer } from 'mobx-react-lite';
import { Modal, Button, ListGroup } from 'react-bootstrap';
import { useConfigStore } from '../store/ConfigStore';
import type { Log } from '../types';
import { AccountStatus } from '../types';
import { describeError } from '../utils/errorMessages';
import { accountsPlural, formatAccountLabel, transactionsPlural } from '../utils/hebrewFormat';
import styles from './SyncSummaryModal.module.css';

const SyncSummaryModal = () => {
  const configStore = useConfigStore();
  const { showSummaryModal, lastScrapeSummary } = configStore;

  const handleClose = () => configStore.setShowSummaryModal(false);

  const totalNewTransactions = Array.from(lastScrapeSummary.newTransactions.values()).reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const accountsWithNewTx = lastScrapeSummary.newTransactions.size;

  const importerAccounts = configStore.importers.filter((imp) => imp.active);
  const accountsAttempted = importerAccounts.length;
  const accountsSucceeded = importerAccounts.filter((imp) => imp.status === AccountStatus.DONE).length;

  const hasErrors = lastScrapeSummary.errors.length > 0;
  const totalFailure = hasErrors && accountsAttempted > 0 && accountsSucceeded === 0;
  const partial = hasErrors && !totalFailure;

  let titleClass = styles.statusIconSuccess;
  let iconClass = 'bi-check-lg';
  let title = 'הסנכרון הסתיים בהצלחה';
  let subtitle: string | null = null;

  if (totalFailure) {
    titleClass = styles.statusIconError;
    iconClass = 'bi-x-lg';
    title = 'הסנכרון נכשל';
    subtitle = 'לא הצלחנו לסרוק אף חשבון — בדוק את ההגדרות ונסה שוב';
  } else if (partial) {
    titleClass = styles.statusIconWarn;
    iconClass = 'bi-exclamation-triangle-fill';
    title = 'סנכרון חלקי';
    subtitle = `${accountsSucceeded} מתוך ${accountsAttempted} חשבונות סונכרנו בהצלחה`;
  } else if (totalNewTransactions === 0) {
    title = 'הסנכרון הסתיים — אין תנועות חדשות';
    subtitle = 'כל הנתונים שלך עדכניים';
  } else {
    subtitle = `התווספו ${transactionsPlural(totalNewTransactions)} מ־${accountsPlural(accountsWithNewTx)}`;
  }

  return (
    <Modal show={showSummaryModal} onHide={handleClose} centered className="modal-dialog-centered">
      <Modal.Body className={styles.modalBody}>
        <div className={styles.statusSection}>
          <div className={`${styles.statusIcon} ${titleClass}`}>
            <i className={`bi ${iconClass}`}></i>
          </div>
          <h4 className={styles.statusTitle}>{title}</h4>
          {subtitle && <p className={styles.statusSubtitle}>{subtitle}</p>}
        </div>

        {/* Transactions Summary */}
        {totalNewTransactions > 0 && (
          <div className={styles.transactionsSection}>
            <h6 className={styles.transactionsTitle}>תנועות חדשות לפי חשבון</h6>
            <ListGroup variant="flush">
              {Array.from(lastScrapeSummary.newTransactions.entries()).map(([accNum, item]) => (
                <ListGroup.Item
                  key={accNum}
                  className={`d-flex justify-content-between align-items-center ${styles.transactionItem}`}
                >
                  <span style={{ fontWeight: 500 }}>{formatAccountLabel(item.vendorId, accNum)}</span>
                  <span className={`badge rounded-pill ${styles.transactionBadge}`}>{item.count}</span>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}

        {/* Errors List */}
        {hasErrors && (
          <div className={styles.errorSection}>
            <h6 className={styles.errorTitle}>מה קרה?</h6>
            <div className={styles.errorList}>
              {lastScrapeSummary.errors.map((error: Log, idx: number) => {
                const friendly = describeError({
                  errorType: error.errorType ?? error.originalEvent?.errorType,
                  vendorId: error.originalEvent?.vendorId,
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
          </div>
        )}

        <div className={styles.closeSection}>
          <Button variant="primary" onClick={handleClose} className={styles.closeButton}>
            סגור
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default observer(SyncSummaryModal);
