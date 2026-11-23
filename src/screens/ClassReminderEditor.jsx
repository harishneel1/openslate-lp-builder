import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmailCard, EmailPreview, useLeaveWarning, useTestEmail } from './ReminderEditor';
import {
  CLASS_FIELDS,
  JOIN_LABEL,
  SAMPLE_STUDENT,
  classEmailValues,
  classFooterOf,
  classReminderById,
  goesLine,
} from '../data/classReminders';
import './ReminderEditor.css';
import './CallReminderEditor.css';

// ------------------------------------------------------------
// Editing one of a live class's emails: a full page, opened from the
// pencil on the class's Reminders tab (ClassEmails.jsx). The same page as
// a 1:1 call's email editor (CallReminderEditor.jsx), from the webinar
// email editor's parts (ReminderEditor.jsx):
//
//   [focus bar: ← Your class]
//   1 hour before           Reset to default template  [Send me a test]  [Save email]
//   Goes out 1 hour before each class.
//   ┌ the email, with fill-in fields ┐  ╭━━━━━━━━━━━━━━━━━━━━━╮
//   │ Subject  [Starting in 1 hour…] │  ┃ the inbox, on a      ┃
//   │ B I 🔗 •      + Insert detail  │  ┃ tablet, filled in    ┃
//   │ Hi (First name), …             │  ┃ for Priya            ┃
//   │ [ Join class ]                 │  ╰━━━━━━━━━━━━━━━━━━━━━╯
//   └────────────────────────────────┘
//
// The Join class button is fixed: it opens the class's Zoom room.
//
// reminderId: 'welcome' | 'dayBefore' | 'hourBefore' | 'fiveBefore'
// value: the words to start from ({ subject, body }: emailTextOf)
// batch: the class, for the preview
// hostName: the coach's name, for the preview
// onApply({ subject, body }): Save email
// onClose(): back to the class, without these words
// exitRef: the focus bar's way back; exitRef.current() asks first about
//   unsaved changes
// ------------------------------------------------------------
export default function ClassReminderEditor({ reminderId, value, batch, hostName, onApply, onClose, exitRef }) {
  const reminder = classReminderById(reminderId);
  const [draft, setDraft] = useState(value);
  // What the boxes are filled with; a new cardKey fills them again (Reset)
  const [start, setStart] = useState(value);
  const [cardKey, setCardKey] = useState(0);
  const [ask, setAsk] = useState(null); // 'leave' | 'reset'
  const tester = useTestEmail();

  const dirty = draft.subject !== value.subject || draft.body !== value.body;
  const emptySubject = !draft.subject;
  const isTemplate = draft.subject === reminder.subject && draft.body === reminder.body;
  const now = Date.now();
  const values = useMemo(() => classEmailValues(batch, SAMPLE_STUDENT, hostName), [batch, hostName]);

  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, []);

  useLeaveWarning(dirty);

  const back = () => (dirty ? setAsk('leave') : onClose());
  if (exitRef) exitRef.current = back;

  const apply = () => {
    if (!dirty || emptySubject) return;
    onApply({ subject: draft.subject, body: draft.body });
  };

  const reset = () => {
    const template = { subject: reminder.subject, body: reminder.body };
    setStart(template);
    setDraft(template);
    setCardKey((k) => k + 1);
    setAsk(null);
  };

  return (
    <div className="re cre">
      <header className="re__head">
        <div className="re__intro">
          <h1 className="re__title">{reminder.name}</h1>
          <p className="re__status">{goesLine(reminder)}</p>
        </div>
        <div className="re__actions">
          {!isTemplate && (
            <button type="button" className="re__reset" onClick={() => setAsk('reset')}>
              <RotateCcw size={14} aria-hidden="true" /> Reset to default template
            </button>
          )}
          {tester.button}
          {/* The hint sits on a wrapper: a disabled button gets no hover */}
          <span
            className="re__save-wrap"
            data-tip={!dirty ? 'No changes yet' : emptySubject ? 'Add a subject to use it' : undefined}
            data-tip-align="end"
          >
            <button type="button" className="oh__add re__btn re__save" onClick={apply} disabled={!dirty || emptySubject}>
              Save email
            </button>
          </span>
        </div>
      </header>

      <p className="re__note">{reminder.editNote ?? 'Classes from now on get the new words.'}</p>

      {tester.bar}

      <div className="re__grid">
        <EmailCard
          key={cardKey}
          initial={start}
          onChange={setDraft}
          fields={CLASS_FIELDS}
          join={{ label: JOIN_LABEL, tip: 'Opens the class’s Zoom room' }}
        />
        <EmailPreview
          draft={draft}
          values={values}
          now={now}
          join
          joinLabel={JOIN_LABEL}
          toEmail={SAMPLE_STUDENT.email}
          footer={classFooterOf(values)}
          note={`Every student gets this same email with their own first name. ${values.first_name} is an example.`}
        />
      </div>

      {ask === 'leave' && (
        <ConfirmDialog
          title="Leave without saving this email?"
          confirmLabel="Leave without saving"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            onClose();
          }}
        >
          <p>Your changes to this email will be lost.</p>
        </ConfirmDialog>
      )}
      {ask === 'reset' && (
        <ConfirmDialog
          title="Go back to the default template?"
          confirmLabel="Use default template"
          stayOpen
          closeButton
          onCancel={() => setAsk(null)}
          onConfirm={reset}
        >
          <p>Your changes to this email will be replaced with the default template.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
