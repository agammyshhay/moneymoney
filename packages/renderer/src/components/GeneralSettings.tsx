import { showSaveDialog } from '#preload';
import { observer } from 'mobx-react-lite';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import { useConfigStore } from '../store/ConfigStore';
import styles from './GeneralSettings.module.css';
import Base44Settings from './Base44Settings';
// [CUSTOM-UPDATE-START]
import CheckForUpdates from './CheckForUpdates';
// [CUSTOM-UPDATE-END]

function GeneralSettings() {
  const configStore = useConfigStore();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function _toggleShowBrowser() {
    configStore.toggleShowBrowser();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleTimeoutChanged = (timeout: string) => {
    const numberTimeout = Number(timeout);
    if (numberTimeout) {
      configStore.setTimeout(numberTimeout);
    }
  };

  // [CUSTOM-CSV-START]
  const csvConfig = configStore.config?.outputVendors?.csv;
  const chooseCsvFile = async () => {
    const filePath = await showSaveDialog();
    if (filePath) {
      configStore.setCsvFilePath(filePath.toLowerCase().endsWith('.csv') ? filePath : `${filePath}.csv`);
    }
  };
  // [CUSTOM-CSV-END]

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Card.Body className={styles.cardBody}>
          <Form>
            {/* [CUSTOM-BASE44-START] - Base44 Settings Component */}
            <Base44Settings />
            {/* [CUSTOM-BASE44-END] */}

            <div className={styles.scrapingSection}>
              <h3 className={styles.scrapingHeader}>
                <i className="bi bi-speedometer2 ms-1"></i>
                מהירות שליפה
              </h3>
              <p className={styles.scrapingDescription}>
                כמה חשבונות בנק ייקראו בו-זמנית. שליפה של חשבון אחד בכל פעם יציבה יותר ומתאימה לרוב המשתמשים.
              </p>
              <Form.Group>
                <Form.Label className={styles.scrapingLabel}>קצב שליפת חשבונות</Form.Label>
                <Form.Select
                  className={styles.scrapingSelect}
                  value={configStore.config?.scraping?.maxConcurrency ?? 1}
                  onChange={(e) => configStore.setMaxConcurrency(Number(e.target.value))}
                >
                  <option value={1}>אחד אחרי השני (מומלץ)</option>
                  <option value={2}>שניים במקביל</option>
                  <option value={3}>שלושה במקביל</option>
                </Form.Select>
                <Form.Text className={styles.scrapingHint}>
                  ערך גבוה יותר מזרז את התהליך, אך עלול לגרום לתקלות במחשבים עם פחות זיכרון.
                </Form.Text>
              </Form.Group>
            </div>

            {/* [CUSTOM-CSV-START] */}
            <div className={styles.scrapingSection}>
              <h3 className={styles.scrapingHeader}>
                <i className="bi bi-filetype-csv ms-1"></i>
                שמירה לקובץ CSV
              </h3>
              <p className={styles.scrapingDescription}>
                בנוסף לסנכרון, ניתן לשמור את כל העסקאות גם לקובץ CSV שאפשר לפתוח באקסל. הקובץ מתעדכן בכל סנכרון.
              </p>
              <Form.Group>
                <Form.Check
                  type="switch"
                  id="csv-export-switch"
                  label="שמור עסקאות לקובץ CSV"
                  checked={csvConfig?.active ?? false}
                  onChange={() => configStore.toggleCsvExport()}
                />
              </Form.Group>
              {csvConfig?.active && (
                <Form.Group className="mt-3">
                  <Form.Label className={styles.scrapingLabel}>מיקום הקובץ</Form.Label>
                  <InputGroup>
                    <Form.Control readOnly value={csvConfig.options.filePath} style={{ direction: 'ltr' }} />
                    <Button variant="outline-secondary" onClick={chooseCsvFile}>
                      בחר…
                    </Button>
                  </InputGroup>
                  <Form.Text className={styles.scrapingHint}>
                    יש לסגור את הקובץ באקסל לפני הסנכרון — קובץ פתוח לא יתעדכן.
                  </Form.Text>
                </Form.Group>
              )}
            </div>
            {/* [CUSTOM-CSV-END] */}

            {/* [CUSTOM-STARTUP-START] */}
            <Form.Group className="mt-3">
              <Form.Check
                type="switch"
                id="run-at-startup-switch"
                label="פתח אוטומטית בהפעלת המחשב"
                checked={configStore.config?.runAtStartup ?? true}
                onChange={() => configStore.toggleRunAtStartup()}
              />
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Check
                type="switch"
                id="minimize-to-tray-switch"
                label="מזער למגש המערכת בסגירה"
                checked={configStore.config?.minimizeToTray ?? true}
                onChange={() => configStore.toggleMinimizeToTray()}
              />
            </Form.Group>
            {/* [CUSTOM-STARTUP-END] */}

            {/* [CUSTOM-UPDATE-START] */}
            <Form.Group className="mt-3">
              <Form.Label className="fw-bold">עדכוני תוכנה</Form.Label>
              <CheckForUpdates />
            </Form.Group>
            {/* [CUSTOM-UPDATE-END] */}
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default observer(GeneralSettings);
