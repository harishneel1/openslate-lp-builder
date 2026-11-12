import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Drawer from '../components/Drawer';
import InfoTip from '../components/InfoTip';
import TemplateDialog, { autoReplyRow } from './TemplateDialog';
import {
  CONTACT_COUNTRIES,
  DAILY_LIMIT,
  MOCK_REJECTION,
  dailyLimit,
  disconnectWhatsApp,
  isSetUp,
  markWelcomed,
  messageStatus,
  needsContactNumber,
  readContactNumber,
  reconnectWhatsApp,
  renameWhatsApp,
  setContactNumber,
  splitContactNumber,
} from '../data/whatsappConnection';
import { SHOWN_MESSAGE_IDS } from '../data/whatsappMessages';
import './EditFrame.css'; // es__btn, for the side panels' buttons
import './WhatsAppConnected.css';

// ------------------------------------------------------------
// Settings → WhatsApp, once a number is connected: what's connected,
// whether it's working, and the one thing to do when it isn't.
//
//   WhatsApp  [● Connected]
//   Used for every webinar and 1:1 call.
//   ───────────────────────────────────────────────────────────────────
//   ┃ Connected. Your reminders are being approved.  ┃  ┌ Default reminders, ┐
//   ┃ It usually takes a few minutes, and up to 24 h. ┃  │ ready to use       │
//   ┃ ✓ Connected → ◷ Meta approving · 5 of 8 → ○ Reminders live │ We've submitted … │
//   ┃ Where should students message you? …  [Add number] ┃  │ [See default messages]
//                                                       └────────────────────┘
//   No-reply number ⓘ  +91 98765 43210
//   Contact number ⓘ   +91 91234 56789   Change   View message
//                      (or: Not added   Add number   View message)
//   Display name    Harish Neel  [In review]
//   Daily limit     250 students ⓘ   Get verified to raise it
//   Messages        8 reminders: 7 approved, 1 in review   See all
//
//   Disconnect WhatsApp
//
// The note at the top, one at a time:
//   something wrong   most urgent first, each with the one thing to do
//                     (it replaces the others):
//     the number dropped by WhatsApp   paused, emails still go     Reconnect
//     the display name rejected        Meta's reason               Choose another name
//     a message rejected               where to see why            See which
//   setup not finished  until Meta has approved the reminders and the
//                     contact number is added (isSetUp): four steps,
//                     Connected → Meta approving · 5 of 8 (or Meta approved)
//                     → Add contact number → Reminders live, each marked on
//                     its own. It can't be closed while it's true, and the
//                     pill at the top says "Not live yet" instead of
//                     "Connected". Meanwhile webinars' and calls' Reminders
//                     tabs show the same card as before connecting.
//   all done          "You're all set", once: when the last of it
//                     comes in while they're here, or on their next visit.
//                     Closed, it doesn't come back.
//
// Two numbers, each with an ⓘ saying what it's for:
//   No-reply number   the connected one: sends reminders, can't be chatted
//                     on (it's not in the WhatsApp app any more)
//   Contact number    the WhatsApp number they chat on. Students who message
//                     the no-reply number get an automatic reply pointing them
//                     to it. Asked for after connecting, and needed: until
//                     it's added, a note under the one above asks for it
//                     (and Settings' menu shows a red dot). Added and changed
//                     in a side panel (ContactPanel). "View message" opens
//                     the automatic reply in Templates' pop-up
//                     (TemplateDialog.jsx), in its conversation.
//
// The coach never wrote these messages: we submitted our defaults for
// them as they connected. So until every one is approved, a box on the
// right says what they are, why Meta checks them, and that there's
// nothing to do, with the way to Templates. It doesn't count them or name
// calls and webinars they may not have made yet. Once all are approved it
// goes; the Messages row stays as the way to Templates.
//
// Messages' "See all", a rejected message's "See which", and the box's
// button go to the Templates tab (onSeeAll). Side panels (Drawer): Get
// verified (Coming soon), a new display name, and the contact number. Disconnect asks first
// (ConfirmDialog); it's also how to change number: disconnect, then
// connect the new one.
//
// "Connected on" isn't shown: nothing to do with it.
// connection: the saved connection (connected or lost)
// onSeeAll(): go to Settings → WhatsApp → Templates
// ------------------------------------------------------------

const STATUS = {
  approved: { label: 'Approved', badge: 'good' },
  review: { label: 'In review', badge: 'wait' },
  rejected: { label: 'Not approved', badge: 'bad' },
};

const fmt = (n) => n.toLocaleString('en-IN');

// Why the contact number's needed: under its setup step (SetupSteps), or
// in its own note while a problem's note shows instead (ContactNeeded)
const CONTACT_WHY =
  'You won’t see your students’ replies to your WhatsApp reminders. So we’ll tell them to message you on your own WhatsApp number instead.';

// The two numbers' ⓘ
const NO_REPLY_TIP =
  'Sends your reminders. Students can’t chat with you here. If they message it, they get an automatic reply with your contact number.';
const CONTACT_TIP =
  'Your WhatsApp number for chatting with students. We share it in the automatic reply, so they know where to reach you.';

// startPanel: a side panel to open on ('contact', from Templates' "Add
//   number"), or null; onStarted() once it's open, so it opens only once
export default function WhatsAppConnected({ connection, onSeeAll, startPanel = null, onStarted }) {
  const [panel, setPanel] = useState(startPanel); // 'verify' | 'rename' | 'contact'
  useEffect(() => {
    if (startPanel) onStarted?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [viewing, setViewing] = useState(false); // the automatic reply's pop-up
  const [disconnecting, setDisconnecting] = useState(false);
  const lost = connection.status === 'lost';
  const problem = problemOf(connection);
  const { approved, total, inReview } = approvalsOf(connection);
  const needsContact = needsContactNumber(connection);
  // Setup finished: contact number added, Meta done reviewing (isSetUp)
  const setUp = isSetUp(connection);

  // "You're all set": once every message is approved, shown once. Either
  // the last approval comes in while they're here, or it had come in by
  // their next visit (welcomed still false). It's marked seen as it shows,
  // and stays for this visit until closed.
  const [welcomeOpen, setWelcomeOpen] = useState(connection.welcomed === false && !inReview);
  const wasInReview = useRef(inReview);
  useEffect(() => {
    if (wasInReview.current && !inReview) setWelcomeOpen(true);
    wasInReview.current = inReview;
  }, [inReview]);
  // "You're all set" waits for the contact number: it isn't, until then
  const welcome = welcomeOpen && !problem && !inReview && !needsContact;
  useEffect(() => {
    if (welcome && connection.welcomed === false) markWelcomed();
  }, [welcome, connection.welcomed]);
  // A problem ends it: once fixed, the screen doesn't go back to "all set"
  useEffect(() => {
    if (problem) setWelcomeOpen(false);
  }, [problem?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The box on the right: until every message is approved
  const explain = approved < total;

  return (
    <>
      <div className="oh__panel-head">
        <h2 className="oh__panel-title wcn__title">
          WhatsApp
          <span className={`wcn-state ${lost ? 'wcn-state--paused' : setUp ? '' : 'wcn-state--pending'}`}>
            {lost ? 'Paused' : setUp ? 'Connected' : 'Not live yet'}
          </span>
        </h2>
        <p className="oh__panel-sub">Used for every webinar and 1:1 call.</p>
      </div>

      <div className="settings__body settings__body--split">
        <div className="wcn">
          {problem ? (
            <Problem problem={problem} connection={connection} onOpen={setPanel} onSeeAll={onSeeAll} />
          ) : !setUp ? (
            <SetupSteps
              approved={approved}
              total={total}
              inReview={inReview}
              hasContact={!needsContact}
              onAddContact={() => setPanel('contact')}
            />
          ) : welcome ? (
            <Welcome onClose={() => setWelcomeOpen(false)} />
          ) : null}
          {/* Normally asked for inside the setup steps. While a problem's note
              takes their place, asked for in a note of its own. */}
          {needsContact && problem && <ContactNeeded onAdd={() => setPanel('contact')} />}

          <dl className="wcn-facts">
            <div className="wcn-facts__row">
              <dt>
                <span className="wcn-facts__with-tip">
                  No-reply number
                  <InfoTip label="What is a no-reply number?" text={NO_REPLY_TIP} />
                </span>
              </dt>
              <dd className="wcn-facts__number">{connection.number}</dd>
            </div>
            <div className="wcn-facts__row">
              <dt>
                <span className="wcn-facts__with-tip">
                  Contact number
                  <InfoTip label="What is the contact number?" text={CONTACT_TIP} />
                </span>
              </dt>
              <dd>
                {connection.contactNumber ? (
                  <>
                    <span className="wcn-facts__number">{connection.contactNumber}</span>
                    <button type="button" className="wcn-link" onClick={() => setPanel('contact')}>
                      Change
                    </button>
                    <button type="button" className="wcn-link" onClick={() => setViewing(true)}>
                      View message
                    </button>
                  </>
                ) : (
                  <>
                    <span className="wcn-facts__missing">Not added</span>
                    <button type="button" className="wcn-link" onClick={() => setPanel('contact')}>
                      Add number
                    </button>
                    <button type="button" className="wcn-link" onClick={() => setViewing(true)}>
                      View message
                    </button>
                  </>
                )}
              </dd>
            </div>
            <div className="wcn-facts__row">
              <dt>Display name</dt>
              <dd>
                {connection.name}
                {connection.nameStatus !== 'approved' && <Badge status={connection.nameStatus} />}
              </dd>
            </div>
            <div className="wcn-facts__row">
              <dt>Daily limit</dt>
              <dd>
                <span className="wcn-facts__with-tip">
                  {fmt(dailyLimit(connection))} students
                  <InfoTip
                    label="Daily limit"
                    text={
                      connection.verified
                        ? 'Different students you can message each day, not messages.'
                        : `Different students you can message each day, not messages. Verified businesses can reach ${fmt(DAILY_LIMIT.verified)}.`
                    }
                  />
                </span>
                {connection.verified ? (
                  <span className="wa-badge wcn-badge--good">Verified</span>
                ) : (
                  <button type="button" className="wcn-link" onClick={() => setPanel('verify')}>
                    Get verified to raise it
                  </button>
                )}
              </dd>
            </div>
            <div className="wcn-facts__row">
              <dt>Messages</dt>
              <dd>
                {messagesSummary(connection)}
                <button type="button" className="wcn-link" onClick={onSeeAll}>
                  See all
                </button>
              </dd>
            </div>
          </dl>

          <button type="button" className="wcn-disconnect" onClick={() => setDisconnecting(true)}>
            Disconnect WhatsApp
          </button>
        </div>

        {explain && <DefaultsHelp onSeeAll={onSeeAll} needsContact={needsContact} />}
      </div>

      {panel === 'verify' && <VerifyPanel onClose={() => setPanel(null)} />}
      {panel === 'rename' && <RenamePanel current={connection.name} onClose={() => setPanel(null)} />}
      {viewing && (
        <TemplateDialog
          row={autoReplyRow(connection)}
          sender={connection.name}
          contactNumber={connection.contactNumber ?? null}
          onClose={() => setViewing(false)}
        />
      )}
      {panel === 'contact' && (
        <ContactPanel current={connection.contactNumber} noReplyNumber={connection.number} onClose={() => setPanel(null)} />
      )}

      {disconnecting && (
        <ConfirmDialog
          title="Disconnect WhatsApp?"
          confirmLabel="Disconnect"
          danger
          onCancel={() => setDisconnecting(false)}
          onConfirm={() => {
            setDisconnecting(false);
            disconnectWhatsApp();
          }}
        >
          <p>WhatsApp reminders stop for every webinar and 1:1 call. Emails keep going out.</p>
          <p>To connect again, or to use a different number, you’ll go through setup again.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// ---------- What's wrong, most urgent first ----------
function problemOf(c) {
  if (c.status === 'lost') return { id: 'lost' };
  if (c.nameStatus === 'rejected') return { id: 'name' };
  const rejected = SHOWN_MESSAGE_IDS.filter((id) => messageStatus(c, id) === 'rejected');
  if (rejected.length) return { id: 'message', count: rejected.length };
  return null;
}

function Problem({ problem, connection, onOpen, onSeeAll }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), [problem.id]);

  const content = {
    lost: {
      title: 'WhatsApp reminders are paused',
      text: 'WhatsApp stopped letting us send from this number. Emails still go out.',
      action: 'Reconnect',
      onAction: reconnectWhatsApp,
    },
    name: {
      title: `Meta didn’t approve “${connection.name}”`,
      text: MOCK_REJECTION,
      action: 'Choose another name',
      onAction: () => onOpen('rename'),
    },
    message: {
      title: problem.count === 1 ? '1 reminder wasn’t approved' : `${problem.count} reminders weren’t approved`,
      text: `Meta’s reason is in Templates. Pick another template for ${problem.count === 1 ? 'it' : 'them'} on the call or webinar.`,
      action: 'See which',
      onAction: onSeeAll,
    },
  }[problem.id];

  return (
    <div className="wcn-note wcn-note--problem" role="alert">
      <div className="wcn-note__words">
        <h3 className="wcn-note__title" ref={heading} tabIndex={-1}>
          {content.title}
        </h3>
        <p className="wcn-note__text">{content.text}</p>
      </div>
      <button type="button" className="oh__add" onClick={content.onAction}>
        {content.action}
      </button>
    </div>
  );
}

// How Meta's review of our default messages stands
function approvalsOf(c) {
  const statuses = SHOWN_MESSAGE_IDS.map((id) => messageStatus(c, id));
  return {
    approved: statuses.filter((s) => s === 'approved').length,
    total: statuses.length,
    inReview: statuses.includes('review'),
  };
}

// ---------- Setup not finished: where it stands ----------
// Until Meta has approved the reminders and the contact number is added.
// Not closable: it stays while it's true. Each step is marked on its own:
// the contact number can be added while Meta is still reviewing.
//   done  ✓        now  in progress (Meta reviewing)
//   todo  theirs to do now (the contact number: its note below has the button)
//   next  waits for the others (Reminders live)
const STEP_SR = { done: ', done', now: ', in progress', todo: ', to do', next: ', next' };

// onAddContact(): open the contact number panel (the step's own action,
//   right under the steps while it's still to do)
function SetupSteps({ approved, total, inReview, hasContact, onAddContact }) {
  const steps = [
    { id: 'connected', label: 'Connected', state: 'done' },
    inReview
      ? { id: 'meta', label: `Meta approving · ${approved} of ${total}`, state: 'now' }
      : { id: 'meta', label: 'Meta approved', state: 'done' },
    hasContact
      ? { id: 'contact', label: 'Contact number added', state: 'done' }
      : { id: 'contact', label: 'Add contact number', state: 'todo' },
    { id: 'live', label: 'Reminders live', state: 'next' },
  ];
  return (
    <div className="wcn-note wcn-note--wait" role="status">
      <div className="wcn-note__words">
        <h3 className="wcn-note__title">
          {inReview ? 'Connected. Your reminders are being approved.' : 'Your reminders are approved.'}
        </h3>
        <p className="wcn-note__text">
          {inReview
            ? 'It usually takes a few minutes, and up to 24 hours.'
            : 'Add your contact number to start sending them.'}
        </p>
        <ol className="wcn-steps">
          {steps.map((step) => (
            <li key={step.id} className={`wcn-step wcn-step--${step.state}`}>
              <span className="wcn-step__mark" aria-hidden="true">
                {step.state === 'done' && <Check size={12} strokeWidth={3.5} />}
              </span>
              {step.label}
              <span className="oh__sr-only">{STEP_SR[step.state]}</span>
            </li>
          ))}
        </ol>

        {/* The step to do now, with its reason and its button, right under it */}
        {!hasContact && (
          <div className="wcn-ask">
            <div className="wcn-ask__words">
              <h4 className="wcn-ask__title">Add contact number</h4>
              <p className="wcn-ask__text">{CONTACT_WHY}</p>
            </div>
            <button type="button" className="oh__add" onClick={onAddContact}>
              Add number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Every message approved, shown once ----------
function Welcome({ onClose }) {
  return (
    <div className="wcn-note wcn-note--done" role="status">
      <div className="wcn-note__words">
        <h3 className="wcn-note__title">You’re all set</h3>
        <p className="wcn-note__text">Your reminders are approved and ready to go.</p>
      </div>
      <button type="button" className="wcn-note__close" onClick={onClose} aria-label="Close">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

// What templates are, for the link in the box on the right.
// TODO: the video or FAQ on templates, once it has a link
const TEMPLATES_HELP_URL = '#';

// ---------- No contact number yet, while a problem's note shows ----------
// Usually the setup steps ask for it (SetupSteps). When a problem's note
// replaces them, this asks instead, in the same words. Amber, like a
// problem: it's needed, but nothing is broken, so a status, not an alert.
function ContactNeeded({ onAdd }) {
  return (
    <div className="wcn-note wcn-note--problem" role="status">
      <div className="wcn-note__words">
        <h3 className="wcn-note__title">Add contact number</h3>
        <p className="wcn-note__text">{CONTACT_WHY}</p>
      </div>
      <button type="button" className="oh__add" onClick={onAdd}>
        Add number
      </button>
    </div>
  );
}

// ---------- The box on the right, until every message is approved ----------
// What these messages are (they never wrote them), why Meta checks them,
// and that there's nothing to do. No count, and no calls or webinars they
// may not have made yet.
// needsContact: no contact number yet, so it's not "nothing to do"
function DefaultsHelp({ onSeeAll, needsContact }) {
  return (
    <aside className="settings__help wcn-help" aria-labelledby="wcn-help-title">
      <h3 className="settings__help-title" id="wcn-help-title">
        Default reminders, ready to use
      </h3>
      <p>
        We’ve submitted commonly used reminder messages for 1:1 calls and webinars to Meta, so they’re ready whenever
        you need them.
      </p>
      <p>
        WhatsApp only allows sending messages that it has approved in advance. These are called{' '}
        <a className="wcn-help__link" href={TEMPLATES_HELP_URL} target="_blank" rel="noreferrer">
          templates
        </a>
        .
      </p>
      <p>
        {needsContact
          ? 'Once they’re approved and you’ve added your contact number, they go out automatically, alongside your emails.'
          : 'Nothing to do. Once approved, they go out automatically, alongside your emails.'}
      </p>
      <button type="button" className="es__btn es__btn--quiet wcn-help__btn" onClick={onSeeAll}>
        See default messages
      </button>
    </aside>
  );
}

// ---------- Small pieces ----------
function Badge({ status }) {
  const s = STATUS[status];
  return <span className={`wa-badge wcn-badge--${s.badge}`}>{s.label}</span>;
}

// "8 reminders: 7 approved, 1 in review", or "8 reminders, all approved"
function messagesSummary(c) {
  const counts = { approved: 0, review: 0, rejected: 0 };
  SHOWN_MESSAGE_IDS.forEach((id) => (counts[messageStatus(c, id)] += 1));
  const parts = Object.entries(counts).filter(([, n]) => n > 0);
  const total = `${SHOWN_MESSAGE_IDS.length} reminders`;
  if (parts.length === 1) return `${total}, all ${STATUS[parts[0][0]].label.toLowerCase()}`;
  return `${total}: ${parts.map(([s, n]) => `${n} ${STATUS[s].label.toLowerCase()}`).join(', ')}`;
}

// ---------- Side panels ----------
function VerifyPanel({ onClose }) {
  return (
    <Drawer
      title="Get verified"
      onClose={onClose}
      footer={
        <button type="button" className="es__btn es__btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="wcn-verify">
        <span className="wa-badge wcn-badge--soon">Coming soon</span>
        <p>
          Verified businesses can message up to {fmt(DAILY_LIMIT.verified)} different students a day, instead of{' '}
          {fmt(DAILY_LIMIT.unverified)}.
        </p>
        <p>Meta verifies your business by checking its documents. You’ll be able to start that here.</p>
      </div>
    </Drawer>
  );
}

// Meta rejected the display name: try another, which goes back for review
function RenamePanel({ current, onClose }) {
  const [name, setName] = useState(current);
  const [error, setError] = useState(null);
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return setError('Enter at least 3 letters.');
    if (trimmed === current) return setError('Meta didn’t approve this one. Try a different name.');
    if (renameWhatsApp(trimmed)) onClose();
  };

  return (
    <Drawer
      title="Choose another name"
      sub="Shown to students on every message."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="es__btn es__btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="es__btn es__btn--primary" onClick={submit}>
            Send to Meta
          </button>
        </>
      }
    >
      <form
        className="wcn-rename"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <label className="wcn-rename__label" htmlFor="wcn-rename-input">
          Display name
        </label>
        <input
          id="wcn-rename-input"
          className="wcn-rename__input"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby="wcn-rename-hint"
          autoFocus
        />
        <p id="wcn-rename-hint" className={error ? 'wcn-rename__error' : 'wcn-rename__hint'}>
          {error ?? 'Your own name or your brand’s works best. Meta checks it again.'}
        </p>
      </form>
    </Drawer>
  );
}

// The contact number: added the first time, changed after. A country
// dropdown (India only for now: CONTACT_COUNTRIES) and the number. Saved
// once it reads as a mobile number (readContactNumber), and not the
// no-reply number itself.
function ContactPanel({ current, noReplyNumber, onClose }) {
  const saved = splitContactNumber(current);
  const [country, setCountry] = useState(saved.country);
  const [text, setText] = useState(saved.local);
  const [error, setError] = useState(null);
  const submit = () => {
    const read = readContactNumber(text, noReplyNumber, country);
    if (read.error) return setError(read.error);
    if (setContactNumber(read.number)) onClose();
    else setError('Couldn’t save it. Try again.');
  };

  return (
    <Drawer
      title={current ? 'Change contact number' : 'Add contact number'}
      sub="The WhatsApp number students can reach you on."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="es__btn es__btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="es__btn es__btn--primary" onClick={submit}>
            Save
          </button>
        </>
      }
    >
      <form
        className="wcn-rename"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <p className="wcn-contact__about">
          You won’t see your students’ replies to your WhatsApp reminders. So when a student replies, we’ll send them
          an automatic message asking them to contact you on this number instead.
        </p>
        <label className="wcn-rename__label" htmlFor="wcn-contact-input">
          Your WhatsApp number
        </label>
        <div className="wcn-contact__fields">
          <select
            className="wcn-rename__input wcn-contact__country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Country"
          >
            {CONTACT_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            id="wcn-contact-input"
            className="wcn-rename__input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={text}
            maxLength={16}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby="wcn-contact-hint"
            autoFocus
          />
        </div>
        <p id="wcn-contact-hint" className={error ? 'wcn-rename__error' : 'wcn-rename__hint'}>
          {error ?? 'Your personal or business WhatsApp number.'}
        </p>
      </form>
    </Drawer>
  );
}