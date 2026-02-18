import { Modal, Button, Stack } from 'react-bootstrap';

interface SecurityInfoModalProps {
  show: boolean;
  onClose: () => void;
}

function SecurityInfoModal({ show, onClose }: SecurityInfoModalProps) {
  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontWeight: 600 }}>איך המידע שלי נשמר?</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '24px', lineHeight: '1.6', fontSize: '1.1rem' }}>
        <Stack gap={4}>
          <div>
            <h5 style={{ fontWeight: 600, color: '#1a73e8', marginBottom: '12px' }}>
              🔒 סיסמאות ושמות משתמש נשמרים רק אצלך
            </h5>
            <p>
              שמות המשתמש והסיסמאות שלך לבנקים נשמרים <strong>אך ורק על המחשב האישי שלך</strong>.
              <br />
              אנו לא שומרים את פרטי ההתחברות הללו בענן שלנו, ואין לנו שום גישה אליהם. הם לעולם לא עוזבים את המחשב שלך.
            </p>
          </div>

          <div>
            <h5 style={{ fontWeight: 600, color: '#1a73e8', marginBottom: '12px' }}>🛡️ איך עובד החיבור לבנק?</h5>
            <p>
              יש דפדפן נסתר שרץ מקומית על המחשב שלך.
              <br />
              הדפדפן הזה משתמש בסיסמאות המוצפנות ששמרת אצלך כדי להתחבר לאתר הבנק - בדיוק כמו שאתה היית עושה ידנית.
              <br />
              כל תהליך ההתחברות והמשיכה מתבצע ישירות מהמחשב שלך מול הבנק, ללא שום גורם מתווך.
            </p>
          </div>

          <div>
            <h5 style={{ fontWeight: 600, color: '#1a73e8', marginBottom: '12px' }}>☁️ מה נשלח ל-MoneyMoney?</h5>
            <p>
              לאחר שהאפליקציה סיימה למשוך את הנתונים מהבנק, היא שולחת ל-MoneyMoney אך ורק את שורות התנועות (תאריך, סכום,
              תיאור העסקה וכו').
              <br />
              המטרה היא לאפשר לך לראות ולנהל את ההוצאות שלך בממשק הנוח של MoneyMoney.
              <br />
              <strong>חשוב להדגיש:</strong> פרטי ההתחברות (סיסמאות ושמות משתמש) לעולם לא נשלחים יחד עם התנועות. הם
              נשארים נעולים במחשב שלך.
            </p>
          </div>

          <div>
            <h5 style={{ fontWeight: 600, color: '#1a73e8', marginBottom: '12px' }}>🔐 סטנדרט האבטחה של MoneyMoney</h5>
            <p>
              MoneyMoney מבוססת על BASE44 של חברת WIX העולמית, ומתבצעת באופן מאובטח ומוצפן (SSL/TLS). השרתים עצמם מוגנים
              בסטנדרטים מחמירים של אבטחת מידע, והמידע שלך משמש אך ורק אותך לניהול הפיננסי האישי שלך.
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              borderRight: '4px solid #1a73e8',
            }}
          >
            <strong>שקיפות מלאה:</strong> הקוד של האפליקציה פתוח לציבור (Open Source), כך שכל מומחה אבטחה יכול לבדוק
            ולוודא שאנו עומדים בהבטחות אלו ושומרים על הפרטיות שלך בקפדנות.
          </div>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          סגור
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SecurityInfoModal;
