import { useState } from 'react';
import { Button, Card, Form, Image } from 'react-bootstrap';
import { IMPORTERS_LOGIN_FIELDS, LOGIN_FIELD_DISPLAY_NAMES, LOGIN_FIELD_MIN_LENGTH } from '../../accountMetadata';
import { type Importer } from '../../types';
import styles from './EditImporter.module.css';

interface EditImporterProps {
  handleSave: (importer: Importer) => Promise<void>;
  handleDelete: (id: string) => Promise<void> | void;
  importer: Importer;
}

export default function EditImporter({ handleSave, handleDelete, importer }: EditImporterProps) {
  const [loginFields, setLoginFields] = useState<Record<string, string>>(importer.loginFields || {});
  const [active, setActive] = useState<boolean>(importer.active);
  const [validated, setValidated] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const onSaveClicked = async () => {
    await handleSave({
      ...importer,
      active,
      loginFields,
    });
  };

  const onDeleteClicked = async () => {
    if (showDeleteConfirm) {
      await handleDelete(importer.id);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const checkFieldValidity = (loginFieldName: keyof typeof LOGIN_FIELD_MIN_LENGTH, value: string): boolean => {
    return value.length >= LOGIN_FIELD_MIN_LENGTH[loginFieldName];
  };

  const checkFieldsValidity = (fieldsToCheck: Record<string, string>) => {
    setValidated(
      Object.entries(fieldsToCheck).every(([key, value]) =>
        checkFieldValidity(key as keyof typeof LOGIN_FIELD_MIN_LENGTH, value),
      ),
    );
  };

  const onLoginFieldChanged = (loginFieldName: string, loginFieldValue: string) => {
    setLoginFields((prevLoginFields) => {
      const nextLoginFields = {
        ...prevLoginFields,
        [loginFieldName]: loginFieldValue,
      };

      checkFieldsValidity(nextLoginFields);

      return nextLoginFields;
    });
  };

  const onActiveChanged = () => {
    setActive((prevActive) => !prevActive);
    checkFieldsValidity(loginFields);
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Image className={styles.logo} src={importer.logo} roundedCircle width={100} height={100} />
        <Card.Body className={styles.cardBody}>
          <Form>
            {IMPORTERS_LOGIN_FIELDS[importer.companyId as keyof typeof IMPORTERS_LOGIN_FIELDS].map(
              (loginField: string, index: number) => (
                <Form.Group key={loginField} className={styles.formGroup} controlId={loginField}>
                  <Form.Control
                    placeholder={LOGIN_FIELD_DISPLAY_NAMES[loginField as keyof typeof LOGIN_FIELD_DISPLAY_NAMES]}
                    type={loginField === 'password' ? 'password' : ''}
                    value={loginFields[loginField]}
                    onChange={(event) => onLoginFieldChanged(loginField, event.target.value)}
                    autoFocus={index === 0}
                  />
                </Form.Group>
              ),
            )}
            <Form.Check type="switch" onChange={onActiveChanged} label="פעיל" checked={active} />
            <div className={styles.actionButtonsWrapper}>
              {!showDeleteConfirm ? (
                <>
                  <Button variant="primary" onClick={onSaveClicked} disabled={!validated}>
                    שמור
                  </Button>
                  <Button variant="danger" onClick={onDeleteClicked}>
                    מחק
                  </Button>
                </>
              ) : (
                <div className="d-flex flex-column align-items-center w-100">
                  <p className="text-danger mb-2 text-center">האם אתה בטוח שברצונך למחוק חשבון זה?</p>
                  <div className="d-flex gap-2">
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                      ביטול
                    </Button>
                    <Button variant="danger" onClick={onDeleteClicked}>
                      כן, מחק
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
