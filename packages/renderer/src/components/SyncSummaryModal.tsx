import { observer } from 'mobx-react-lite';
import { Modal, Button, ListGroup } from 'react-bootstrap';
import { useConfigStore } from '../store/ConfigStore';
import type { Log } from '../types';
import styles from './SyncSummaryModal.module.css';

const SyncSummaryModal = () => {
  const configStore = useConfigStore();
  const { showSummaryModal, lastScrapeSummary } = configStore;

  const handleClose = () => configStore.setShowSummaryModal(false);

  const getAccountName = (accountNumber: string) => `חשבון ${accountNumber}`;

  const hasErrors = lastScrapeSummary.errors.length > 0;
  const hasTransactions = lastScrapeSummary.newTransactions.size > 0;

  return (
    <Modal show={showSummaryModal} onHide={handleClose} centered className="modal-dialog-centered">
      <Modal.Body className={styles.modalBody}>
        {/* Success Icon / State */}
        {!hasErrors ? (
          <div className={styles.statusSection}>
            <div className={`${styles.statusIcon} ${styles.statusIconSuccess}`}>
              <i className="bi bi-check-lg"></i>
            </div>
            <h4 className={styles.statusTitle}>הסנכרון הסתיים בהצלחה</h4>
          </div>
        ) : (
          <div className={styles.statusSection}>
            <div className={`${styles.statusIcon} ${styles.statusIconError}`}>
              <i className="bi bi-x-lg"></i>
            </div>
            <h4 className={styles.statusTitle}>ארעה שגיאה בסנכרון</h4>
          </div>
        )}

        {/* Transactions Summary */}
        <div className={styles.transactionsSection}>
          {hasTransactions ? (
            <>
              <h6 className={styles.transactionsTitle}>סיכום תנועות חדשות:</h6>
              <ListGroup variant="flush">
                {Array.from(lastScrapeSummary.newTransactions.entries()).map(([accNum, count]: [string, number]) => (
                  <ListGroup.Item
                    key={accNum}
                    className={`d-flex justify-content-between align-items-center ${styles.transactionItem}`}
                  >
                    <span style={{ fontWeight: 500 }}>{getAccountName(accNum)}</span>
                    <span className={`badge rounded-pill ${styles.transactionBadge}`}>{count} תנועות</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>לא התווספו תנועות חדשות</p>
            </div>
          )}
        </div>

        {/* Errors List */}
        {hasErrors && (
          <div className={styles.errorSection}>
            <h6 className={styles.errorTitle}>פרטי השגיאה:</h6>
            <div className={styles.errorList}>
              {lastScrapeSummary.errors.map((error: Log, idx: number) => (
                <div key={idx} className={styles.errorItem}>
                  <strong>{error.originalEvent?.vendorId ? `${error.originalEvent.vendorId}: ` : ''}</strong>
                  {error.message}
                </div>
              ))}
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
