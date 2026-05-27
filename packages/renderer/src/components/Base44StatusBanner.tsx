// [CUSTOM-BASE44-START]
import { getBase44ConnectUrl, openExternal, syncJsonToBase44 } from '#preload';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useConfigStore } from '../store/ConfigStore';
import { describeError } from '../utils/errorMessages';
import styles from './Body.module.css';

const Base44StatusBanner = () => {
  const configStore = useConfigStore();
  const [isRetrying, setIsRetrying] = useState(false);

  const status = configStore.base44Status;
  if (status === 'connected') return null;

  const handleConnect = async () => {
    const url = await getBase44ConnectUrl();
    openExternal(url);
  };

  const handleRetry = async () => {
    if (isRetrying || configStore.isScraping) return;
    setIsRetrying(true);
    try {
      const result = await syncJsonToBase44();
      if (result.ok) {
        configStore.recordManualBase44Sync(true);
        return;
      }
      const raw = result.error ?? '';
      // Rate-limit response is meaningless to the user — keep the existing banner state.
      if (raw === 'rate_limited') return;
      let errorType: string | undefined;
      if (raw === 'token_expired') errorType = 'BASE44_AUTH';
      else if (/ECONNRESET|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|fetch failed|getaddrinfo|network/i.test(raw))
        errorType = 'BASE44_NETWORK';
      else if (/\b(401|403|unauthor|forbidden|invalid token|expired token)\b/i.test(raw)) errorType = 'BASE44_AUTH';
      configStore.recordManualBase44Sync(false, errorType, raw);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      configStore.recordManualBase44Sync(false, undefined, message);
    } finally {
      setIsRetrying(false);
    }
  };

  const isError = status === 'network-failed' || status === 'sync-failed';
  const isNeedsConnect = status === 'no-token' || status === 'auth-failed';

  let title: string;
  let subtitle: string;
  let iconClass: string;
  let buttonLabel: string;
  let buttonAction: () => void;

  if (status === 'no-token') {
    title = 'לא מחובר ל-MoneyMoney';
    subtitle = 'התנועות לא מסונכרנות לאתר';
    iconClass = 'bi bi-link-45deg';
    buttonLabel = 'חבר עכשיו';
    buttonAction = handleConnect;
  } else if (status === 'auth-failed') {
    title = 'החיבור ל-MoneyMoney פג תוקף';
    subtitle = 'יש להתחבר מחדש כדי לחדש את הסנכרון';
    iconClass = 'bi bi-shield-exclamation';
    buttonLabel = 'התחבר מחדש';
    buttonAction = handleConnect;
  } else {
    const friendly = describeError({
      errorType: configStore.latestBase44Error?.errorType,
      vendorId: 'json',
      rawMessage: configStore.latestBase44Error?.message,
    });
    title = friendly.title;
    subtitle = friendly.hint ?? 'נסה שוב כדי לסנכרן';
    iconClass = status === 'network-failed' ? 'bi bi-wifi-off' : 'bi bi-exclamation-triangle';
    if (configStore.isScraping) buttonLabel = 'סנכרון מתבצע...';
    else if (isRetrying) buttonLabel = 'מנסה...';
    else buttonLabel = 'נסה שוב';
    buttonAction = handleRetry;
  }

  return (
    <div className={`${styles.connectBanner} ${isError ? styles.connectBannerError : ''}`}>
      <div className={`${styles.connectBannerIcon} ${isError ? styles.connectBannerIconError : ''}`}>
        <i className={iconClass} style={{ color: isError ? '#c62828' : '#f9a825', fontSize: '1.15rem' }} />
      </div>
      <div className={styles.connectBannerContent}>
        <span className={`${styles.connectBannerTitle} ${isError ? styles.connectBannerTitleError : ''}`}>{title}</span>
        <span className={`${styles.connectBannerSubtitle} ${isError ? styles.connectBannerSubtitleError : ''}`}>
          {subtitle}
        </span>
      </div>
      <button
        type="button"
        className={styles.connectBannerButton}
        onClick={buttonAction}
        disabled={!isNeedsConnect && (isRetrying || configStore.isScraping)}
      >
        {!isNeedsConnect && (isRetrying || configStore.isScraping) ? (
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
            style={{ marginInlineEnd: 6 }}
          />
        ) : null}
        {buttonLabel}
      </button>
    </div>
  );
};

export default observer(Base44StatusBanner);
// [CUSTOM-BASE44-END]
