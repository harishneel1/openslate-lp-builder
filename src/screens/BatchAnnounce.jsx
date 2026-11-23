import { useEffect, useMemo, useState } from 'react';
import { CalendarX, Check, ChevronLeft, Mail, MessageCircle } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmailCard, EmailPreview, useLeaveWarning, useTestEmail } from './ReminderEditor';
import { classById, classDay, classTime } from '../data/batches';
import { NOTICE_FIELDS, noticeTemplate, noticeValues, noticeWhatsApp, whatsappValues } from '../data/batchNotices';
import {
  WHATSAPP_CHANGED_EVENT,
  hasNumber,
  loadWhatsApp,
  needsContactNumber,
  messageStatus,
  settleReview,
} from '../data/whatsappConnection';
import { isVerified, loadBusiness } from '../data/whatsappBusiness';
import { initials } from '../utils/initials';
import { todayIn } from '../utils/slots';
import './ReminderEditor.css';
import './CancelSession.css'; // the red button, and "You'll confirm before anything is sent"
import '../components/WhatsAppTab.css'; // the WhatsApp phone preview
import './BatchAnnounce.css';

// ------------------------------------------------------------
// Cancelling one class, and telling its students by email and
// WhatsApp at once. Opened from the Classes tab of a class's page
// (Cancel this class). Built like a webinar's Cancel session page
// (CancelSession.jsx), from the email editor's parts, without the refund
// step. The way back is the top bar's "← Your class"
// (it asks first if the email was changed).
//
//   Cancel the class on Thu 13 Nov      [Send me a test] [Cancel class · Email + WhatsApp to 18 students]
//   Morning Yoga · 6:30 am · 18 students        You’ll confirm before anything is sent.
//
//   Email            You can change this before it goes.
//   the email (editable) │ how it looks in their inbox
//
//   WhatsApp         [✓ Approved by WhatsApp]
//   This is exactly what students get on WhatsApp.  │ the message, in a phone
//
// One page, read top to bottom, with nothing to pick: every student gets
// both, so both are shown in order, and the button and the check before
// sending name both. WhatsApp goes when it's connected and its message is
// approved; otherwise its section says so, and the button names the email
// only. Students with no phone number get the email only.
//
// Breaks don't come here: the coach tells students about those in class.
//
// Sending is simulated: the counts are saved with the cancellation
// (told), and the bell keeps a record.
//
// batch, change ({ kind: 'cancel', sessionId, date }), students: who gets told
// (everyone not removed), hostName, now, guardRef: the app asks it before
// leaving from the top bar, onConfirm({ email, whatsapp }): cancels the
// class; onClose(): back
// ------------------------------------------------------------

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function BatchAnnounce({ batch, change, students, hostName, now, guardRef, onConfirm, onClose }) {
  const today = todayIn(batch.timeZone, now);
  const [template] = useState(noticeTemplate);
  const [draft, setDraft] = useState(template);
  const [ask, setAsk] = useState(null); // 'confirm' | 'leave'
  const [connection, setConnection] = useState(loadWhatsApp);
  const tester = useTestEmail();
  const dirty = draft.subject !== template.subject || draft.body !== template.body;

  // WhatsApp's state, kept up to date (Meta's review finishing, set up elsewhere)
  useEffect(() => {
    const refresh = () => setConnection(loadWhatsApp());
    settleReview();
    const id = setInterval(() => settleReview(), 1000);
    window.addEventListener(WHATSAPP_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener(WHATSAPP_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, []);

  // Leaving with changes asks first: the top bar's "← Your class" (App)
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

  // ---------- Who gets what ----------
  const sample = students[0] ?? null;
  const values = useMemo(() => noticeValues(batch, change, sample, hostName), [batch, change, sample, hostName]);
  const message = noticeWhatsApp();
  // Nothing goes on WhatsApp until there's a contact number and Meta has
  // verified the business (whatsappBusiness.js)
  const wa = !hasNumber(connection) || needsContactNumber(connection) || !isVerified(loadBusiness())
    ? 'off'
    : connection.status === 'lost'
      ? 'lost'
      : messageStatus(connection, message.id); // 'review' | 'approved' | 'rejected'
  const waGoes = wa === 'approved';
  const withPhone = students.filter((s) => s.phone).length;
  const waSends = waGoes ? withPhone : 0; // only those with a phone number

  // Written out ("Thu 5 Nov"), with "tomorrow" or "today" added when it is
  const written = classDay(change.date, null);
  const relative = classDay(change.date, today);
  const day = relative === written ? written : `${written} (${relative.toLowerCase()})`;
  const c = classById(batch, change.sessionId);
  const time = c ? classTime(c, batch) : '';
  // Names what goes, so it never reads as the email alone
  const actionLabel =
    students.length === 0
      ? 'Cancel class'
      : `Cancel class · ${waGoes ? 'Email + WhatsApp' : 'Email'} to ${plural(students.length, 'student')}`;
  const sub = [batch.title, time, plural(students.length, 'student')].join(' · ');

  const each = students.length === 1 ? 'The 1 student' : `Each of the ${students.length} students`;
  const confirmLine =
    students.length === 0
      ? 'Nobody has bought this class’s contracts yet, so nobody will be told.'
      : waGoes
        ? withPhone === students.length
          ? `${each} gets an email and a WhatsApp message.`
          : `${each} gets an email. ${plural(withPhone, 'student')} with a phone number also get${withPhone === 1 ? 's' : ''} a WhatsApp message.`
        : `${each} gets an email. WhatsApp won’t go, as it isn’t ready.`;

  return (
    <div className="re cs ba">
      <header className="re__head">
        <div className="re__intro">
          <h1 className="re__title">Cancel the class on {day}</h1>
          <p className="re__status">{sub}</p>
        </div>
        <div className="cs__side">
          <div className="re__actions">
            {tester.button}
            <button
              type="button"
              className="re__btn cs__cancel"
              onClick={() => setAsk('confirm')}
              disabled={!draft.subject.trim()}
              aria-describedby="ba-safe"
            >
              <CalendarX size={16} aria-hidden="true" /> {actionLabel}
            </button>
          </div>
          <p className="cs__safe" id="ba-safe">
            You’ll confirm before anything is sent.
          </p>
        </div>
      </header>

      {tester.bar}

      {/* Everything that goes, in order: the email, then WhatsApp */}
      <section className="ba__section" aria-labelledby="ba-email">
        <div className="ba__section-head">
          <span className="ba__section-icon ba__section-icon--email" aria-hidden="true">
            <Mail size={17} />
          </span>
          <h2 className="ba__section-title" id="ba-email">
            Email
          </h2>
          <span className="ba__section-note">You can change this before it goes.</span>
        </div>
        <div className="re__grid">
          <EmailCard initial={draft} onChange={setDraft} fields={NOTICE_FIELDS} />
          <EmailPreview
            draft={draft}
            values={values}
            now={now}
            toEmail={sample?.email || 'priya@gmail.com'}
            footer={`You’re getting this because you’re in ${batch.title}.`}
            note={`Every student gets this same email with their own first name. ${values.first_name} is an example.`}
          />
        </div>
      </section>

      <section className="ba__section" aria-labelledby="ba-wa">
        <div className="ba__section-head">
          <span className="ba__section-icon ba__section-icon--wa" aria-hidden="true">
            <MessageCircle size={17} />
          </span>
          <h2 className="ba__section-title" id="ba-wa">
            WhatsApp
          </h2>
          {waGoes && (
            <span className="ba__approved">
              <Check size={13} strokeWidth={3} aria-hidden="true" /> Approved by WhatsApp
            </span>
          )}
        </div>
        <WhatsAppSide
          wa={wa}
          message={message}
          values={whatsappValues(batch, change, sample, hostName)}
          name={connection?.name ?? hostName}
        />
      </section>

      {ask === 'confirm' && (
        <ConfirmDialog
          title={`Cancel the class on ${day}?`}
          confirmLabel="Cancel class"
          cancelLabel="Go back"
          danger
          stayOpen
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            onConfirm({ email: students.length, whatsapp: waSends });
          }}
        >
          <p>{confirmLine}</p>
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
          <p>The class stays on. Your changes to the email will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// The WhatsApp section: the message, in a phone, and one line saying
// it's what students get. When WhatsApp can't send, just a line saying
// why, with no phone: only the email goes.
function WhatsAppSide({ wa, message, values, name }) {
  const why = {
    off: 'WhatsApp isn’t connected, so only the email goes. You can connect it from the Reminders tab of any webinar or 1:1 call.',
    lost: 'WhatsApp stopped sending from your number, so only the email goes. Reconnect it from the Reminders tab of any webinar or 1:1 call.',
    review:
      'WhatsApp is still approving this message, so only the email goes for now. This usually takes a few minutes.',
    rejected: 'WhatsApp didn’t approve this message, so only the email goes.',
  }[wa];

  return (
    <div className="ba__wa">
      <p className={why ? 'ba__wa-why' : 'ba__wa-who'}>
        {why ??
          'This is exactly what every student gets on WhatsApp, from your number. It’s already approved, so it’s ready to send.'}
      </p>

      {/* Only a message that goes is shown as one */}
      {!why && (
        <figure className="wamp__phone ba__phone" aria-label={`The message on WhatsApp, from ${name}`}>
          <div className="wamp__screen">
            <div className="wamp__top">
              <ChevronLeft size={18} aria-hidden="true" />
              <span className="wa-chat__face" aria-hidden="true">
                {initials(name)}
              </span>
              <span className="wa-chat__who">
                <span className="wa-chat__name">{name}</span>
                <span className="wa-chat__kind">Business account</span>
              </span>
            </div>
            <div className="wamp__chat">
              <div className="wamp__bubble">
                <p className="wam__text">
                  <Filled body={message.body} values={values} />
                  <span className="wa-chat__time">{message.sentAt}</span>
                </p>
              </div>
            </div>
            <div className="wamp__reply" aria-hidden="true">
              <span className="wamp__reply-box">Message</span>
              <span className="wamp__reply-send">
                <MessageCircle size={15} />
              </span>
            </div>
          </div>
        </figure>
      )}
    </div>
  );
}

// WhatsApp's formatting: *bold*, new lines; blanks filled in and marked
function Filled({ body, values }) {
  const out = [];
  let bold = false;
  body.split(/(\*|\{\w+\}|\n)/g).forEach((part, i) => {
    if (!part) return;
    if (part === '*') {
      bold = !bold;
      return;
    }
    if (part === '\n') {
      out.push(<br key={i} />);
      return;
    }
    const blank = part.match(/^\{(\w+)\}$/);
    let node = blank ? (
      <mark key={i} className="wam__fill">
        {values[blank[1]] ?? part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
    if (bold) node = <b key={`b${i}`}>{node}</b>;
    out.push(node);
  });
  return out;
}