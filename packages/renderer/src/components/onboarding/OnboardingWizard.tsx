// [CUSTOM-ONBOARDING-START]
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useConfigStore } from '../../store/ConfigStore';
import WelcomeStep from './WelcomeStep';
import ConnectStep from './ConnectStep';
import AddAccountStep from './AddAccountStep';
import styles from './OnboardingWizard.module.css';

type WizardStep = 'welcome' | 'connect' | 'addAccount';

const STEPS: WizardStep[] = ['welcome', 'connect', 'addAccount'];

interface OnboardingWizardProps {
  show: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

function OnboardingWizard({ show, onComplete, onSkip }: OnboardingWizardProps) {
  const configStore = useConfigStore();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');

  const currentIndex = STEPS.indexOf(currentStep);

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleConnectNext = () => {
    const uuid = configStore.config?.outputVendors?.json?.options?.base44UserUuid ?? '';
    if (uuid.trim()) {
      goNext();
    }
  };

  const handleConnectSkipStep = () => {
    goNext();
  };

  const handleAccountAdded = () => {
    onComplete();
  };

  const uuid = configStore.config?.outputVendors?.json?.options?.base44UserUuid ?? '';
  const canAdvanceConnect = !!uuid.trim();

  return (
    <Modal show={show} size="lg" centered backdrop="static" keyboard={false} dialogClassName={styles.wizardModal}>
      <Modal.Body className={styles.wizardBody}>
        {/* Step indicator dots */}
        <div className={styles.stepIndicator}>
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''} ${i < currentIndex ? styles.dotCompleted : ''}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className={styles.stepContent}>
          {currentStep === 'welcome' && <WelcomeStep />}
          {currentStep === 'connect' && <ConnectStep onSkipStep={handleConnectSkipStep} />}
          {currentStep === 'addAccount' && <AddAccountStep onAccountAdded={handleAccountAdded} />}
        </div>
      </Modal.Body>

      <div className={styles.wizardFooter}>
        <button type="button" className={styles.skipLink} onClick={onSkip}>
          דלג על ההגדרה
        </button>
        <div className={styles.buttonsRow}>
          {currentStep === 'welcome' && (
            <button type="button" className={styles.primaryButton} onClick={goNext}>
              בואו נתחיל &larr;
            </button>
          )}
          {currentStep === 'connect' && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleConnectNext}
              disabled={!canAdvanceConnect}
            >
              המשך &larr;
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default observer(OnboardingWizard);
// [CUSTOM-ONBOARDING-END]
