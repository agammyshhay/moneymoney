import { useState } from 'react';
import { Spinner } from 'react-bootstrap';
import styles from './WebAppView.module.css';

const BASE44_URL = 'https://moneym.base44.app';

function WebAppView() {
  const [loading, setLoading] = useState(true);

  return (
    <div className={styles.container}>
      {loading && (
        <div className={styles.loading}>
          <Spinner animation="border" variant="primary" />
          <span>טוען את אפליקציית הווב...</span>
        </div>
      )}
      <iframe
        className={styles.iframe}
        src={BASE44_URL}
        title="MoneyMoney Web"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => setLoading(false)}
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  );
}

export default WebAppView;
