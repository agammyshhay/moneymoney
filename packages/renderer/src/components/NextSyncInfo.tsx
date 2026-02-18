import { observer } from 'mobx-react-lite';
import moment from 'moment';
import { useConfigStore } from '../store/ConfigStore';
import styles from './Body.module.css';

const NextSyncInfo = () => {
  const configStore = useConfigStore();
  const lastScrapeDate = configStore.config?.scraping?.lastScrapeDate;

  if (!lastScrapeDate) {
    return null;
  }

  const lastRun = moment(lastScrapeDate);
  const lastTime = lastRun.isSame(moment(), 'day') ? lastRun.format('HH:mm') : lastRun.format('DD/MM HH:mm');

  const intervalHours = configStore.config?.scraping?.periodicScrapingIntervalHours;
  let nextSyncLine: string | null = null;
  if (intervalHours) {
    const nextSync = moment(lastScrapeDate).add(intervalHours, 'hours');
    const diff = nextSync.diff(moment());
    if (diff > 0) {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      nextSyncLine =
        hours > 0 ? `הבא בעוד ${hours}:${String(minutes).padStart(2, '0')} שעות` : `הבא בעוד ${minutes} דק'`;
    }
  }

  return (
    <div className={styles.nextSyncInfo}>
      <span className={styles.nextSyncLine}>עדכון אחרון: {lastTime}</span>
      {nextSyncLine && <span className={styles.nextSyncLine}>{nextSyncLine}</span>}
    </div>
  );
};

export default observer(NextSyncInfo);
