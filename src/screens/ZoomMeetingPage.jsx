import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Circle, Lock, Mic, MicOff, Pause, PhoneOff, Users, Video, VideoOff, X } from 'lucide-react';
import { funnelTypes } from '../data/funnelTypes';
import { mockAccount } from '../data/myPage';
import {
  HEARTBEAT_MS,
  endSegment,
  heartbeat,
  pauseRecording,
  recordChoiceOf,
  resumeRecording,
  setRecordChoice,
  startSegment,
} from '../data/recordings';
import {
  FREE_BYTES,
  PLANS_HREF,
  RECORDING_BYTES_PER_HOUR,
  assetsOf,
  formatBytes,
  usageOf,
} from '../data/cloudStorage';
import { isCancelled, webinarEnd, webinarStart, webinarWhen, zoomMeetingId } from '../data/webinar';
import { classDay, classTime, dayOn, getBatch, nextClasses } from '../data/batches';
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
// Before a webinar's room, "Ready to join?" (JoinScreen): whether to
// record, ticked by default, with how much of their free storage they've
// used and what an hour of recording takes. It's asked every time they
// join (Rejoin too), starting from what they chose last time for this
// session, so leaving and coming back never quietly changes it.
//
//   ┌──────────────── Ready to join? ────────────────┐
//   │ Fix the Vasthu mistakes…                       │
//   │ Sat 7 Nov, 7:00 pm IST                         │
//   │ ┌────────────────────────────────────────────┐ │
//   │ │ [✓] Record this session                    │ │
//   │ │     Recordings use your free storage.      │ │
//   │ │     ▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │ │
//   │ │     4.4 GB of 20 GB used · about 500 MB…   │ │
//   │ └────────────────────────────────────────────┘ │
//   │                [Join meeting]                  │
//   └────────────────────────────────────────────────┘
//
// Ticked: recording starts when they're in the room and stops when they
// End (or close the tab), and the red "Recording" in the top bar says
// so. Unticked: nothing is recorded, and the top bar says "Not
// recording", so they always know which. The recording then shows on the
// session's Recording tab and in Cloud Storage (data/recordings.js).
//
// While recording, Pause recording in the toolbar stops it for a while
// and Resume recording carries on, in the same recording: paused time is
// left out of it, and of its size. The top bar's red "Recording" turns
// to an amber "Recording paused" meanwhile. End while paused just leaves;
// Rejoin starts unpaused (asked on "Ready to join?" as always).
//
// When their storage is almost full (80%+), "Ready to join?" says how
// much is left. When it's full, it says just that, and the box is
// unticked and locked: the session can't be recorded, but Join meeting
// still works, so a full account never stops a live session. Upgrade
// plan opens the plans page in a new tab (PLANS_HREF). A recording
// under way is never stopped for being over: it's kept
// (data/cloudStorage.js).
//
// A cancelled session's meeting is closed (in the real product, the Zoom
// meeting is deleted): the room says so, nobody gets in, and nothing is
// recorded.
//
// A batch's class (Live classes) opens here too, from Start class on the
// batch's page: the same room, for the class on now or the next one.
// Batches have one meeting for all their classes. No recording for
// classes in this round.
//
// webinarId: the saved webinar's id; or batchId: the batch's
// ------------------------------------------------------------

// The meeting, whichever it's for:
//   { kind: 'webinar' | 'batch', id, name, start, end (ms, or null),
//     whenLine ('Sat 24 Oct, 7:00 pm IST' / 'Tomorrow, 6:30 am'), cancelled }
// or null when it's gone
function readMeeting(webinarId, batchId) {
  if (batchId) {
    const batch = getBatch(batchId);
    if (!batch) return null;
    const now = Date.now();
    const c = nextClasses(batch, now, 1)[0] ?? null;
    return {
      kind: 'batch',
      id: batch.id,
      name: batch.title,
      start: c?.start ?? null,
      end: c?.end ?? null,
      whenLine: c ? `${classDay(c.date, dayOn(now, batch))}, ${classTime(c, batch)}` : null,
      cancelled: false,
    };
  }
  const { funnels } = loadSaved();
  const f = Array.isArray(funnels) ? funnels.find((item) => item?.id === webinarId) : null;
  if (!f) return null;
  const type = funnelTypes.find((t) => t.id === f.type);
  const answers = f.answers && typeof f.answers === 'object' && !Array.isArray(f.answers) ? f.answers : {};
  return {
    kind: 'webinar',
    id: webinarId,
    name: funnelName({ answers }, type),
    start: webinarStart(answers),
    end: webinarStart(answers) === null ? null : webinarEnd(answers),
    whenLine: webinarWhen(answers)?.line ?? null,
    cancelled: isCancelled(f),
  };
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
function sessionLine(meeting, now) {
  const { start, end } = meeting;
  if (start === null) return { live: false, text: 'No date set' };
  if (now >= start && now < end) return { live: true, text: `Live ${elapsed(now - start)}` };
  if (now >= end) return { live: false, text: meeting.kind === 'batch' ? 'Class over' : 'Session over' };
  const mins = Math.ceil((start - now) / 60_000);
  if (mins <= 60) return { live: false, text: `Starts in ${mins} min` };
  return { live: false, text: `Starts ${meeting.whenLine ?? 'later'}` };
}

// Tabs opened from the Webinars tab can close themselves; a typed address goes back there
function closeTab() {
  window.close();
  setTimeout(() => window.location.assign(window.location.pathname), 150);
}

export default function ZoomMeetingPage({ webinarId, batchId = null }) {
  const [webinar] = useState(() => readMeeting(webinarId, batchId));
  const isClass = webinar?.kind === 'batch';
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // Webinars start on "Ready to join?"; classes aren't recorded, so they go
  // straight in. 'ready' | 'room' | 'left'
  const [stage, setStage] = useState(() => (webinar?.kind === 'webinar' ? 'ready' : 'room'));
  const left = stage === 'left';
  // Record this session: what they chose last time here, ticked the first time
  const [record, setRecord] = useState(() => recordChoiceOf(webinarId) ?? true);
  // Whether this time in the room records: their choice, unless storage
  // was full when they joined. Set on Join meeting.
  const [recOn, setRecOn] = useState(false);
  const recording = !isClass && recOn;
  // Recording paused from the toolbar; never paused on joining
  const [paused, setPaused] = useState(false);
  const togglePause = () => {
    if (paused) resumeRecording(webinarId);
    else pauseRecording(webinarId);
    setPaused((p) => !p);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = webinar ? `Zoom · ${webinar.name}` : 'Zoom';
  }, [webinar]);

  // In the room with Record this session ticked: recording. Every so
  // often it says it's still there, so a tab closed without End still
  // ends its recording (at the last check). Leaving (End), closing the
  // tab or going elsewhere stops it.
  useEffect(() => {
    if (!webinar || webinar.cancelled || stage !== 'room' || !recording) return undefined;
    startSegment(webinarId);
    const beat = setInterval(() => heartbeat(webinarId), HEARTBEAT_MS);
    const stop = () => endSegment(webinarId);
    window.addEventListener('pagehide', stop);
    return () => {
      clearInterval(beat);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [webinar, webinarId, stage, recording]);

  if (!webinar) {
    return (
      <div className="zm zm--center">
        <div className="zm__message">
          <h1 className="zm__message-title">This meeting doesn’t exist</h1>
          <p className="zm__message-text">
            {batchId
              ? 'Its batch may have been deleted. Open it again from Live classes.'
              : 'Its webinar may have been deleted. Open it again from your Webinars.'}
          </p>
          <a className="zm__primary" href={window.location.pathname}>
            {batchId ? 'Go to Live classes' : 'Go to Webinars'} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  if (webinar.cancelled) {
    const when = webinar.whenLine ? { line: webinar.whenLine } : null;
    return (
      <div className="zm zm--center">
        <div className="zm__message">
          <h1 className="zm__message-title">This meeting was cancelled</h1>
          <p className="zm__message-text">
            The session{when ? ` on ${when.line}` : ''} was cancelled, so its meeting is closed and nobody can join.
          </p>
          <div className="zm__message-actions">
            <button type="button" className="zm__secondary" onClick={closeTab}>
              Close tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  const host = mockAccount.name;
  const meetingId = zoomMeetingId(webinar.id);
  const session = sessionLine(webinar, now);
  const start = webinar.start;
  const early = start !== null && now < start;
  const when = webinar.whenLine ? { line: webinar.whenLine } : null;

  if (stage === 'ready') {
    return (
      <JoinScreen
        name={webinar.name}
        when={webinar.whenLine}
        early={early}
        record={record}
        onRecord={setRecord}
        onJoin={({ full }) => {
          // Full: not recorded, and saved as blocked rather than as their
          // choice, so next time the box starts as they'd want it
          setRecordChoice(webinarId, record && !full, Date.now(), { full: full && record });
          setRecOn(record && !full);
          setPaused(false);
          setStage('room');
        }}
      />
    );
  }

  if (left) {
    return (
      <div className="zm zm--center">
        <div className="zm__message">
          <h1 className="zm__message-title">You left the meeting</h1>
          <p className="zm__message-text">
            {session.live
              ? `Your ${isClass ? 'class' : 'webinar'} is still on. People who joined are waiting for you.`
              : `Meeting ID ${meetingId}. You can come back to it any time.`}
          </p>
          {recording && (
            <p className="zm__message-text zm__message-rec">
              Recording stopped. Rejoin with Record this session ticked and it carries on; otherwise you'll find it on
              this session's Recording tab and in Cloud Storage, once Zoom has processed it.
            </p>
          )}
          {!isClass && !recording && (
            <p className="zm__message-text zm__message-rec">This session wasn't recorded while you were in.</p>
          )}
          <div className="zm__message-actions">
            {/* A webinar asks about recording again; a class goes straight back in */}
            <button type="button" className="zm__primary" onClick={() => setStage(isClass ? 'room' : 'ready')}>
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
          {/* A webinar always says whether it's recording, either way */}
          {recording && !paused && (
            <span className="zm__rec">
              <span className="zm__rec-dot" aria-hidden="true" />
              Recording
            </span>
          )}
          {recording && paused && (
            <span className="zm__rec zm__rec--paused">
              <Pause size={12} fill="currentColor" aria-hidden="true" />
              Recording paused
            </span>
          )}
          {!isClass && !recording && (
            <span className="zm__rec zm__rec--off">
              <VideoOff size={13} aria-hidden="true" />
              Not recording
            </span>
          )}
          <span>Meeting ID {meetingId}</span>
          <span className={session.live ? 'zm__status zm__status--live' : 'zm__status'}>
            {session.live && <span className="zm__live-dot" aria-hidden="true" />}
            {session.text}
          </span>
        </p>
      </header>

      {early && when && (
        <p className="zm__notice">
          Your {isClass ? 'class' : 'webinar'} starts at {when.line.split(', ').at(-1)}.{' '}
          {isClass ? 'Members can get in from 15 minutes before.' : 'People who signed up can get in from 15 minutes before.'}{' '}
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
            <p className="zm__panel-note">{isClass ? 'Members' : 'People who signed up'} show here as they join.</p>
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
          {/* Only while recording: there's nothing to pause otherwise */}
          {recording && (
            <ToolButton
              icon={paused ? Circle : Pause}
              label={paused ? 'Resume recording' : 'Pause recording'}
              paused={paused}
              onClick={togglePause}
            />
          )}
          <ToolButton
            icon={Users}
            label="Participants"
            count={1}
            pressed={listOpen}
            onClick={() => setListOpen((o) => !o)}
          />
        </div>
        <div className="zm__tools-group zm__tools-group--end">
          <button type="button" className="zm__end" onClick={() => setStage('left')}>
            <PhoneOff size={16} aria-hidden="true" /> End
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- Ready to join? ----------
// The one question before a webinar's room: record it or not. Ticked by
// default. Under it, how full their free storage is, since a recording
// counts toward it, and what an hour takes, so they can judge.
// The storage figures are read once, when the screen opens.
// onJoin({ full }): full says the box was locked because storage is full
function JoinScreen({ name, when, early, record, onRecord, onJoin }) {
  const [usage] = useState(() => {
    const { funnels } = loadSaved();
    const webinars = (Array.isArray(funnels) ? funnels : []).filter((f) => f?.type === 'webinar');
    return usageOf(assetsOf({ webinars }));
  });
  const sharePct = Math.round(usage.share * 100);
  const full = usage.level === 'full';
  const almost = usage.level === 'almost';
  const ticked = record && !full;

  return (
    <div className="zm zm--center">
      <div className="zm-join">
        <h1 className="zm-join__title">Ready to join?</h1>
        <p className="zm-join__name">{name}</p>
        {when && <p className="zm-join__when">{when}</p>}

        <div
          className={['zm-join__rec', ticked && 'zm-join__rec--on', full && 'zm-join__rec--full'].filter(Boolean).join(' ')}
        >
          <label className="zm-join__check">
            <input
              type="checkbox"
              checked={ticked}
              disabled={full}
              onChange={(e) => onRecord(e.target.checked)}
              aria-describedby="zm-join-storage"
            />
            <span className="zm-join__box" aria-hidden="true">
              {ticked && <Check size={14} strokeWidth={3} />}
              {full && <Lock size={12} strokeWidth={2.5} />}
            </span>
            <span className="zm-join__label">Record this session</span>
          </label>

          <div className="zm-join__storage" id="zm-join-storage">
            {full ? (
              <p className="zm-join__line zm-join__line--full">Your storage is full.</p>
            ) : (
              <p className="zm-join__line">
                {ticked
                  ? 'Recordings use your free storage.'
                  : 'This session won’t be recorded. To change that later, leave and join again.'}
              </p>
            )}
            <div
              className="zm-join__bar"
              role="meter"
              aria-label="Free storage used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={sharePct}
              aria-valuetext={`${formatBytes(usage.used)} of ${formatBytes(FREE_BYTES)} used`}
            >
              <span style={{ width: `${usage.used > 0 ? Math.max(1, usage.share * 100) : 0}%` }} />
            </div>
            <p className="zm-join__figures">
              {formatBytes(usage.used)} of {formatBytes(FREE_BYTES)} used
              {usage.over > 0
                ? ` · ${formatBytes(usage.over)} over`
                : ` · about ${formatBytes(RECORDING_BYTES_PER_HOUR)} for each hour recorded`}
            </p>
            {almost && ticked && (
              <p className="zm-join__almost">
                <AlertTriangle size={14} aria-hidden="true" />
                Almost full: {formatBytes(usage.left)} left.
              </p>
            )}
            {(full || almost) && (
              <a className="zm-join__more" href={PLANS_HREF} target="_blank" rel="noopener">
                Upgrade plan
              </a>
            )}
          </div>
        </div>

        <button type="button" className="zm__primary zm-join__go" onClick={() => onJoin({ full })}>
          Join meeting
        </button>
        {early && <p className="zm-join__early">You can join before it starts to check your mic and camera.</p>}
      </div>
    </div>
  );
}


// A toolbar button: icon over a short label, like Zoom's.
// off: shown with a red slash colour (muted, video off); pressed: a toggle that's open
// paused: the recording's button while paused, in amber like the top bar
function ToolButton({ icon: Icon, label, off = false, paused = false, pressed, count, onClick }) {
  return (
    <button
      type="button"
      className={['zm__tool', off && 'zm__tool--off', paused && 'zm__tool--paused'].filter(Boolean).join(' ')}
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