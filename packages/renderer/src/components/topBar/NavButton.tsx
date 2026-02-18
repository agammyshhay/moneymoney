import { Button } from 'react-bootstrap';
import styles from './NavButton.module.css';

interface NavButtonProps {
  text: string;
  onClick: () => void;
  icon?: React.ReactNode;
  isActive?: boolean;
}

function NavButton({ onClick, text, icon, isActive }: NavButtonProps) {
  return (
    <Button
      variant="light"
      onClick={onClick}
      className={`${styles.navButton} ${isActive ? styles.navButtonActive : ''}`}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {text}
    </Button>
  );
}

export default NavButton;
