import { openExternal, scrape } from '#preload';
import { toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Container, Modal, Stack } from 'react-bootstrap';
import { useConfigStore } from '../store/ConfigStore';
import {
  ModalStatus,
  OutputVendorName,
  type YnabConfig,
  type Account,
  type Exporter,
  type Importer,
  type GoogleSheetsConfig,
} from '../types';
import styles from './Body.module.css';
import logoFishOnly from '../assets/logos/logoFishOnly.svg';
import ChromeDownloadProgress from './ChromeDownloadProgress';
import GeneralSettings from './GeneralSettings';
import AccountLogs from './accounts/AccountLogs';
import AccountsContainer from './accounts/AccountsContainer';
import CreateImporter from './accounts/CreateImporter';
import EditImporter from './accounts/EditImporter';
import Importers from './accounts/Importers';
import _EditExporter, { type EditExporterProps } from './exporters/EditExporter';
// [CUSTOM-NEXT-SYNC-START]
import NextSyncInfo from './NextSyncInfo';
// [CUSTOM-NEXT-SYNC-END]
// Removed budget apps exporters UI per requirement
// [CUSTOM-SUMMARY-START]
import SyncSummaryModal from './SyncSummaryModal';
// [CUSTOM-SUMMARY-END]
// [CUSTOM-HISTORY-START]
import SyncHistoryPanel from './SyncHistoryPanel';
// [CUSTOM-HISTORY-END]
// [CUSTOM-ONBOARDING-START]
import OnboardingWizard from './onboarding/OnboardingWizard';
// [CUSTOM-ONBOARDING-END]
// [CUSTOM-SIDEBAR-TIPS-START]
import SidebarTips from './SidebarTips';
// [CUSTOM-SIDEBAR-TIPS-END]

const Body = () => {
  const configStore = useConfigStore();

  // [CUSTOM-AUTO-RUN-START]
  const hasAutoRun = useRef(false);
  // [CUSTOM-AUTO-RUN-END]

  // [CUSTOM-ONBOARDING-START]
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const showWizard = !!configStore.isFirstRun && !wizardDismissed;
  // [CUSTOM-ONBOARDING-END]

  const cleanAndScrape = useCallback(async () => {
    configStore.clearScrapingStatus();
    try {
      // [CUSTOM-FIX-START]
      await scrape(configStore.handleScrapingEvent.bind(configStore), toJS(configStore.config));
      // [CUSTOM-FIX-END]
    } finally {
      // [CUSTOM-SUMMARY-START] - Show summary when done
      // We assume scrape finishes when the promise resolves (IPC send)
      // BUT wait, 'scrape' in preload is just SENDING the event. It doesn't wait for completion.
      // So we can't show it here.
      // We need to watch isScraping in a useEffect.
    }
  }, [configStore]);

  // [CUSTOM-SINGLE-RUN-START]
  const runSingleAccount = useCallback(
    async (accountId: string) => {
      // Create a temporary config with only the selected account
      const fullConfig = toJS(configStore.config);
      const accountToRun = fullConfig.scraping.accountsToScrape.find((a) => a.id === accountId);

      if (accountToRun) {
        // Clear logs for this specific account
        configStore.clearAccountScrapingData(accountToRun.key);

        const singleAccountConfig = {
          ...fullConfig,
          scraping: {
            ...fullConfig.scraping,
            accountsToScrape: [accountToRun],
          },
        };

        try {
          await scrape(configStore.handleScrapingEvent.bind(configStore), singleAccountConfig);
        } catch (e) {
          console.error('Failed to run single account', e);
        }
      }
    },
    [configStore],
  );
  // [CUSTOM-SINGLE-RUN-END]

  // [CUSTOM-AUTO-RUN-START]
  useEffect(() => {
    // [CUSTOM-ONBOARDING-START] - Suppress auto-run while wizard is open
    if (showWizard) return;
    // [CUSTOM-ONBOARDING-END]
    if (configStore.config?.scraping && !hasAutoRun.current) {
      hasAutoRun.current = true;
      cleanAndScrape();
    }
  }, [configStore.config, cleanAndScrape, showWizard]);
  // [CUSTOM-AUTO-RUN-END]

  // Auto-trigger scrape when periodic sync is overdue
  useEffect(() => {
    const intervalHours = configStore.config?.scraping?.periodicScrapingIntervalHours;
    if (!intervalHours) return;

    const checkOverdue = () => {
      const lastScrapeDate = configStore.config?.scraping?.lastScrapeDate;
      if (!lastScrapeDate || configStore.isScraping) return;
      const nextSync = new Date(lastScrapeDate).getTime() + intervalHours * 3600000;
      if (Date.now() > nextSync) {
        cleanAndScrape();
      }
    };

    const timerId = setInterval(checkOverdue, 60000);
    checkOverdue(); // Check immediately too
    return () => clearInterval(timerId);
  }, [configStore.config?.scraping?.periodicScrapingIntervalHours, configStore, cleanAndScrape]);

  // [CUSTOM-SUMMARY-START]
  // Removed explicit watcher for isScraping to avoid double modal trigger.
  // The modal is now triggered by EXPORT_PROCESS_END or GENERAL_ERROR events in ConfigStore.
  // [CUSTOM-SUMMARY-END]

  const [modalStatus, setModalStatus] = useState<ModalStatus>(ModalStatus.HIDDEN);

  const [currentAccount, setCurrentAccount] = useState<Account>();
  const closeModal = () => setModalStatus(ModalStatus.HIDDEN);
  const showModal = (account: Account, status: ModalStatus) => {
    setCurrentAccount(account);
    setModalStatus(status);
  };

  const wideModal = shouldShowWideModal(modalStatus, currentAccount);

  const newScraperClicked = () => {
    setModalStatus(ModalStatus.NEW_SCRAPER);
  };

  const createImporter = async (importer: Importer) => {
    await configStore.addImporter(importer);
    closeModal();
  };
  const updateImporter = async (importer: Importer) => {
    await configStore.updateImporter(importer.id, importer);
    closeModal();
  };

  const _updateExporter: EditExporterProps['handleSave'] = async (
    exporter: Exporter | YnabConfig | GoogleSheetsConfig,
  ) => {
    await configStore.updateExporter(exporter as Exporter);
    closeModal();
  };

  const deleteImporter = async (importerId: string) => {
    await configStore.deleteImporter(importerId);
    closeModal();
  };

  return (
    <Container className={styles.root}>
      {/* Main Content - Accounts Grid */}
      <Container className={styles.container}>
        <div className={styles.contentContainer}>
          {/* [CUSTOM-SIDEBAR-TIPS-START] */}
          <SidebarTips />
          {/* [CUSTOM-SIDEBAR-TIPS-END] */}
          <Stack direction="horizontal" className={styles.customGap}>
            <AccountsContainer
              title="בנקים וכרטיסי אשראי"
              accountsCount={configStore.importers.length}
              onAddAccount={newScraperClicked}
            >
              <Importers
                accounts={configStore.importers}
                isScraping={configStore.isScraping}
                showModal={showModal}
                runSingleAccount={runSingleAccount}
              />
            </AccountsContainer>
          </Stack>
        </div>

        {/* Bottom Actions Section */}
        <div className={styles.actionBar}>
          {/* Run Button */}
          <Button
            variant="dark"
            size="lg"
            onClick={cleanAndScrape}
            disabled={configStore.isScraping}
            className={styles.runButton}
          >
            {configStore.isScraping ? (
              <div className={styles.runButtonSyncing}>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>מסנכרן...</span>
              </div>
            ) : (
              <>
                <span className={styles.runButtonLabel}>הפעל סנכרון</span>
                <NextSyncInfo />
              </>
            )}
          </Button>

          {/* MoneyMoney Link */}
          <button
            type="button"
            onClick={() => {
              openExternal('https://moneym.base44.app/dashboard');
            }}
            className={styles.moneyMoneyButton}
          >
            <img src={logoFishOnly} alt="" height={20} width={20} style={{ borderRadius: 4 }} />
            <span>מעבר ל-MoneyMoney</span>
            <i className={`bi bi-box-arrow-up-left ${styles.moneyMoneyIcon}`}></i>
          </button>
        </div>

        {/* [CUSTOM-HISTORY-START] */}
        <SyncHistoryPanel />
        {/* [CUSTOM-HISTORY-END] */}

        {/* Modals */}
        <Modal
          show={modalStatus !== ModalStatus.HIDDEN}
          onHide={closeModal}
          dialogClassName={wideModal ? styles.modalWide : ''}
        >
          <Modal.Header closeButton className={styles.modalHeader}></Modal.Header>
          <Modal.Body>
            {modalStatus === ModalStatus.LOGS && currentAccount && <AccountLogs logs={currentAccount.logs} />}
            {modalStatus === ModalStatus.IMPORTER_SETTINGS && currentAccount && (
              <EditImporter
                handleSave={updateImporter}
                importer={currentAccount as Importer}
                handleDelete={deleteImporter}
              />
            )}
            {modalStatus === ModalStatus.NEW_SCRAPER && (
              <CreateImporter handleSave={createImporter} cancel={closeModal} />
            )}
            {modalStatus === ModalStatus.GENERAL_SETTINGS && <GeneralSettings />}
          </Modal.Body>
        </Modal>

        <SyncSummaryModal />

        {/* [CUSTOM-ONBOARDING-START] */}
        <OnboardingWizard
          show={showWizard}
          onComplete={() => {
            setWizardDismissed(true);
            cleanAndScrape();
          }}
          onSkip={() => setWizardDismissed(true)}
        />
        {/* [CUSTOM-ONBOARDING-END] */}
      </Container>

      {/* Bottom Progress Bar */}
      <div style={{ width: '100%', position: 'absolute', bottom: 0, right: 0, padding: '0 1rem' }}>
        <ChromeDownloadProgress />
      </div>
    </Container>
  );
};

function shouldShowWideModal(modalStatus: ModalStatus, currentAccount?: Account) {
  return (
    modalStatus === ModalStatus.EXPORTER_SETTINGS &&
    currentAccount &&
    currentAccount.companyId === OutputVendorName.YNAB
  );
}

export default observer(Body);
