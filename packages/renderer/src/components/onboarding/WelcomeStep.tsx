// [CUSTOM-ONBOARDING-START]
import { useState, useEffect, useRef } from 'react';
import { importerIcons } from '../../assets';
import logoFishOnly from '../../assets/logos/logoFishOnly.svg';
import ssOverview from '../../assets/webapp-screenshot.png';
import ssStory from '../../assets/webapp-screenshot-story.png';
import ssSubscriptions from '../../assets/webapp-screenshot-subscriptions.png';
import ssCategories from '../../assets/webapp-screenshot-categories.png';
import styles from './WelcomeStep.module.css';

const bankLogos = Object.values(importerIcons);
const marqueeLogos = [...bankLogos, ...bankLogos];

const SLIDES = [
  { img: ssOverview,       caption: 'סקירה כללית — הכנסות, הוצאות ומאזן חודשי' },
  { img: ssStory,          caption: 'הסיפור של הכסף שלך — ניתוח חכם אישי' },
  { img: ssCategories,     caption: 'הוצאות לפי קטגוריה — תרשים עוגה אינטראקטיבי' },
  { img: ssSubscriptions,  caption: 'המנויים שלי — כל המנויים הקבועים במקום אחד' },
];

const AUTO_ADVANCE_MS = 3500;

export default function WelcomeStep() {
  const [visible, setVisible] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-advance
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveSlide((s) => (s + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const goTo = (i: number) => {
    setActiveSlide(i);
    startTimer(); // reset timer on manual nav
  };

  const goPrev = () => goTo((activeSlide - 1 + SLIDES.length) % SLIDES.length);
  const goNext = () => goTo((activeSlide + 1) % SLIDES.length);

  return (
    <div className={styles.container}>
      {/* Hero */}
      <img
        src={logoFishOnly}
        alt="MoneyMoney"
        className={`${styles.logo} ${visible ? styles.visible : ''}`}
      />
      <h2 className={`${styles.headline} ${visible ? styles.visible : ''}`}>
        ברוכים הבאים ל-MoneyMoney!
      </h2>
      <p className={`${styles.subtitle} ${visible ? styles.visible : ''}`}>
        כל הכסף שלך. במקום אחד. אוטומטית.
      </p>

      {/* Screenshot carousel in browser mockup */}
      <div className={`${styles.screenshotSection} ${visible ? styles.visible : ''}`}>
        <div className={styles.browserMockup}>
          {/* Browser chrome */}
          <div className={styles.browserChrome}>
            <div className={styles.browserDots}>
              <div className={`${styles.dot} ${styles.dotRed}`} />
              <div className={`${styles.dot} ${styles.dotYellow}`} />
              <div className={`${styles.dot} ${styles.dotGreen}`} />
            </div>
            <div className={styles.browserUrl}>moneym.base44.app</div>
          </div>

          {/* Slides with side arrows overlaid */}
          <div className={styles.carouselViewport}>
            {SLIDES.map((slide, i) => (
              <div key={i} className={`${styles.carouselSlide} ${i === activeSlide ? styles.active : ''}`}>
                <img src={slide.img} alt={slide.caption} className={styles.screenshotImg} />
              </div>
            ))}
            {/* Right arrow → go to previous (RTL: right = backward) */}
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
              onClick={goPrev}
              aria-label="הקודם"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
            {/* Left arrow → go to next (RTL: left = forward) */}
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
              onClick={goNext}
              aria-label="הבא"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
          </div>

          {/* Caption + dots footer */}
          <div className={styles.carouselFooter}>
            <div className={styles.carouselDots}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.carouselDot} ${i === activeSlide ? styles.activeDot : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`מסך ${i + 1}`}
                />
              ))}
            </div>
            <span className={styles.slideCaption}>{SLIDES[activeSlide].caption}</span>
          </div>
        </div>
      </div>

      {/* Bank logos marquee */}
      <div className={`${styles.marqueeSection} ${visible ? styles.visible : ''}`}>
        <div className={styles.marqueeContainer}>
          <div className={styles.marqueeTrack}>
            {marqueeLogos.map((logo, i) => (
              <img key={i} src={logo} alt="" className={styles.bankLogo} />
            ))}
          </div>
        </div>
        <div className={styles.marqueeCaption}>תומך ב-17+ בנקים וחברות אשראי</div>
      </div>

      {/* Feature chips */}
      <div className={`${styles.featureChips} ${visible ? styles.visible : ''}`}>
        <span className={`${styles.chip} ${styles.chipBlue}`}>
          <i className="bi bi-speedometer2"></i>
          דשבורד חכם
        </span>
        <span className={`${styles.chip} ${styles.chipGreen}`}>
          <i className="bi bi-arrow-repeat"></i>
          סנכרון אוטומטי
        </span>
        <span className={`${styles.chip} ${styles.chipAmber}`}>
          <i className="bi bi-shield-lock"></i>
          אבטחה מלאה
        </span>
      </div>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
