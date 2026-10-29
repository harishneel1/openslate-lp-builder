import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmailCard, EmailPreview, SAMPLE, useLeaveWarning, useTestEmail } from './ReminderEditor';
import { FIELDS, fieldValues, rescheduleTemplate } from '../data/reminders';
import { webinarWhen } from '../data/webinar';
import './ReminderEditor.css';
import './CancelSession.css'; // the header column, the line under the button, warnings
import './RescheduleSession.css';

// ------------------------------------------------------------
// Rescheduling a session that people signed up for: the email they're
// sent about the new date, opened from the Reschedule pop-up (Continue)
// once the new date and time are picked. Built like the cancel page
// (CancelSession.jsx) from the email editor's parts (ReminderEditor.jsx).
//
//   Reschedule the session on Fri 13 Nov      [Send me a test] [Keep current date] [Reschedule & email 23 people]
//   New date: Fri 20 Nov, 7:00 pm IST · 23 signed up      You’ll confirm before anything is sent.
//   ⚠ You have a 1:1 call with Priya at 7:30 pm that day.
//   ┌ the email ───────────────────┐  ┌ how it looks in their inbox ┐
//
// - The email starts from the reschedule template (data/reminders.js):
//   old and new date, the same Join webinar button (the link doesn't
//   change), and on a paid session "Can't make the new date? Reply to
//   this email." It's this move's own: nothing is saved as a template.
//   Everyone who signed up always gets it.
// - The pop-up's warnings (a 1:1 call or another webinar then, the main
//   landing page link pointing elsewhere) are repeated here.
// - The orange button asks once more, then moves it.
// - Keep current date (or ← in the top bar) goes back without moving it.
//   With changes made to the email, it asks first.
//
// run: the session (still at its old date); to: { date, time } the new one
// people: who signed up; hostName; now; warnings: sentences (moveWarnings)
// guardRef: App asks it before leaving from the top bar
// onConfirm({ email }): moves it; returns false if it couldn't (it
//   started meanwhile, or the time is no longer free); onClose(): back
// ------------------------------------------------------------

const peopleCount = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

export default function RescheduleSession({ run, to, people = [], hostName, now, warnings = [], guardRef, onConfirm, onClose }) {
  const answers = run.answers ?? {};
  const was = webinarWhen(answers);
  const day = was ? `${was.weekday} ${was.day} ${was.month}` : 'this date';
  const movedAnswers = { ...answers, date: to.date, time: to.time };
  const will = webinarWhen(movedAnswers);
  const newDay = will ? `${will.weekday} ${will.day} ${will.month}` : 'the new date';

  // Someone paid: the email asks anyone who can't make it to reply
  const anyPaid = people.some((p) => p.amount > 0 && !p.refundedAt);
  const template = useMemo(() => rescheduleTemplate({ paid: anyPaid }), [anyPaid]);
  const [draft, setDraft] = useState(template);
  const [ask, setAsk] = useState(null); // 'confirm' | 'leave'
  const [failed, setFailed] = useState(false); // couldn't move it any more
  const tester = useTestEmail();

  const dirty = draft.subject !== template.subject || draft.body !== template.body;
  const emptySubject = !draft.subject;

  // The preview's values: the new date and time, and where it was before
  const values = useMemo(() => {
    const filled = fieldValues({ ...run, answers: movedAnswers }, SAMPLE, hostName);
    const old = fieldValues(run, SAMPLE, hostName);
    return { ...filled, old_date: old.date, old_time: old.time };
  }, [run, hostName, to.date, to.time]); // eslint-disable-line react-hooks/exhaustive-deps
  // What Insert detail offers: the usual details, and the old date and time
  const fields = FIELDS.filter((f) => !f.only || f.only === 'reschedule');

  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, []);

  // Leaving with changes asks first: the top bar's ← (App) and Keep current date
  useEffect(() => {
    if (!guardRef) return undefined;
    guardRef.current = () => {
      if (!dirty) return true;
      setAsk('leave');
      return false;
    };
    return () => {
      guardRef.current = null;
    };
  }, [dirty, guardRef]);

  useLeaveWarning(dirty);

  const leave = () => (dirty ? setAsk('leave') : onClose());

  const moveNow = () => {
    setAsk(null);
    const ok = onConfirm({ email: { subject: draft.subject, body: draft.body } });
    if (ok === false) setFailed(true);
  };

  const sub = [`New date: ${will ? will.line : 'not set'}`, `${people.length} signed up`].join(' · ');

  return (
    <div className="re cs rs">
      <header className="re__head">
        <div className="re__intro">
          <h1 className="re__title">Reschedule the session on {day}</h1>
          <p className="re__status">{sub}</p>
        </div>
        <div className="cs__side">
          <div className="re__actions">
            {tester.button}
            <button type="button" className="oh__edit re__btn" onClick={leave}>
              Keep current date
            </button>
            <button
              type="button"
              className="oh__add re__btn rs__move"
              onClick={() => setAsk('confirm')}
              disabled={emptySubject || failed}
              aria-describedby="rs-safe"
            >
              <CalendarClock size={16} aria-hidden="true" /> Reschedule & email {peopleCount(people.length)}
            </button>
          </div>
          <p className="cs__safe" id="rs-safe">
            You’ll confirm before anything is sent.
          </p>
        </div>
      </header>

      {tester.bar}

      {failed && (
        <p className="cs__warn cs__warn--stop" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          This session can’t be moved to that time any more. Go back and pick another.
        </p>
      )}

      {!failed &&
        warnings.map((text) => (
          <p key={text} className="cs__warn">
            <AlertTriangle size={16} aria-hidden="true" />
            {text}
          </p>
        ))}

      <div className="re__grid">
        <EmailCard initial={template} onChange={setDraft} fields={fields} join />
        <EmailPreview
          draft={draft}
          values={values}
          now={now}
          join
          footer={`You’re getting this because you registered for ${values.webinar_title}.`}
        />
      </div>

      {ask === 'confirm' && (
        <ConfirmDialog
          title={`Reschedule to ${newDay}?`}
          confirmLabel="Reschedule"
          cancelLabel="Go back"
          // A stray click outside doesn't close it; Go back and Escape do
          stayOpen
          onCancel={() => setAsk(null)}
          onConfirm={moveNow}
        >
          <p>We’ll email {peopleCount(people.length)} the new date.</p>
        </ConfirmDialog>
      )}

      {ask === 'leave' && (
        <ConfirmDialog
          title="Leave without rescheduling?"
          confirmLabel="Leave"
          cancelLabel="Stay"
          stayOpen
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            onClose();
          }}
        >
          <p>The session stays on {day}. Your changes to the email will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}