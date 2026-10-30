import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Lock, RotateCcw } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmailCard, EmailPreview, useLeaveWarning, useTestEmail } from './ReminderEditor';
import {
  CALL_FIELDS,
  JOIN_LABEL,
  SAMPLE_GUEST,
  callReminderById,
  emailValues,
  footerOf,
  manageLineHtml,
  sampleBooking,
} from '../data/callReminders';
import './ReminderEditor.css';
import './CallReminderEditor.css';

// ------------------------------------------------------------
// Editing one of a 1:1 call's reminder emails: a full page, opened from
// the pencil on the Emails tab of the call's page (CallEmails.jsx).
// Built from the webinar email editor's parts (ReminderEditor.jsx), so
// both look and work the same:
//
//   ← Discovery call
//   24 hours before          Reset to default template  [Send me a test]  [Save email]
//   Goes out 24 hours before each call.
//   ┌ the email, with fill-in fields ┐  ╭━━━━━━━━━━━━━━━━━━━━━╮
//   │ Subject  [Reminder: (Call…)]   │  ┃ the inbox, on a      ┃
//   │ B I 🔗 •      + Insert detail  │  ┃ tablet, filled in    ┃
//   │ Hi (First name), …             │  ┃ for Rohan            ┃
//   │ [ Join call ]                  │  ╰━━━━━━━━━━━━━━━━━━━━━╯
//   │ 🔒 Can't make it? Pick another │
//   │    time or cancel.             │
//   └────────────────────────────────┘
//
// Nothing is saved here: the button hands the words to onApply, which
// saves them (the call's page) or puts them in a draft. Its words and the
// note under the title say which: applyLabel and note.
//
// Fixed parts the coach can't delete: the Join call button, and on the
// 24-hour email the reschedule-or-cancel line (a student's only way to
// move their booking).
//
// reminderId: 'dayBefore' | 'hourBefore'
// value: the words to start from: { subject, body } (the call's draft)
// call: { title, durationMins, timeZone, meetingLink } as in the draft,
//       for the preview
// hostName: the coach's name, for the preview
// onApply({ subject, body }): the button (applyLabel)
// onClose(): back to the call, without these words
// applyLabel: the button's words ('Save email')
// note: the line under the title, about when the words take effect
// ------------------------------------------------------------
export default function CallReminderEditor({
  reminderId,
  value,
  call,
  hostName,
  onApply,
  onClose,
  applyLabel = 'Save email',
  note = 'Calls already booked get the new words too.',
}) {
  const reminder = callReminderById(reminderId);
  const [draft, setDraft] = useState(value);
  // What the boxes are filled with; a new cardKey fills them again (Reset)
  const [start, setStart] = useState(value);
  const [cardKey, setCardKey] = useState(0);
  const [ask, setAsk] = useState(null); // 'leave' | 'reset'
  const tester = useTestEmail();

  const dirty = draft.subject !== value.subject || draft.body !== value.body;
  const emptySubject = !draft.subject;
  const isTemplate = draft.subject === reminder.subject && draft.body === reminder.body;

  // The preview: Rohan's booking of this call, as it is in the draft
  const values = useMemo(() => emailValues(sampleBooking(call), hostName), [call, hostName]);

  // A new page: start at the top
  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, []);

  useLeaveWarning(dirty);

  const back = () => (dirty ? setAsk('leave') : onClose());

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
      <button type="button" className="es__back" onClick={back}>
        <ArrowLeft size={16} aria-hidden="true" /> {String(call.title ?? '').trim() || 'Your call'}
      </button>

      <header className="re__head">
        <div className="re__intro">
          <h1 className="re__title">{reminder.name}</h1>
          <p className="re__status">Goes out {reminder.name} each call.</p>
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
              {applyLabel}
            </button>
          </span>
        </div>
      </header>

      {note && <p className="re__note">{note}</p>}

      {tester.bar}

      <div className="re__grid">
        <EmailCard
          key={cardKey}
          initial={start}
          onChange={setDraft}
          fields={CALL_FIELDS}
          join={{ label: JOIN_LABEL, tip: 'Opens your meeting link' }}
          after={
            reminder.manage ? (
              <p
                className="cre__manage"
                data-tip="Takes them to a page to pick another time or cancel. It’s always in this email."
                data-tip-align="start"
              >
                <Lock size={14} aria-hidden="true" />
                <span>
                  Can’t make it? <u>Pick another time</u> or <u>cancel</u>.
                </span>
              </p>
            ) : null
          }
        />
        <EmailPreview
          draft={draft}
          values={values}
          now={Date.now()}
          join
          joinLabel={JOIN_LABEL}
          toEmail={SAMPLE_GUEST.email}
          afterJoinHtml={reminder.manage ? manageLineHtml(values) : ''}
          footer={footerOf(values)}
          note={null}
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