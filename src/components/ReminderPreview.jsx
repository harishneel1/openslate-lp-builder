import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import InboxPreview from './InboxPreview';
import { CALL_REMINDERS, buildReminderEmail, sendTime } from '../data/callReminders';
import { DEFAULT_MEETING_LINK } from '../data/bookingsStore';
import { loadCallHours } from '../data/availabilityStore';
import { MY_CALL_ID, callAnswersOf, getMyProfile, loadAnswers, myCallIds, myMeetingLink } from '../data/myProfile';
import { CALL_DEFAULTS } from '../data/callDetails';
import { addDays, toInstant, todayIn } from '../utils/slots';
import './ReminderPreview.css';

// ------------------------------------------------------------
// "Preview email": what someone who books this call gets before it,
// exactly as it lands in their inbox (InboxPreview.jsx, the same look
// as the webinar emails).
//
//   ┌ Reminder emails                                         ✕ ┐
//   │ [ 24 hours before ][ 1 hour before ]                        │
//   │ ┌ Reminder: Discovery call with Harish tomorrow at 4 pm ─┐ │
//   │ │ (H) Harish Neel                          4:00 PM        │ │
//   │ │     Hi Rohan, …                                          │ │
//   │ │     [ Join call ]                                        │ │
//   │ └────────────────────────────────────────────────────────┘ │
//   └─────────────────────────────────────────────────────────────┘
//
// Filled in with the call's own name and meeting link, and a sample
// booking: Rohan (the student in the editor's examples), tomorrow at
// 4:00 pm on the call's own clock. Only shows; nothing here changes the
// call, so there's no Done: ✕ and Escape close it. A click outside
// doesn't, so it isn't lost by a stray click.
//
// call: { title, durationMins, timeZone, meetingLink } as they are now:
//   from the call editor's draft, so an unsaved new name already shows
//   (callForPreview builds it from saved answers). A missing link shows
//   the stand-in one, as bookings get.
// hostName: the coach's name; their saved one if left out
// startWith: which email opens first ('dayBefore' or 'hourBefore')
// onClose(): ✕ or Escape
// ------------------------------------------------------------

const SAMPLE_GUEST = { name: 'Rohan Mehta', email: 'rohan@example.com', phone: '+91 98765 43210' };

// A made-up booking of this call, so the email reads as it will
function sampleBooking({ title, durationMins, timeZone, meetingLink }) {
  const zone = timeZone || 'Asia/Kolkata';
  const start = toInstant(addDays(todayIn(zone), 1), '16:00', zone);
  const length = Number(durationMins) || CALL_DEFAULTS.callDuration;
  return {
    id: 'sample',
    title: String(title ?? '').trim() || 'Your call',
    start: new Date(start).toISOString(),
    end: new Date(start + length * 60_000).toISOString(),
    format: 'video', // every call is a video call (myProfile.js callService)
    guest: SAMPLE_GUEST,
    guestTimeZone: zone,
    meetingLink: meetingLink || DEFAULT_MEETING_LINK,
  };
}

// The preview's call, from what's saved: for opening it outside the editor
export function callForPreview(answers, callId) {
  const call = callAnswersOf(answers, callId) ?? {};
  return {
    title: call.callTitle,
    durationMins: call.callDuration,
    timeZone: loadCallHours(callId).timeZone,
    meetingLink: myMeetingLink(answers),
  };
}

export default function ReminderPreview({ call, hostName = null, startWith = 'dayBefore', onClose }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(startWith);

  const booking = useMemo(() => sampleBooking(call), [call]);
  const host = useMemo(() => hostName || getMyProfile(loadAnswers()).creator.name, [hostName]);
  const email = buildReminderEmail(shown, booking, host);
  // The inbox shows when it arrived: the reminder's own send time
  const arrived = new Date(sendTime(booking, shown)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: booking.guestTimeZone,
  });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="rp"
      aria-labelledby="rp-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="rp__head">
        <h2 className="rp__title" id="rp-title">
          Reminder emails
        </h2>
        <button type="button" className="rp__close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {/* Which email: a pair of buttons, like a tab bar for two */}
      <div className="rp__switch" role="group" aria-label="Which email">
        {CALL_REMINDERS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`rp__option ${r.id === shown ? 'rp__option--on' : ''}`}
            aria-pressed={r.id === shown}
            onClick={() => setShown(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div className="rp__inbox">
        <InboxPreview
          subject={email.subject}
          bodyHtml={email.bodyHtml}
          fromName={host}
          toEmail={SAMPLE_GUEST.email}
          time={arrived}
          join={email.join}
          footer={email.footer}
        />
      </div>

    </dialog>
  );
}

// ------------------------------------------------------------
// ?mock=reminders → the pop-up on its own, for trying the emails before
// the call editor has its Reminders section (round 2).
// &service=<call id> for another call (default: their newest call).
// Closing it leaves a button to open it again.
// ------------------------------------------------------------
export function ReminderPreviewPage({ serviceId = null }) {
  const answers = useMemo(() => loadAnswers(), []);
  const callId = serviceId ?? myCallIds(answers)[0] ?? MY_CALL_ID;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    document.title = 'Reminder emails';
  }, []);

  return (
    <main className="rp-page">
      <button type="button" className="rp__done" onClick={() => setOpen(true)}>
        Preview reminder emails
      </button>
      {open && (
        <ReminderPreview
          call={callForPreview(answers, callId)}
          hostName={getMyProfile(answers).creator.name}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}