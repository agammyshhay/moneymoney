import { getAppInfo, getLogsInfo, openExternal } from '#preload';
import { useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Stack } from 'react-bootstrap';
import { getZIndexes } from '../../utils/zIndexesManager';
import LogsCanvas from './LogsCanvas';

const NUM_OF_LAST_LINES = 10;
const GITHUB_REPO = 'agammyshhay/moneymoney';
const MAX_BODY_LENGTH = 6000;

function sanitizeLogs(logs: string): string {
  return (
    logs
      // Redact sequences of 5+ digits (account numbers, card numbers)
      .replace(/\b\d{5,}\b/g, '[REDACTED]')
      // Redact Windows user paths
      .replace(/C:\\Users\\[^\\]+\\/gi, 'C:\\Users\\[USER]\\')
      // Redact values after sensitive keys
      .replace(/(apiKey|token|secret|password|api_key|apiSecret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
  );
}

interface ReportProblemForm {
  title: string;
  details: string;
  attachedLogs: boolean;
}

interface ReportProblemModalProps {
  show: boolean;
  onClose: () => void;
}

function ReportProblemModal({ show, onClose }: ReportProblemModalProps) {
  const [logsFolder, setLogsFolder] = useState<string>();
  const [lastLines, setLastLines] = useState<string>();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const logInfo = await getLogsInfo(NUM_OF_LAST_LINES);
      setLogsFolder(logInfo.logsFolder);
      setLastLines(logInfo.lastLines);
    };

    fetchData();
  }, []);

  const [form, setForm] = useState<ReportProblemForm>({
    title: '',
    details: '',
    attachedLogs: true,
  });

  const [titleError, setTitleError] = useState<string>();
  const [showLogs, setShowLogs] = useState(false);

  const setField = (field: keyof ReportProblemForm, value: string) => {
    setForm((prevForm) => ({ ...prevForm, [field]: value }));
    if (field === 'title' && titleError) setTitleError(undefined);
  };

  const sendReport = async () => {
    if (!form.title.trim()) {
      setTitleError('שדה חובה');
      return;
    }

    const appInfo = await getAppInfo();
    const systemInfo = `**מערכת:** ${appInfo.osPlatform} ${appInfo.osArch} ${appInfo.osRelease}\n**גרסה:** ${appInfo.currentVersion}`;

    const bodyParts: string[] = [];
    if (form.details.trim()) {
      bodyParts.push(form.details.trim());
    }
    if (form.attachedLogs && lastLines) {
      const sanitized = sanitizeLogs(lastLines);
      bodyParts.push(`### לוגים\n\`\`\`\n${sanitized}\n\`\`\``);
    }
    bodyParts.push(`### פרטי מערכת\n${systemInfo}`);

    let body = bodyParts.join('\n\n');
    if (body.length > MAX_BODY_LENGTH) {
      body = body.substring(0, MAX_BODY_LENGTH) + '\n\n...(קוצר בגלל מגבלת אורך)';
    }

    const url = `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(form.title.trim())}&body=${encodeURIComponent(body)}`;
    try {
      await openExternal(url);
    } catch {
      // If opening the URL fails, still allow the modal to close
    }

    setOpened(true);
    setTimeout(() => {
      onHide();
    }, 2000);
  };

  const onHide = () => {
    onClose();
    setForm({ title: '', details: '', attachedLogs: true });
    setTitleError(undefined);
    setOpened(false);
  };

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        size="lg"
        aria-labelledby="contained-modal-title-vcenter"
        centered
        backdrop="static"
        keyboard={false}
        style={{ zIndex: getZIndexes().modal }}
      >
        <Modal.Header closeButton>
          <div className="row justify-content-center">
            <Modal.Title>דיווח על באג</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body>
          {opened ? (
            <Alert variant="success" className="mb-0">
              <Alert.Heading>הדיווח נפתח בדפדפן!</Alert.Heading>
              <p>עמוד GitHub Issues נפתח בדפדפן. לחץ &quot;Submit new issue&quot; כדי לשלוח.</p>
            </Alert>
          ) : (
            <>
              <Form.Group className="mb-3" controlId="title">
                <Form.Label>כותרת</Form.Label>
                <Form.Control
                  type="text"
                  aria-describedby="title"
                  required
                  value={form.title}
                  isInvalid={!!titleError}
                  onChange={(e) => setField('title', e.target.value)}
                  autoFocus
                />
                <Form.Control.Feedback type="invalid">{titleError}</Form.Control.Feedback>
                <Form.Text muted>נא לתאר את הבאג במשפט אחד</Form.Text>
              </Form.Group>

              <Form.Control
                as="textarea"
                aria-label="With textarea"
                placeholder="פרטי הבאג"
                className="mb-4"
                value={form.details}
                onChange={(e) => setField('details', e.target.value)}
              />
              <Form.Group className="mb-4" as={Col} md="2">
                <Form.Check
                  type="checkbox"
                  label="צירוף קבצי לוג"
                  checked={form.attachedLogs === true}
                  onChange={(e) =>
                    setForm((prevForm) => ({
                      ...prevForm,
                      attachedLogs: e.target.checked,
                    }))
                  }
                />
                (
                <Button variant="link" onClick={() => setShowLogs(true)}>
                  צפיה בלוגים
                </Button>
                )
              </Form.Group>

              <div className="mb-4">אפשר למצוא את הלוגים פה: {logsFolder}</div>
              <Stack direction="horizontal" gap={3}>
                <Button variant="light" onClick={onClose}>
                  סגור
                </Button>
                <Button variant="dark" name="send-report" onClick={sendReport}>
                  פתיחת דיווח ב-GitHub
                </Button>
              </Stack>
            </>
          )}
        </Modal.Body>
      </Modal>
      <LogsCanvas show={showLogs} handleClose={() => setShowLogs(false)} lastLines={lastLines} />
    </>
  );
}

export default ReportProblemModal;
