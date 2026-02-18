import { useState } from 'react';
import { Container, Stack, Modal } from 'react-bootstrap';
import NavBar from 'react-bootstrap/Navbar';

import NavButton from './NavButton';
import ReportProblemModal from './ReportProblemModal';
import SecurityInfoModal from './SecurityInfoModal';
import GeneralSettings from '../GeneralSettings';
import logoFishOnly from '../../assets/logos/logoFishOnly.svg';
import styles from './TopBar.module.css';

function TopBar() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  return (
    <>
      <NavBar className={styles.topNavBar}>
        <Container fluid style={{ position: 'relative', height: '100%' }}>
          {/* Logo - Positioned absolutely to the right */}
          <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            <NavBar.Brand style={{ margin: 0, padding: 0 }}>
              <Stack direction="horizontal" gap={2} className="align-items-center">
                <img src={logoFishOnly} alt="MoneyMoney" height={36} width={36} style={{ borderRadius: 8 }} />
                <span className={styles.brandText}>MoneyMoney</span>
              </Stack>
            </NavBar.Brand>
          </div>

          {/* Centered Buttons */}
          <Stack direction="horizontal" gap={4} className="justify-content-center w-100" style={{ height: '100%' }}>
            <NavButton
              onClick={() => setShowSecurity(true)}
              text="איך המידע שלי נשמר?"
              icon={<i className="bi bi-shield-check"></i>}
              isActive={showSecurity}
            />
            <NavButton
              onClick={() => setShow(true)}
              text="דיווח על בעיה"
              icon={<i className="bi bi-exclamation-circle"></i>}
              isActive={show}
            />
            <NavButton
              onClick={() => setShowSettings(true)}
              text="הגדרות"
              icon={<i className="bi bi-gear"></i>}
              isActive={showSettings}
            />
          </Stack>
        </Container>
      </NavBar>
      <ReportProblemModal show={show} onClose={() => setShow(false)} />
      <SecurityInfoModal show={showSecurity} onClose={() => setShowSecurity(false)} />

      <Modal show={showSettings} onHide={() => setShowSettings(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>הגדרות</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          <GeneralSettings />
        </Modal.Body>
      </Modal>
    </>
  );
}

export default TopBar;
