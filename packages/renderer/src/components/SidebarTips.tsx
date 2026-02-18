// [CUSTOM-SIDEBAR-TIPS-START]
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigStore } from '../store/ConfigStore';
import styles from './SidebarTips.module.css';

interface Tip {
  id: string;
  text: string;
  icon: string;
  iconColor: string;
  condition?: 'hasErrors' | 'noBase44Uuid' | 'isScraping';
}

const contextualTips: Tip[] = [
  {
    id: 'error',
    text: 'שגיאה בסנכרון? כדאי לבדוק שהסיסמה עדיין תקפה',
    icon: 'bi-exclamation-triangle',
    iconColor: '#f59e0b',
    condition: 'hasErrors',
  },
  {
    id: 'no-base44',
    text: 'חבר ל-MoneyMoney באתר כדי לראות את כל הנתונים במקום אחד',
    icon: 'bi-link-45deg',
    iconColor: '#1a73e8',
    condition: 'noBase44Uuid',
  },
  {
    id: 'scraping',
    text: 'הסנכרון רץ ברקע. אפשר לשבת בנוח.',
    icon: 'bi-hourglass-split',
    iconColor: '#1a73e8',
    condition: 'isScraping',
  },
];

const funnyTips: Tip[] = [
  {
    id: 'wallet-exorcism',
    text: 'הארנק שלך התקשר. הוא רוצה להגיש נגדך תלונה במשטרה.',
    icon: 'bi-telephone-x',
    iconColor: '#ef4444',
  },
  {
    id: 'salary-usain',
    text: 'המשכורת שלך שברה שיא עולם בריצת 100 מטר מהחשבון.',
    icon: 'bi-trophy',
    iconColor: '#f59e0b',
  },
  {
    id: 'credit-haunted',
    text: 'כרטיס האשראי שלך ראה את הפירוט החודשי וביקש חופשת מחלה.',
    icon: 'bi-bandaid',
    iconColor: '#ec4899',
  },
  {
    id: 'atm-restraining',
    text: 'הכספומט הוציא נגדך צו הרחקה. תנסה כספומט אחר.',
    icon: 'bi-sign-stop',
    iconColor: '#dc2626',
  },
  {
    id: 'bank-horror',
    text: 'פקידת הבנק ראתה את היתרה שלך והתעלפה. היא בסדר עכשיו.',
    icon: 'bi-hospital',
    iconColor: '#6366f1',
  },
  {
    id: 'shekel-escape',
    text: 'השקלים שלך מתכננים בריחה קבוצתית. הם כבר חפרו מנהרה.',
    icon: 'bi-door-open',
    iconColor: '#f97316',
  },
  {
    id: 'budget-fantasy',
    text: 'תכנון תקציב: סוגה ספרותית בדיונית שנכתבת מחדש כל חודש.',
    icon: 'bi-journal-x',
    iconColor: '#8b5cf6',
  },
  {
    id: 'minus-real-estate',
    text: 'המינוס שלך כבר כל כך גדול שהוא דורש דירה משלו.',
    icon: 'bi-house-x',
    iconColor: '#ef4444',
  },
  {
    id: 'delivery-aliens',
    text: 'וולט ומשלוחה מתחלקים על מי ירש אותך ראשון.',
    icon: 'bi-bicycle',
    iconColor: '#10b981',
  },
  {
    id: 'savings-account-cobweb',
    text: 'חשבון החיסכון שלך שלח הודעה: ״אני עדיין פה, אם מישהו שואל.״',
    icon: 'bi-emoji-frown',
    iconColor: '#64748b',
  },
  {
    id: 'asakim-ptsd',
    text: 'כל פעם שמישהו אומר ״בוא נחלק חשבון״ אתה מקבל טיק בעין.',
    icon: 'bi-eye',
    iconColor: '#1a73e8',
  },
  {
    id: 'end-month-ramen',
    text: 'סוף חודש: האקדמיה ללשון הכריזה ש״נודלס״ זה ארוחת גורמה.',
    icon: 'bi-fire',
    iconColor: '#f97316',
  },
  {
    id: 'supermarket-betrayal',
    text: '״רק חלב ולחם״ אמרת. יצאת עם 3 שקיות ובלי כבוד עצמי.',
    icon: 'bi-cart4',
    iconColor: '#ec4899',
  },
  {
    id: 'bank-app-jumpscare',
    text: 'אפליקציית הבנק צריכה להיות מדורגת 18+ בגלל תוכן מטריד.',
    icon: 'bi-exclamation-diamond',
    iconColor: '#dc2626',
  },
];

const functionalTips: Tip[] = [
  {
    id: 'auto-bg',
    text: 'האפליקציה רצה ברקע ומסנכרנת לבד. אין צורך לפתוח אותה!',
    icon: 'bi-magic',
    iconColor: '#8b5cf6',
  },
  {
    id: 'encrypted',
    text: 'הסיסמאות מוצפנות ונשמרות רק על המחשב שלך',
    icon: 'bi-shield-lock',
    iconColor: '#10b981',
  },
  {
    id: 'multi-account',
    text: 'אפשר להוסיף כמה חשבונות שרוצים — בנקים וכרטיסי אשראי',
    icon: 'bi-collection',
    iconColor: '#1a73e8',
  },
  {
    id: 'auto-update',
    text: 'הנתונים מתעדכנים אוטומטית כל כמה שעות',
    icon: 'bi-clock-history',
    iconColor: '#6366f1',
  },
  {
    id: 'money-sleep',
    text: 'הכסף שלך לא ישן — גם אם אתה כן',
    icon: 'bi-moon-stars',
    iconColor: '#6366f1',
  },
  {
    id: 'tray-mode',
    text: 'סגרת את החלון? האפליקציה ממשיכה לעבוד ליד השעון',
    icon: 'bi-window-desktop',
    iconColor: '#1a73e8',
  },
  {
    id: 'json-export',
    text: 'כל העסקאות נשמרות בקובץ JSON מסודר על המחשב',
    icon: 'bi-file-earmark-code',
    iconColor: '#10b981',
  },
];

const colorPalettes: Record<string, { g1: string; g2: string; glow: [number, number, number] }> = {
  '#ef4444': { g1: '#fee2e2', g2: '#fecaca', glow: [239, 68, 68] },
  '#f59e0b': { g1: '#fef3c7', g2: '#fde68a', glow: [245, 158, 11] },
  '#ec4899': { g1: '#fce7f3', g2: '#fbcfe8', glow: [236, 72, 153] },
  '#dc2626': { g1: '#fee2e2', g2: '#fecaca', glow: [220, 38, 38] },
  '#6366f1': { g1: '#e0e7ff', g2: '#c7d2fe', glow: [99, 102, 241] },
  '#f97316': { g1: '#ffedd5', g2: '#fed7aa', glow: [249, 115, 22] },
  '#8b5cf6': { g1: '#ede9fe', g2: '#ddd6fe', glow: [139, 92, 246] },
  '#10b981': { g1: '#d1fae5', g2: '#a7f3d0', glow: [16, 185, 129] },
  '#1a73e8': { g1: '#dbeafe', g2: '#bfdbfe', glow: [26, 115, 232] },
  '#64748b': { g1: '#f1f5f9', g2: '#e2e8f0', glow: [100, 116, 139] },
};

const defaultPalette = { g1: '#e0e7ff', g2: '#dbeafe', glow: [99, 102, 241] as [number, number, number] };

function getColorPalette(iconColor: string) {
  return colorPalettes[iconColor] || defaultPalette;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const SidebarTips = () => {
  const configStore = useConfigStore();

  const shuffledFunny = useRef(shuffleArray(funnyTips));
  const shuffledFunctional = useRef(shuffleArray(functionalTips));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [leavingTip, setLeavingTip] = useState<Tip | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [orbPulse, setOrbPulse] = useState(false);
  const rotationCount = useRef(0);
  const currentTipRef = useRef<Tip | null>(null);

  const getActiveContextualTips = useCallback((): Tip[] => {
    return contextualTips.filter((tip) => {
      if (tip.condition === 'hasErrors') return configStore.lastScrapeSummary.errors.length > 0;
      if (tip.condition === 'noBase44Uuid') return !configStore.config?.outputVendors?.json?.options?.base44UserUuid;
      if (tip.condition === 'isScraping') return configStore.isScraping;
      return false;
    });
  }, [configStore]);

  const getActiveTips = useCallback((): Tip[] => {
    const contextual = getActiveContextualTips();
    const funny = shuffledFunny.current;
    const functional = shuffledFunctional.current;

    const interleaved: Tip[] = [];
    const maxLen = Math.max(funny.length, functional.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < funny.length) interleaved.push(funny[i]);
      if (i < functional.length) interleaved.push(functional[i]);
    }

    if (contextual.length === 0) return interleaved;
    const result: Tip[] = [];
    let cIdx = 0;
    for (let i = 0; i < interleaved.length; i++) {
      if ((i + 1) % 4 === 0 && cIdx < contextual.length) {
        result.push(contextual[cIdx++]);
      }
      result.push(interleaved[i]);
    }
    while (cIdx < contextual.length) result.push(contextual[cIdx++]);
    return result;
  }, [getActiveContextualTips]);

  const activeTips = getActiveTips();
  const currentTip = activeTips[currentIndex % activeTips.length];
  currentTipRef.current = currentTip || null;

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused) return;

      rotationCount.current++;
      setLeavingTip(currentTipRef.current);
      setCurrentIndex((prev) => (prev + 1) % getActiveTips().length);
      setOrbPulse(true);

      setTimeout(() => {
        setLeavingTip(null);
        setOrbPulse(false);
      }, 400);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, getActiveTips]);

  if (!currentTip) return null;

  const palette = getColorPalette(currentTip.iconColor);
  const containerStyle = {
    '--bg-g1': palette.g1,
    '--bg-g2': palette.g2,
    '--glow-color': `${palette.glow[0]}, ${palette.glow[1]}, ${palette.glow[2]}`,
  } as React.CSSProperties;

  return (
    <div
      className={styles.container}
      style={containerStyle}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={styles.particle}
        style={{ '--x': '15%', '--duration': '6s', '--delay': '0s', '--drift': '10px' } as React.CSSProperties}
      />
      <div
        className={styles.particle}
        style={{ '--x': '45%', '--duration': '8s', '--delay': '1.5s', '--drift': '-15px' } as React.CSSProperties}
      />
      <div
        className={styles.particle}
        style={{ '--x': '70%', '--duration': '7s', '--delay': '3s', '--drift': '8px' } as React.CSSProperties}
      />
      <div
        className={styles.particle}
        style={{ '--x': '88%', '--duration': '9s', '--delay': '4.5s', '--drift': '-12px' } as React.CSSProperties}
      />

      <div className={styles.header}>ידעת?</div>

      <div className={styles.orbContainer}>
        <div className={`${styles.orb} ${orbPulse ? styles.orbPulse : ''}`}>
          <i className={`bi ${currentTip.icon} ${styles.orbIcon}`} style={{ color: currentTip.iconColor }} />
        </div>
      </div>

      <div className={styles.textContainer}>
        {leavingTip && (
          <div className={`${styles.tipText} ${styles.leaving}`} key={`leave-${rotationCount.current}`}>
            {leavingTip.text}
          </div>
        )}
        <div className={`${styles.tipText} ${leavingTip ? styles.entering : ''}`} key={`curr-${rotationCount.current}`}>
          {currentTip.text}
        </div>
      </div>
    </div>
  );
};

export default observer(SidebarTips);
// [CUSTOM-SIDEBAR-TIPS-END]
