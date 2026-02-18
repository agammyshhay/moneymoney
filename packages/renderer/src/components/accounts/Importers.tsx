import {
  AccountStatus,
  ModalStatus,
  type OutputVendorName,
  AccountType as TypeOfAccount,
  type Account as AccountType,
} from '../../types';
import Account, { type ActionButton } from './Account';
import { useConfigStore } from '../../store/ConfigStore';

interface ImportersProps {
  accounts: AccountType[];
  isScraping: boolean;
  showModal: (AccountType: AccountType, ModalStatus: ModalStatus) => void;
  runSingleAccount?: (accountId: string) => void;
}

function Importers({ accounts, isScraping, showModal, runSingleAccount }: ImportersProps) {
  const configStore = useConfigStore();
  return (
    <>
      {accounts.map((account) => {
        return (
          <Account
            key={account.id}
            account={account}
            actionButtons={getActionButtons(
              showModal,
              account,
              isScraping,
              () => {
                configStore.openResults(account.companyId as OutputVendorName);
              },
              runSingleAccount,
            )}
          />
        );
      })}
    </>
  );
}

export function getActionButtons(
  showModal: (AccountType: AccountType, ModalStatus: ModalStatus) => void,
  account: AccountType,
  isScraping: boolean,
  openResultsHandler?: () => void,
  runSingleAccount?: (accountId: string) => void,
): ActionButton[] {
  const logsActionButton: ActionButton = {
    icon: 'bi-journal-text',
    clickHandler: () => showModal(account, ModalStatus.LOGS),
    tooltipText: 'לוגים',
  };

  const accountSettingsActionButton: ActionButton = {
    icon: 'bi-gear-fill',
    clickHandler: () =>
      showModal(
        account,
        account.type === TypeOfAccount.IMPORTER ? ModalStatus.IMPORTER_SETTINGS : ModalStatus.EXPORTER_SETTINGS,
      ),
    tooltipText: 'הגדרות',
    alwaysVisible: true,
  };

  const runActionButton: ActionButton = {
    icon: 'bi-play-fill',
    clickHandler: () => runSingleAccount?.(account.id),
    tooltipText: 'הפעל חשבון זה',
  };

  const actionButtons: ActionButton[] = [];

  const shouldLog = account.status !== AccountStatus.PENDING && account.status !== AccountStatus.IDLE;

  const openResultsButton: ActionButton = {
    icon: 'bi-folder2-open',
    tooltipText: 'פתיחת תוצאות',
    clickHandler: openResultsHandler,
  };

  if (shouldLog) {
    actionButtons.push(logsActionButton);
  }

  if (!isScraping) {
    actionButtons.push(accountSettingsActionButton);
    if (account.type === TypeOfAccount.IMPORTER && runSingleAccount) {
      actionButtons.push(runActionButton);
    }
  }

  if (account.type === TypeOfAccount.EXPORTER) {
    actionButtons.push(openResultsButton);
  }

  return actionButtons;
}

export default Importers;
