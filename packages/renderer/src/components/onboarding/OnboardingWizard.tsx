// [CUSTOM-ONBOARDING-START]
import { observer } from 'mobx-react-lite';
import { useState, useRef } from 'react';
import { Modal } from 'react-bootstrap';
import WelcomeStep from './WelcomeStep';
import ConnectStep from './ConnectStep';
import AddAccountStep from './AddAccountStep';
import styles from './OnboardingWizard.module.css';

type WizardStep = 'welcome' | 'connect' | 'addAccount';

const STEPS: WizardStep[] = ['welcome', 'connect', 'addAccount'];
const STEP_LABELS: Record<WizardStep, string> = {
  welcome: 'ברוכים הבאים',
  connect: 'חיבור',
  addAccount: 'הוספת חשבון',
};

interface OnboardingWizardProps {
  show: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

function OnboardingWizard({ show, onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [transitionKey, setTransitionKey] = useState(0);
  const animatingRef = useRef(false);

  const currentIndex = STEPS.indexOf(currentStep);

  const goNext = () => {
    if (animatingRef.current) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      animatingRef.current = true;
      setTransitionKey((k) => k + 1);
      setCurrentStep(STEPS[nextIndex]);
      setTimeout(() => {
        animatingRef.current = false;
      }, 350);
    }
  };

  const goBack = () => {
    if (animatingRef.current) return;
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      animatingRef.current = true;
      setTransitionKey((k) => k + 1);
      setCurrentStep(STEPS[prevIndex]);
      setTimeout(() => {
        animatingRef.current = false;
      }, 350);
    }
  };

  // [CUSTOM-BASE44-START]
  const [hasToken, setHasToken] = useState(false);
  // [CUSTOM-BASE44-END]

  const handleConnectNext = () => {
    if (hasToken) {
      goNext();
    }
  };

  const handleConnectSkipStep = () => {
    goNext();
  };

  const handleAccountAdded = () => {
    onComplete();
  };

  const canAdvanceConnect = hasToken;

  return (
    <Modal show={show} size="lg" centered backdrop="static" keyboard={false} dialogClassName={styles.wizardModal}>
      {/* Gradient accent bar */}
      <div className={styles.gradientBar} />

      <Modal.Body className={styles.wizardBody}>
        {/* Segmented progress bar */}
        <div className={styles.progressBar}>
          {STEPS.map((step, i) => (
            <div key={step} className={styles.progressSegment}>
              <div className={styles.progressTrack}>
                <div
                  className={`${styles.progressFill} ${
                    i === currentIndex
                      ? styles.progressFillActive
                      : i < currentIndex
                        ? styles.progressFillCompleted
                        : ''
                  }`}
                />
              </div>
              <span
                className={`${styles.progressLabel} ${
                  i === currentIndex
                    ? styles.progressLabelActive
                    : i < currentIndex
                      ? styles.progressLabelCompleted
                      : ''
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          ))}
        </div>

        {/* Step content with transition */}
        <div className={styles.stepContent}>
          <div key={transitionKey} className={styles.stepTransition}>
            {currentStep === 'welcome' && <WelcomeStep />}
            {currentStep === 'connect' && (
              <ConnectStep onSkipStep={handleConnectSkipStep} onConnected={() => setHasToken(true)} />
            )}
            {currentStep === 'addAccount' && <AddAccountStep onAccountAdded={handleAccountAdded} />}
          </div>
        </div>
      </Modal.Body>

      <div className={styles.wizardFooter}>
        <div className={styles.footerStart}>
          <button type="button" className={styles.skipLink} onClick={onSkip}>
            דלג על ההגדרה
          </button>
          <span className={styles.stepCounter}>
            שלב {currentIndex + 1} מתוך {STEPS.length}
          </span>
        </div>
        <div className={styles.buttonsRow}>
          {currentIndex > 0 && (
            <button type="button" className={styles.backButton} onClick={goBack}>
              <i className={`bi bi-chevron-right ${styles.backArrow}`}></i>
              חזור
            </button>
          )}
          {currentStep === 'welcome' && (
            <button type="button" className={styles.primaryButton} onClick={goNext}>
              בואו נתחיל <span className={styles.buttonArrow}>&larr;</span>
            </button>
          )}
          {currentStep === 'connect' && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleConnectNext}
              disabled={!canAdvanceConnect}
            >
              המשך <span className={styles.buttonArrow}>&larr;</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default observer(OnboardingWizard);
// [CUSTOM-ONBOARDING-END]
