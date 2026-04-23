import { useState } from 'react';
import { Button, Card, Form, Image } from 'react-bootstrap';
import { updateImporterCredentials } from '#preload';
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
  const [validated, setValidated] = useState(!!importer.hasCredentials);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // [CUSTOM-FIX-START] — Track whether the user has typed in credential fields
  const [hasEditedCredentials, setHasEditedCredentials] = useState(false);
  const isNewAccount = !importer.hasCredentials;
  // [CUSTOM-FIX-END]

  const onSaveClicked = async () => {
    // [CUSTOM-FIX-START] — Credentials flow directly to main, never through MobX store
    const hasNewCredentials = Object.values(loginFields).some((v) => v.length > 0);

    if (!isNewAccount && hasNewCredentials) {
      // Existing account: send credentials directly to main process
      await updateImporterCredentials(importer.id, loginFields);
    }

    await handleSave({
      ...importer,
      active,
      // New account: include credentials (flow through autorun to main)
      // Existing account: strip credentials (already sent via dedicated IPC)
      loginFields: isNewAccount ? loginFields : {},
    });
    // [CUSTOM-FIX-END]
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

  const checkFieldsValidity = (fieldsToCheck: Record<string, string>, edited: boolean) => {
    // [CUSTOM-FIX-START]
    // Existing account with saved credentials: valid even if user hasn't edited
    if (!edited && importer.hasCredentials) {
      setValidated(true);
      return;
    }
    // [CUSTOM-FIX-END]
    const requiredFields = IMPORTERS_LOGIN_FIELDS[importer.companyId as keyof typeof IMPORTERS_LOGIN_FIELDS] ?? [];
    setValidated(
      requiredFields.every((field) =>
        checkFieldValidity(field as keyof typeof LOGIN_FIELD_MIN_LENGTH, fieldsToCheck[field] ?? ''),
      ),
    );
  };

  const onLoginFieldChanged = (loginFieldName: string, loginFieldValue: string) => {
    setLoginFields((prevLoginFields) => {
      const nextLoginFields = {
        ...prevLoginFields,
        [loginFieldName]: loginFieldValue,
      };

      // [CUSTOM-FIX-START]
      setHasEditedCredentials(true);
      checkFieldsValidity(nextLoginFields, true);
      // [CUSTOM-FIX-END]

      return nextLoginFields;
    });
  };

  const onActiveChanged = () => {
    setActive((prevActive) => !prevActive);
    checkFieldsValidity(loginFields, hasEditedCredentials);
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Image className={styles.logo} src={importer.logo} roundedCircle width={100} height={100} />
        <Card.Body className={styles.cardBody}>
          <Form>
            {/* [CUSTOM-FIX-START] — Show "credentials saved" indicator for existing accounts */}
            {importer.hasCredentials && !hasEditedCredentials && (
              <div className="text-muted small mb-2 text-center">
                <i className="bi bi-check-circle me-1"></i>
                פרטי התחברות שמורים. הזן ערכים חדשים כדי לעדכן.
              </div>
            )}
            {/* [CUSTOM-FIX-END] */}
            {IMPORTERS_LOGIN_FIELDS[importer.companyId as keyof typeof IMPORTERS_LOGIN_FIELDS].map(
              (loginField: string, index: number) => (
                <Form.Group key={loginField} className={styles.formGroup} controlId={loginField}>
                  <Form.Control
                    placeholder={LOGIN_FIELD_DISPLAY_NAMES[loginField as keyof typeof LOGIN_FIELD_DISPLAY_NAMES]}
                    type={loginField === 'password' ? 'password' : ''}
                    value={loginFields[loginField] ?? ''}
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
