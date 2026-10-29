import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarX } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmailCard, EmailPreview, SAMPLE, useLeaveWarning, useTestEmail } from './ReminderEditor';
import { FIELDS, REFUND_NOTE, cancelTemplate, fieldValues } from '../data/reminders';
import { webinarStart, webinarWhen } from '../data/webinar';
import './ReminderEditor.css';
import './CancelSession.css';

// ------------------------------------------------------------
// Cancelling one session: a full page, opened from Cancel session in its
// side panel (WebinarDetails.jsx) when people have signed up. Built from
// the email editor's parts (ReminderEditor.jsx), so the email works the
// same way: placeholders, Insert detail, the inbox preview, a test.
//
//   Cancel the session on Wed 11 Nov       [Send me a test] [Keep session] [Cancel session & email 23 people]
//   7:00 pm IST · 23 signed up · ₹22,977 paid
//                                                         You’ll confirm before anything is sent.
//   ☑ Refund everyone who paid: ₹22,977 to 23 people   In full, automatically. Usually 5 to 7 working days.
//   ⚠ It starts in 45 min. Some people may not see the email in time.
//   ┌ the email ───────────────────┐  ┌ how it looks in their inbox ┐
//
// Under the red button, one line says a check comes first, so it's safe
// to press. What cancelling does is said in that check (the pop-up).
//
// - The email starts from the cancellation template (data/reminders.js)
//   and is this cancellation's own: nothing is saved as a template.
// - Refund everyone is on by default, and only there when someone paid.
//   The email's Refund note fills in only while it's ticked, so the email
//   always says what will happen.
// - The red button asks once more (who's emailed, what's refunded), then
//   cancels. That pop-up only closes on Go back or Escape.
// - Keep session (or ← in the top bar) goes back. With changes made, it
//   asks first.
//
// run: the session; people: who signed up; hostName; now
// nextDay: 'Fri 20 Nov', the upcoming session the main landing page link
//   will point to once this one is cancelled, or null (there's none)
// guardRef: App asks it before leaving from the top bar
// onConfirm({ email, refund }): cancels; returns false if it couldn't
//   (it started meanwhile); onClose(): back to the webinar
// ------------------------------------------------------------

// Where the main landing page link goes once a session is cancelled. Also
// used by the drawer's pop-up for a session nobody signed up for.
export function LinkMoves({ nextDay }) {
  return nextDay
    ? `Your main landing page link will point to your next upcoming session, ${nextDay}.`
    : 'Your main landing page link will show that this webinar has ended.';
}

const SOON_MS = 2 * 60 * 60_000; // closer than this, the email may not be seen in time

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const peopleCount = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

// 'less than a minute', '45 min', '1 hr 20 min'
function inTime(ms) {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 1) return 'less than a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export default function CancelSession({ run, people = [], hostName, now, nextDay = null, guardRef, onConfirm, onClose }) {
  const answers = run.answers ?? {};
  const when = webinarWhen(answers);
  const day = when ? `${when.weekday} ${when.day} ${when.month}` : 'this date';
  const time = when ? when.line.split(', ').slice(1).join(', ') : null;

  // Who paid (and isn't refunded yet): the refund is offered only for them
  const payers = people.filter((p) => p.amount > 0 && !p.refundedAt);
  const paidTotal = payers.reduce((sum, p) => sum + p.amount, 0);
  const anyPaid = payers.length > 0;

  const template = useMemo(() => cancelTemplate({ paid: anyPaid }), [anyPaid]);
  const [draft, setDraft] = useState(template);
  const [refund, setRefund] = useState(true);
  const [ask, setAsk] = useState(null); // 'confirm' | 'leave'
  const [failed, setFailed] = useState(false); // it started meanwhile
  const tester = useTestEmail();

  const dirty = draft.subject !== template.subject || draft.body !== template.body || !refund;
  const emptySubject = !draft.subject;

  // The preview's values: the example person, and the refund line only while refunds are on
  const values = useMemo(
    () => ({ ...fieldValues(run, SAMPLE, hostName), refund_note: anyPaid && refund ? REFUND_NOTE : '' }),
    [run, hostName, anyPaid, refund],
  );
  // What Insert detail offers: no join link (there's nothing to join); the
  // Refund note only when someone paid
  const fields = FIELDS.filter((f) => f.key !== 'join_link' && (!f.only || (f.only === 'cancel' && anyPaid)));

  const start = webinarStart(answers);
  const startsSoon = start !== null && start - now < SOON_MS;

  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, []);

  // Leaving with changes asks first: the top bar's ← (App) and Keep session
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

  const cancelNow = () => {
    setAsk(null);
    const ok = onConfirm({ email: { subject: draft.subject, body: draft.body }, refund: anyPaid && refund });
    if (ok === false) setFailed(true);
  };

  const actionLabel = people.length > 0 ? `Cancel session & email ${peopleCount(people.length)}` : 'Cancel session';
  const sub = [time, `${people.length} signed up`, anyPaid ? `${rupees(paidTotal)} paid` : null].filter(Boolean).join(' · ');

  return (
    <div className="re cs">
      <header className="re__head">
        <div className="re__intro">
          <h1 className="re__title">Cancel the session on {day}</h1>
          <p className="re__status">{sub}</p>
        </div>
        <div className="cs__side">
          <div className="re__actions">
            {tester.button}
            <button type="button" className="oh__edit re__btn" onClick={leave}>
              Keep session
            </button>
            <button
              type="button"
              className="re__btn cs__cancel"
              onClick={() => setAsk('confirm')}
              disabled={emptySubject || failed}
              aria-describedby="cs-safe"
            >
              <CalendarX size={16} aria-hidden="true" /> {actionLabel}
            </button>
          </div>
          <p className="cs__safe" id="cs-safe">
            You’ll confirm before anything is sent.
          </p>
        </div>
      </header>

      {tester.bar}

      {failed && (
        <p className="cs__warn cs__warn--stop" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          This session has started, so it can’t be cancelled now. End it in Zoom instead.
        </p>
      )}

      {anyPaid && (
        <label className="cs__refund">
          <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
          <span className="cs__refund-text">
            <span className="cs__refund-title">
              Refund everyone who paid: {rupees(paidTotal)} to {peopleCount(payers.length)}
            </span>
            <span className="cs__refund-note">
              {refund
                ? 'In full, automatically. It usually reaches them in 5 to 7 working days.'
                : 'Nobody will be refunded, and the Refund note is left out of the email.'}
            </span>
          </span>
        </label>
      )}

      {startsSoon && !failed && (
        <p className="cs__warn">
          <AlertTriangle size={16} aria-hidden="true" />
          It starts in {inTime(start - now)}. Some people may not see the email in time.
        </p>
      )}

      <div className="re__grid">
        <EmailCard initial={template} onChange={setDraft} fields={fields} />
        <EmailPreview
          draft={draft}
          values={values}
          now={now}
          footer={`You’re getting this because you registered for ${values.webinar_title}.`}
        />
      </div>

      {ask === 'confirm' && (
        <ConfirmDialog
          title={`Cancel the session on ${day}?`}
          confirmLabel="Cancel session"
          cancelLabel="Go back"
          danger
          // A stray click outside doesn't close it; Go back and Escape do
          stayOpen
          onCancel={() => setAsk(null)}
          onConfirm={cancelNow}
        >
          <p>
            {people.length > 0 ? `We’ll email ${peopleCount(people.length)}` : 'Nobody is emailed'}
            {anyPaid && refund ? ` and refund ${rupees(paidTotal)} to ${peopleCount(payers.length)}` : ''}.{' '}
            <LinkMoves nextDay={nextDay} />
          </p>
        </ConfirmDialog>
      )}

      {ask === 'leave' && (
        <ConfirmDialog
          title="Leave without cancelling?"
          confirmLabel="Leave"
          cancelLabel="Stay"
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            onClose();
          }}
        >
          <p>The session stays as it is. Your changes to the email will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}