import { useEffect, useState } from 'react';
import { Download, Hourglass, Lock, Pause, Play, VideoOff } from 'lucide-react';
import './RecordingPanel.css';

// ------------------------------------------------------------
// A session's Zoom recording: the Recording tab of its side panel
// (SessionDrawer in WebinarDetails.jsx). Only the coach sees it.
//
// Ready:
//   ┌───────────────────────────────────────────┐
//   │ Fix the Vasthu mistakes…   (No video yet) │  a sample player: the
//   │                  ( ▶ )                    │  prototype has no file
//   │ Sat 7 Nov                                 │
//   └───────────────────────────────────────────┘
//   [❚❚]  12:04 / 58:30  ━━━━━━━━○────────────────
//   Recorded on Sat 7 Nov at 7:02 pm · 58 min      [Download]
//   🔒 Only you can see this recording.
//
// Until then, a short message in the panel's empty-state style:
//   not ready yet  before the session, or while Zoom gets it ready (hours,
//                  sometimes days): check back later
//   recording now  they're in the meeting
//   not recorded   the session ended and nobody joined from OpenSlate
//
// recording: from recordingOf (data/recordings.js)
// ended:     the session is over
// title:     the webinar's name; day: 'Sat 7 Nov' (or null)
// ------------------------------------------------------------

// 3_510_000 → '58:30', 3_930_000 → '1:05:30'
function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// '58 min', '1 hr 5 min', 'under a minute'
function lengthOf(ms) {
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'under a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// '7:02 pm', on the coach's own clock
const timeOf = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

export default function RecordingPanel({ recording, ended = true, title, day }) {
  const { status } = recording;

  // Not ready yet: before the session, or while Zoom gets it ready
  if ((status === 'none' && !ended) || status === 'processing') {
    return (
      <Message
        icon={<Hourglass size={22} />}
        title="Your recording isn't ready yet"
        text={
          status === 'processing'
            ? 'Zoom can take a few hours, sometimes a few days, to get it ready after the session. Check back here later.'
            : 'The session records on its own when you join with Join meeting. Once it’s over, Zoom can take a few hours or days to get the recording ready, so check back here later.'
        }
      />
    );
  }

  if (status === 'recording') {
    return (
      <Message
        icon={<span className="rec-panel__live-dot" />}
        tone="live"
        title="Recording now"
        text={`Zoom has been recording since ${timeOf(recording.startedAt)}. It'll show here once you end the meeting and Zoom has processed it.`}
      />
    );
  }

  if (status === 'none') {
    return (
      <Message
        icon={<VideoOff size={22} />}
        tone="quiet"
        title="This session wasn't recorded"
        text="Sessions record on their own when you join with Join meeting. Next time, start your webinar from here and the recording will show up in this tab."
      />
    );
  }

  return <Ready recording={recording} title={title} day={day} />;
}

function Message({ icon, title, text, tone = '' }) {
  return (
    <div className="calls__empty rec-panel__message">
      <span className={`calls__empty-icon ${tone ? `rec-panel__icon--${tone}` : ''}`} aria-hidden="true">
        {icon}
      </span>
      <h3 className="calls__empty-title">{title}</h3>
      <p className="calls__empty-text">{text}</p>
    </div>
  );
}

function Ready({ recording, title, day }) {
  const [note, setNote] = useState(false); // "no file in the prototype", after Download
  const recordedOn = [day ? `Recorded on ${day}` : 'Recorded', `at ${timeOf(recording.startedAt)}`].join(' ');
  const length = lengthOf(recording.duration);
  const parts = recording.parts > 1 ? `, in ${recording.parts} parts` : '';

  return (
    <div className="rec-panel">
      <SamplePlayer duration={recording.duration} title={title} day={day} />

      <div className="rec-panel__info">
        <p className="rec-panel__meta">
          {recordedOn} · {length}
          {parts}
        </p>
        <button type="button" className="oh__edit" onClick={() => setNote(true)}>
          <Download size={15} aria-hidden="true" /> Download
        </button>
      </div>

      <p className="rec-panel__private">
        <Lock size={14} aria-hidden="true" />
        Only you can see this recording.
      </p>

      <p className="rec-panel__note" aria-live="polite">
        {note && "There's no video file in the prototype yet, so nothing downloads."}
      </p>
    </div>
  );
}

// ---------- A stand-in for the video ----------
// Play, pause and the scrubber all work and the time moves as it would;
// there's just no picture. The scrubber is a native range input, so it
// works from the keyboard and reads out for screen readers.
function SamplePlayer({ duration, title, day }) {
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0); // ms in

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setAt((a) => Math.min(duration, a + 1000)), 1000);
    return () => clearInterval(id);
  }, [playing, duration]);

  // Stops at the end
  useEffect(() => {
    if (at >= duration) setPlaying(false);
  }, [at, duration]);

  const toggle = () => {
    if (!playing && at >= duration) setAt(0); // play again from the start
    setPlaying((p) => !p);
  };

  const Icon = playing ? Pause : Play;
  const label = playing ? 'Pause' : 'Play';

  return (
    <div className="rec-player">
      <div className={`rec-player__frame ${playing ? 'rec-player__frame--playing' : ''}`}>
        <span className="rec-player__sample">No video in the prototype</span>
        <button type="button" className="rec-player__big" onClick={toggle} aria-label={`${label} recording`}>
          <Icon size={26} fill="currentColor" aria-hidden="true" />
        </button>
        <span className="rec-player__caption">
          <span className="rec-player__title">{title}</span>
          {day && <span className="rec-player__day">{day}</span>}
        </span>
      </div>

      <div className="rec-player__bar">
        <button type="button" className="rec-player__small" onClick={toggle} aria-label={`${label} recording`}>
          <Icon size={16} fill="currentColor" aria-hidden="true" />
        </button>
        <span className="rec-player__time">
          {clock(at)} / {clock(duration)}
        </span>
        <input
          type="range"
          className="rec-player__seek"
          min={0}
          max={Math.max(1000, duration)}
          step={1000}
          value={at}
          onChange={(e) => setAt(Number(e.target.value))}
          aria-label="Position in the recording"
          aria-valuetext={`${clock(at)} of ${clock(duration)}`}
          style={{ '--seek': `${duration ? (at / duration) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}