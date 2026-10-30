import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Banknote, CalendarX } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmailCard, EmailPreview, SAMPLE, useLeaveWarning, useTestEmail } from './ReminderEditor';
import { FIELDS, cancelTemplate, fieldValues, markRefund, withRefund, withoutRefund } from '../data/reminders';
import { webinarStart, webinarWhen } from '../data/webinar';
import './ReminderEditor.css';
import './CancelSession.css';

// ------------------------------------------------------------
// Cancelling one session: a full page, opened from Cancel session in its
// side panel (WebinarDetails.jsx) when people have signed up. Built from
// the email editor's parts (ReminderEditor.jsx), so the email works the
// same way: placeholders, Insert detail, the inbox preview, a test.
//
// A guided flow, one decision at a time, in the order they depend on
// each other:
//   1 How should we refund people?  a pop-up over the page as it opens,
//     only when someone paid: Refund in full (the default), Refund part
//     (the same amount each) or Don't refund. The refund decides what the
//     email says, so it comes first. Go back here leaves (nothing's changed).
//   2 The page: the email and its preview, with the refund in a bar of its
//     own ((₹) Refunding ₹200 to each person who paid  [Change]). Change reopens 1.
//     Just after a choice, the bar and the refund sentence in the preview
//     light up for a moment, so it's clear where the choice went. The
//     email's Refund amount already matches it, so the preview is what
//     gets sent. With Don't refund, the sentence holding the Refund amount
//     is taken out of the email; choosing a refund again puts it back.
//   3 The red button's check: only confirms what's on screen ("We'll email
//     2 people and send their refunds."), without repeating the amounts,
//     and nothing new is decided there. It closes on Go back or Escape.
//
//   Cancel the session on Wed 11 Nov       [Send me a test] [Keep session] [Cancel session & email 23 people]
//   7:00 pm IST · 23 signed up · ₹22,977 paid
//                                                         You’ll confirm before anything is sent.
//   ┌ (₹) Refunding each person who paid in full            [Change] ┐
//   │     23 people · ₹22,977 in total                               │
//   ⚠ It starts in 45 min. Some people may not see the email in time.
//   ┌ the email ───────────────────┐  ┌ how it looks in their inbox ┐
//
// Under the red button, one line says a check comes first, so it's safe
// to press.
//
// - The email starts from the cancellation template (data/reminders.js)
//   and is this cancellation's own: nothing is saved as a template.
// - Keep session (or ← in the top bar) goes back. With changes made, it
//   asks first.
//
// run: the session; people: who signed up; hostName; now
// nextDay: 'Fri 20 Nov', the upcoming session the main landing page link
//   will point to once this one is cancelled, or null (there's none)
// guardRef: App asks it before leaving from the top bar
// onConfirm({ email, refund, refundEach }): cancels (refundEach: rupees
//   each for a part refund, null for a full one); returns false if it couldn't
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
  // What people paid can differ (the price changed between sign-ups): a
  // part refund has to be less than the least anyone paid
  const lowest = anyPaid ? Math.min(...payers.map((p) => p.amount)) : 0;

  const template = useMemo(() => cancelTemplate({ paid: anyPaid }), [anyPaid]);
  const [draft, setDraft] = useState(template);
  // Bumped when the refund sentence is taken out or put back: the editor
  // starts again from the draft (it only reads what it's given when it opens)
  const [emailKey, setEmailKey] = useState(0);
  // The refund, as chosen in step 1: { kind: 'full' | 'part' | 'none', each }
  const [refund, setRefund] = useState({ kind: 'full', each: null });
  // 'refund' (step 1) | 'confirm' | 'leave'. Someone paid: the refund comes first.
  const [ask, setAsk] = useState(anyPaid ? 'refund' : null);
  const chosen = useRef(false); // step 1 answered at least once (Go back then just closes it)
  // Bumped by each choice in step 1: the bar and the preview's refund
  // sentence light up for a moment (flashing), then settle
  const [flash, setFlash] = useState(0);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (!flash) return undefined;
    setFlashing(true);
    const id = setTimeout(() => setFlashing(false), 2400);
    return () => clearTimeout(id);
  }, [flash]);
  const [failed, setFailed] = useState(false); // it started meanwhile
  const tester = useTestEmail();

  const refunding = anyPaid && refund.kind !== 'none';
  const refundEach = refunding && refund.kind === 'part' ? refund.each : null;
  // Changed from the template (with the refund sentence or without it, as chosen)
  const base = refunding ? template.body : withoutRefund(template.body);
  const dirty = draft.subject !== template.subject || draft.body !== base;
  const emptySubject = !draft.subject;

  // The preview's values: the example person, and what they'd get back
  // (in full: what the first person paid, as an example)
  const values = useMemo(
    () => ({
      ...fieldValues(run, SAMPLE, hostName),
      refund_amount: rupees(refundEach ?? payers[0]?.amount ?? 0),
    }),
    [run, hostName, refundEach, payers],
  );
  // What the preview shows: the email, with its refund sentence marked for
  // a moment of highlight just after a choice
  const shown = flashing && refunding ? { ...draft, body: markRefund(draft.body, `cs-flash cs-flash-${flash}`) } : draft;
  // What Insert detail offers: no join link (there's nothing to join); the
  // Refund amount only while someone is being refunded
  const fields = FIELDS.filter((f) => f.key !== 'join_link' && (!f.only || (f.only === 'cancel' && refunding)));

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
    const ok = onConfirm({ email: { subject: draft.subject, body: draft.body }, refund: refunding, refundEach });
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

      {/* The refund chosen in step 1, in a bar of its own, with a way back
          to it. Lights up for a moment after each choice (remounted by key,
          so the highlight plays again). */}
      {anyPaid && (
        <div key={flash} className={`cs__refund ${flash ? 'cs__refund--flash' : ''}`}>
          <span className="cs__refund-icon" aria-hidden="true">
            <Banknote size={16} />
          </span>
          <div className="cs__refund-text" role="status">
            <p className="cs__refund-title">{refundLine(refund)}</p>
            {refund.kind !== 'none' && (
              <p className="cs__refund-facts">{refundFacts(refund, payers.length, paidTotal)}</p>
            )}
          </div>
          <button type="button" className="oh__edit re__btn cs__refund-change" onClick={() => setAsk('refund')}>
            Change
          </button>
        </div>
      )}

      {startsSoon && !failed && (
        <p className="cs__warn">
          <AlertTriangle size={16} aria-hidden="true" />
          It starts in {inTime(start - now)}. Some people may not see the email in time.
        </p>
      )}

      <div className="re__grid">
        <EmailCard key={emailKey} initial={draft} onChange={setDraft} fields={fields} />
        <EmailPreview
          draft={shown}
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
            {confirmLine({ emailed: people.length, refunding })}{' '}
            <LinkMoves nextDay={nextDay} />
          </p>
        </ConfirmDialog>
      )}

      {ask === 'refund' && (
        <RefundDialog
          count={payers.length}
          total={paidTotal}
          lowest={lowest}
          initial={refund}
          // The first time, Go back leaves the page (nothing is changed yet);
          // from Change, it just keeps the refund as it was
          onCancel={() => {
            setAsk(null);
            if (!chosen.current) onClose();
          }}
          onChoose={(next) => {
            chosen.current = true;
            // Refunding or not changed: take the refund sentence out of the
            // email, or put it back, and open the editor on the result
            const nowRefunding = next.kind !== 'none';
            if (nowRefunding !== refunding) {
              setDraft((d) => ({ ...d, body: nowRefunding ? withRefund(d.body) : withoutRefund(d.body) }));
              setEmailKey((k) => k + 1);
            }
            setRefund(next);
            setAsk(null);
            setFlash((n) => n + 1); // show where the choice went
          }}
        />
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

// The page's refund bar: the one place the refund is described. "Each
// person who paid" is true however many paid, so there are no special cases.
//   'Refunding ₹399 to each person who paid'
//   'Refunding each person who paid in full'
//   'Not refunding anyone'
function refundLine({ kind, each }) {
  if (kind === 'none') return 'Not refunding anyone';
  if (kind === 'part') return `Refunding ${rupees(each)} to each person who paid`;
  return 'Refunding each person who paid in full';
}

// The bar's second line, only while refunding: how many are refunded
// (only people who paid) and the total going back. Not refunding has no
// second line (the header already says what was paid).
//   '2 people · ₹600 in total'   (part: ₹300 each)
//   '2 people · ₹998 in total'   (full)
function refundFacts({ kind, each }, count, paid) {
  const total = kind === 'part' ? each * count : paid;
  return `${peopleCount(count)} · ${rupees(total)} in total`;
}

// The check's first sentence: what's about to happen, without repeating
// the amounts (the bar and the preview just showed them)
//   'We’ll email 2 people and send their refunds.'
//   'We’ll email 2 people.'
function confirmLine({ emailed, refunding }) {
  const email = emailed > 0 ? `We’ll email ${peopleCount(emailed)}` : 'Nobody is emailed';
  return refunding ? `${email} and send their refunds.` : `${email}.`;
}

// ---------- Step 1: How should we refund people? ----------
//
//   How should we refund people?
//   2 people paid ₹998 in total.
//   (•) Refund in full     Everyone gets back what they paid.
//   ( ) Refund part        Everyone gets back the same amount.
//                          ₹[ 200 ] each            (once it's picked)
//   ( ) Don't refund       Nobody gets money back.
//   It usually reaches them in 5 to 7 working days.
//                                          [Go back] [Continue]
//
// Refund part: more than ₹0 and less than the least anyone paid (lowest);
// too high says so under the box, and Continue waits for an amount that
// works. A stray click outside doesn't close it; Go back and Escape do.
// initial: the refund as it is now (the page's Change opens it on that)
function RefundDialog({ count, total, lowest, initial, onCancel, onChoose }) {
  const [kind, setKind] = useState(initial.kind);
  const [amount, setAmount] = useState(initial.each ? String(initial.each) : ''); // digits only
  const each = Number(amount) || 0;
  const tooHigh = kind === 'part' && each >= lowest;
  const ready = kind !== 'part' || (each > 0 && !tooHigh);

  // Refund part picked: straight into the amount box
  const input = useRef(null);
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current && kind === 'part') input.current?.focus();
    picked.current = false;
  }, [kind]);
  const pick = (next) => {
    picked.current = true;
    setKind(next);
  };

  const choose = () => ready && onChoose({ kind, each: kind === 'part' ? each : null });
  // One person: the words fit them
  const one = count === 1;
  const options = [
    { id: 'full', title: 'Refund in full', text: one ? 'They get back what they paid.' : 'Everyone gets back what they paid.' },
    { id: 'part', title: 'Refund part', text: one ? 'They get back part of what they paid.' : 'Everyone gets back the same amount.' },
    { id: 'none', title: 'Don’t refund', text: one ? 'They get nothing back.' : 'Nobody gets money back.' },
  ];

  return (
    <ConfirmDialog
      title="How should we refund people?"
      confirmLabel="Continue"
      cancelLabel="Go back"
      confirmDisabled={!ready}
      form // a stray click outside doesn't close it; Go back and Escape do
      onCancel={onCancel}
      onConfirm={choose}
    >
      <p>
        {peopleCount(count)} paid {rupees(total)}
        {count > 1 ? ' in total' : ''}.
      </p>
      <div className="cs-pick" role="radiogroup" aria-label="How to refund">
        {options.map((o) => (
          <label key={o.id} className={`cs-pick__option ${kind === o.id ? 'cs-pick__option--on' : ''}`}>
            <input type="radio" name="cs-refund" checked={kind === o.id} onChange={() => pick(o.id)} />
            <span className="cs-pick__text">
              <span className="cs-pick__title">{o.title}</span>
              <span className="cs-pick__note">{o.text}</span>
              {o.id === 'part' && kind === 'part' && (
                <span className="cs-pick__amount">
                  <span className="cs-pick__money">
                    <span className="cs-pick__currency" aria-hidden="true">
                      ₹
                    </span>
                    <input
                      ref={input}
                      inputMode="numeric"
                      className={`cs-pick__input ${tooHigh ? 'cs-pick__input--error' : ''}`}
                      aria-label={count === 1 ? 'Amount to refund, in rupees' : 'Amount to refund each person, in rupees'}
                      aria-invalid={tooHigh || undefined}
                      aria-describedby={tooHigh ? 'cs-pick-error' : undefined}
                      value={amount}
                      maxLength={6}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && choose()}
                    />
                  </span>
                  {count > 1 && 'each'}
                </span>
              )}
              {o.id === 'part' && tooHigh && (
                <span className="cs-pick__error" id="cs-pick-error">
                  {count === 1 || payersPaidSame(lowest, total, count)
                    ? `Enter an amount less than ${rupees(lowest)}.`
                    : `Enter less than ${rupees(lowest)}, the least anyone paid.`}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <p className="cs-pick__days">It usually reaches them in 5 to 7 working days.</p>
    </ConfirmDialog>
  );
}

// Everyone paid the same: the total is the least amount times the people
const payersPaidSame = (lowest, total, count) => lowest * count === total;