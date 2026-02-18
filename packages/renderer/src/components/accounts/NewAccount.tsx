import plusCircle from '../../assets/plus-circle.svg';
import styles from './NewAccount.module.css';

interface NewAccountProps {
  onClick: () => void;
}

export default function NewAccount({ onClick }: NewAccountProps) {
  return (
    <div className={styles.container} onClick={onClick}>
      <div className={styles.iconWrapper}>
        <img className={styles.image} src={plusCircle} alt={'חשבון חדש'} height={24} width={24} />
      </div>
      <div className={styles.nameWrapper}>
        <div className={styles.name}>חשבון חדש</div>
      </div>
    </div>
  );
}
