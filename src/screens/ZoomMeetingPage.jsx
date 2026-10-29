import { useEffect, useState } from 'react';
import { ArrowRight, Mic, MicOff, PhoneOff, Users, Video, VideoOff, X } from 'lucide-react';
import { funnelTypes } from '../data/funnelTypes';
import { mockAccount } from '../data/myPage';
import { HEARTBEAT_MS, endSegment, heartbeat, startSegment } from '../data/recordings';
import { isOnNow, webinarEnd, webinarStart, webinarWhen, zoomMeetingId } from '../data/webinar';
import { funnelName } from '../utils/funnelName';
import { initials } from '../utils/initials';
import { loadSaved } from '../utils/storage';
import './ZoomMeetingPage.css';

// ------------------------------------------------------------
// A stand-in for the webinar's Zoom meeting, at ?mock=zoom&webinar=<id>
// (see main.jsx). The real product starts the coach's Zoom meeting
// through the Zoom connection; this is the room that opens in its place,
// from the meeting button on the Webinars tab and the overview's Start.
//
//   ┌ Zoom  Fix the Vasthu mistakes…        Meeting ID 845 2193 0761 · ● Live 12:04 ┐
//   │ (before it starts) Starts at 7:00 pm IST. People who signed up get in…         │
//   │                ┌──────────────────────┐                     ┌ Participants ┐  │
//   │                │          HN          │                     │ Harish (Host)│  │
//   │                └ Harish Neel (Host, me) ┘                   └──────────────┘  │
//   └ [Mute] [Start video]            [Participants 1]                    [End]   ┘
//
// Looks like Zoom on purpose (its dark room and blue), not like our app:
// this is where the coach thinks they've gone. Mute, video and the
// participants list work; End leaves, with Rejoin to come back.
//
// Recording is on by default, as Zoom's cloud auto-recording would be:
// it starts when they're in the room and stops when they End (or close
// the tab). The red "Recording" in the top bar says so, so it's never a
// surprise; the recording then shows on the session's Recording tab
// (data/recordings.js). There's no switch to turn it off in this version.
//
// webinarId: the saved webinar's id
// ------------------------------------------------------------

// The saved webinar → { name, answers }, or null when it's gone
function readWebinar(id) {
  const { funnels } = loadSaved();
  const f = Array.isArray(funnels) ? funnels.find((item) => item?.id === id) : null;
  if (!f) return null;
  const type = funnelTypes.find((t) => t.id === f.type);
  const answers = f.answers && typeof f.answers === 'object' && !Array.isArray(f.answers) ? f.answers : {};
  return { name: funnelName({ answers }, type), answers };
}

// 754 s → '12:34', 3_754 s → '1:02:34'
function elapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Where the session is, for the top bar: { live, text }
function sessionLine(answers, now) {
  const start = webinarStart(answers);
  if (start === null) return { live: false, text: 'No date set' };
  if (isOnNow(answers, now)) return { live: true, text: `Live ${elapsed(now - start)}` };
  const end = webinarEnd(answers);
  if (now >= end) return { live: false, text: 'Session over' };
  const mins = Math.ceil((start - now) / 60_000);
  if (mins <= 60) return { live: false, text: `Starts in ${mins} min` };
  return { live: false, text: `Starts ${webinarWhen(answers)?.line ?? 'later'}` };
}

// Tabs opened from the Webinars tab can close themselves; a typed address goes back there
function closeTab() {
  window.close();
  setTimeout(() => window.location.assign(window.location.pathname), 150);
}

export default function ZoomMeetingPage({ webinarId }) {
  const [webinar] = useState(() => readWebinar(webinarId));
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [left, setLeft] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = webinar ? `Zoom · ${webinar.name}` : 'Zoom';
  }, [webinar]);

  // In the room: recording. Every so often it says it's still there, so a
  // tab closed without End still ends its recording (at the last check).
  // Leaving (End), closing the tab or going elsewhere stops it.
  useEffect(() => {
    if (!webinar || left) return undefined;
    startSegment(webinarId);
    const beat = setInterval(() => heartbeat(webinarId), HEARTBEAT_MS);
    const stop = () => endSegment(webinarId);
    window.addEventListener('pagehide', stop);
    return () => {
      clearInterval(beat);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [webinar, webinarId, left]);

  if (!webinar) {
    return (
      <div className="zm zm--center">
        <div className="zm__message">
          <h1 className="zm__message-title">This meeting doesn’t exist</h1>
          <p className="zm__message-text">Its webinar may have been deleted. Open it again from your Webinars.</p>
          <a className="zm__primary" href={window.location.pathname}>
            Go to Webinars <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  const host = mockAccount.name;
  const meetingId = zoomMeetingId(webinarId);
  const session = sessionLine(webinar.answers, now);
  const start = webinarStart(webinar.answers);
  const early = start !== null && now < start;
  const when = webinarWhen(webinar.answers);

  if (left) {
    return (
      <div className="zm zm--center">
        <div className="zm__message">
          <h1 className="zm__message-title">You left the meeting</h1>
          <p className="zm__message-text">
            {session.live
              ? 'Your webinar is still on. People who joined are waiting for you.'
              : `Meeting ID ${meetingId}. You can come back to it any time.`}
          </p>
          <p className="zm__message-text zm__message-rec">
            Recording stopped. Rejoin and it carries on; otherwise you'll find it on your webinar page, on this
            session's Recording tab, once Zoom has processed it.
          </p>
          <div className="zm__message-actions">
            <button type="button" className="zm__primary" onClick={() => setLeft(false)}>
              Rejoin
            </button>
            <button type="button" className="zm__secondary" onClick={closeTab}>
              Close tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zm">
      <header className="zm__bar">
        <span className="zm__brand">
          zoom <span className="zm__mock">Mock</span>
        </span>
        <h1 className="zm__title">{webinar.name}</h1>
        <p className="zm__meta">
          {/* On by default: always shown while they're in the room */}
          <span className="zm__rec">
            <span className="zm__rec-dot" aria-hidden="true" />
            Recording
          </span>
          <span>Meeting ID {meetingId}</span>
          <span className={session.live ? 'zm__status zm__status--live' : 'zm__status'}>
            {session.live && <span className="zm__live-dot" aria-hidden="true" />}
            {session.text}
          </span>
        </p>
      </header>

      {early && when && (
        <p className="zm__notice">
          Your webinar starts at {when.line.split(', ')[1]}. People who signed up can get in from 15 minutes before.
          Use the time to check your mic and camera.
        </p>
      )}

      <main className="zm__body">
        <section className="zm__stage" aria-label="Video">
          <div className={videoOn ? 'zm__tile zm__tile--video' : 'zm__tile'}>
            {videoOn ? (
              <p className="zm__tile-note">Your camera would show here. The prototype doesn’t use it.</p>
            ) : (
              <span className="zm__avatar" aria-hidden="true">
                {initials(host)}
              </span>
            )}
            <span className="zm__nameplate">
              {muted ? <MicOff size={14} aria-label="Muted" /> : <Mic size={14} aria-label="Unmuted" />}
              {host} (Host, me)
            </span>
          </div>
        </section>

        {listOpen && (
          <aside className="zm__panel" aria-labelledby="zm-panel-title">
            <div className="zm__panel-head">
              <h2 className="zm__panel-title" id="zm-panel-title">
                Participants (1)
              </h2>
              <button type="button" className="zm__icon" onClick={() => setListOpen(false)} aria-label="Close participants">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <ul className="zm__people">
              <li className="zm__person">
                <span className="zm__person-avatar" aria-hidden="true">
                  {initials(host)}
                </span>
                <span className="zm__person-name">
                  {host} <span className="zm__person-role">(Host, me)</span>
                </span>
                {muted ? <MicOff size={15} aria-label="Muted" /> : <Mic size={15} aria-label="Unmuted" />}
              </li>
            </ul>
            <p className="zm__panel-note">People who signed up show here as they join.</p>
          </aside>
        )}
      </main>

      <footer className="zm__tools">
        <div className="zm__tools-group">
          <ToolButton
            icon={muted ? MicOff : Mic}
            label={muted ? 'Unmute' : 'Mute'}
            off={muted}
            onClick={() => setMuted((m) => !m)}
          />
          <ToolButton
            icon={videoOn ? Video : VideoOff}
            label={videoOn ? 'Stop video' : 'Start video'}
            off={!videoOn}
            onClick={() => setVideoOn((v) => !v)}
          />
        </div>
        <div className="zm__tools-group">
          <ToolButton
            icon={Users}
            label="Participants"
            count={1}
            pressed={listOpen}
            onClick={() => setListOpen((o) => !o)}
          />
        </div>
        <div className="zm__tools-group zm__tools-group--end">
          <button type="button" className="zm__end" onClick={() => setLeft(true)}>
            <PhoneOff size={16} aria-hidden="true" /> End
          </button>
        </div>
      </footer>
    </div>
  );
}

// A toolbar button: icon over a short label, like Zoom's.
// off: shown with a red slash colour (muted, video off); pressed: a toggle that's open
function ToolButton({ icon: Icon, label, off = false, pressed, count, onClick }) {
  return (
    <button
      type="button"
      className={off ? 'zm__tool zm__tool--off' : 'zm__tool'}
      onClick={onClick}
      aria-pressed={pressed}
    >
      <span className="zm__tool-icon">
        <Icon size={20} aria-hidden="true" />
        {count !== undefined && <span className="zm__tool-count">{count}</span>}
      </span>
      <span className="zm__tool-label">{label}</span>
    </button>
  );
}