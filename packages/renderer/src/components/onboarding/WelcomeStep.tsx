// [CUSTOM-ONBOARDING-START]
import styles from './WelcomeStep.module.css';

export default function WelcomeStep() {
  return (
    <div className={styles.container}>
      <h2 className={styles.headline}>!ברוכים הבאים ל-MoneyMoney</h2>
      <p className={styles.subtitle}>הדרך הקלה לעקוב אחרי הכסף שלך</p>
      <ul className={styles.features}>
        <li className={styles.feature}>
          <i className={`bi bi-bank ${styles.featureIcon}`}></i>
          <span>מושך אוטומטית תנועות מהבנק ומכרטיסי האשראי שלך</span>
        </li>
        <li className={styles.feature}>
          <i className={`bi bi-arrow-repeat ${styles.featureIcon}`}></i>
          <span>מסנכרן את הנתונים ל-MoneyMoney לניהול תקציב חכם</span>
        </li>
        <li className={styles.feature}>
          <i className={`bi bi-shield-lock ${styles.featureIcon}`}></i>
          <span>שמות המשתמש והסיסמאות נשמרים מוצפנים על המחשב שלך בלבד ולעולם לא יוצאים ממנו</span>
        </li>
      </ul>
    </div>
  );
}
// [CUSTOM-ONBOARDING-END]
