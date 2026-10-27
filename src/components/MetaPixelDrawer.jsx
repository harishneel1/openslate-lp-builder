import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, ChevronDown, Eye, EyeOff, Play } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import Drawer from './Drawer';
import {
  PIXEL_EVENTS,
  PIXEL_ID_STEPS,
  PIXEL_VIDEOS,
  TOKEN_ADMIN_NOTE,
  TOKEN_STEPS,
  checkPixel,
  cleanPixelId,
  cleanToken,
  dayLabel,
  loadPixel,
  onPixelChange,
  pixelIdProblem,
  pixelStatus,
  removePixel,
  savePixel,
  tokenProblem,
  whenLabel,
} from '../data/metaPixel';
import { latestSignupAt, onSignupsChange } from '../data/webinarSignups';
import '../screens/OfferingsHome.css'; // the buttons (oh__add, oh__edit), wherever the panel opens
import './MetaPixelDrawer.css';

// ------------------------------------------------------------
// The Meta Pixel panel, from the right. Opened from the Meta Pixel row
// (Webinars list), a webinar's page and "Your webinar link" (PixelStatus).
// One pixel for the whole account.
//
// Nothing saved yet: the setup form (video, Pixel ID, access token).
// Something saved: Manage, what's connected and what can be done with it.
//
//   Your Meta Pixel                                            ✕
//   Used for all your webinars, including new ones.
//   ┌ ⚠ Your Meta Pixel has stopped working ────────────────┐  (broken only)
//   │ Your access token stopped working on 27 Oct…          │
//   │ [Replace access token]                                │
//   └───────────────────────────────────────────────────────┘
//   Pixel                 Harish Neel’s Pixel             Change
//                         Pixel ID 1234567890123456
//   Access token          ✓ Saved                         Replace
//   Last sign-up sent     Today, 7:42 pm
//   to Meta
//   What Meta will see ▾
//   ──────────────────────────────────────────────────────────
//   🗑 Remove pixel                                        [Done]
//
// The token is never shown again once it's saved, not even as dots:
// Replace asks for a new one. Change (the Pixel ID) clears the token too,
// since a token only works with the pixel it was made for.
//
// Both boxes are always required: a pixel without a working token isn't
// half done, it doesn't work. The form has three modes:
//   setup      first time: Pixel ID and access token
//   token      replace the access token (the Pixel ID is fixed, with Change)
//   change-id  a new Pixel ID and a new token (the old token only works
//              with the old pixel)
// Save and check → "Checking with Meta" → connected, or the problem under
// its box.
//
// After connecting, the result says what happens next (nothing more here;
// pick this pixel and event in the ad set in Ads Manager; how to see it
// working), and closing reports it, so whatever opened the panel can
// show where the status now lives (a short green highlight).
//
// onClose(result): result is { connected: true } when it closes on the
// "connected" screen, otherwise nothing
// ------------------------------------------------------------

// The saved pixel, kept up to date (here or in another tab)
export function usePixel() {
  const [record, setRecord] = useState(loadPixel);
  useEffect(() => onPixelChange(() => setRecord(loadPixel())), []);
  return record;
}

// What the form starts with: the saved Pixel ID (if any), and an empty
// token box. A saved token is never put back on screen.
function formStart(mode, record) {
  return { pixelId: record?.pixelId ?? '', token: '' };
}

export default function MetaPixelDrawer({ onClose }) {
  const record = usePixel();
  const status = pixelStatus(record);

  // Where it opens: the form when there's nothing yet, Manage otherwise
  // (Fix opens Manage too: the problem's on top, with Replace access token)
  const [initial] = useState(() => (loadPixel() ? { view: 'manage', mode: 'setup' } : { view: 'form', mode: 'setup' }));
  const [view, setView] = useState(initial.view); // 'manage' | 'form' | 'checking' | 'connected'
  const [mode, setMode] = useState(initial.mode); // the form's: 'setup' | 'token' | 'change-id'

  const [start, setStart] = useState(() => formStart(initial.mode, loadPixel()));
  const [pixelId, setPixelId] = useState(start.pixelId);
  const [token, setToken] = useState(start.token);
  // A box shows its problem once they've left it or pasted into it
  const [touched, setTouched] = useState({ pixelId: Boolean(start.pixelId), token: false });
  const [failure, setFailure] = useState(null); // { field, message } from the check with Meta
  const [showToken, setShowToken] = useState(false);
  const [focusNext, setFocusNext] = useState(null);
  const [asking, setAsking] = useState(null); // "Discard your changes?": what to do if they say yes
  const [removing, setRemoving] = useState(false); // "Remove your Meta Pixel?"

  const pixelRef = useRef(null);
  const tokenRef = useRef(null);
  const resultRef = useRef(null);

  // Still open when the check comes back? Set on every mount, not just the
  // first: in development React mounts, unmounts and mounts again
  // (StrictMode), and a flag left false would leave the panel stuck on
  // "Checking with Meta".
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Focus after the Drawer has opened (it focuses its own first control)
  useEffect(() => {
    if (view !== 'form' || !focusNext) return undefined;
    const timer = setTimeout(() => {
      const box = focusNext === 'token' ? tokenRef.current : pixelRef.current;
      box?.focus();
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFocusNext(null);
    }, 60);
    return () => clearTimeout(timer);
  }, [view, focusNext]);

  // A result: its heading takes focus, so screen readers hear it
  useEffect(() => {
    if (view === 'connected') resultRef.current?.focus();
  }, [view]);

  // Removed in another tab while this one's on Manage: nothing left to manage
  useEffect(() => {
    if (!record && view === 'manage') onClose();
  }, [record, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = (next) => {
    const values = formStart(next, record);
    setMode(next);
    setStart(values);
    setPixelId(values.pixelId);
    setToken(values.token);
    setTouched({ pixelId: Boolean(values.pixelId), token: false });
    setFailure(null);
    setShowToken(false);
    setFocusNext(next === 'change-id' ? 'pixelId' : next === 'token' ? 'token' : null);
    setView('form');
  };

  // ---------- The form's checks ----------
  const idEmpty = cleanPixelId(pixelId) === '';
  const tokenEmpty = cleanToken(token) === '';
  const idProblem = pixelIdProblem(pixelId);
  const tokProblem = tokenProblem(token);
  const sameId = mode === 'change-id' && cleanPixelId(pixelId) === record?.pixelId;

  // What shows under each box: the check's answer first, then the box's own.
  // A mismatch ('both') is said once, under the Pixel ID, with both boxes marked.
  const idError =
    failure?.field === 'pixelId' || failure?.field === 'both' ? failure.message : touched.pixelId ? idProblem : null;
  const tokenError = failure?.field === 'token' ? failure.message : touched.token ? tokProblem : null;
  const tokenMarked = Boolean(tokenError) || failure?.field === 'both';

  const dirty = cleanPixelId(pixelId) !== start.pixelId || cleanToken(token) !== start.token;
  // Both boxes, both right
  const canSave = dirty && !idEmpty && !idProblem && !sameId && !tokenEmpty && !tokProblem;

  // The footer's one line: what's stopping Save
  let hint = null;
  if (idEmpty && tokenEmpty) hint = 'Add your Pixel ID and access token to save.';
  else if (idEmpty) hint = 'Add your Pixel ID to save.';
  else if (idProblem) hint = 'Fix your Pixel ID to save.';
  else if (sameId) hint = 'Enter your new Pixel ID to save.';
  else if (tokenEmpty) hint = 'Add your access token to save.';
  else if (tokProblem) hint = 'Fix your access token to save.';

  const couldntSave = () => {
    setFailure({ field: 'pixelId', message: 'We couldn’t save this. Try again.' });
    setView('form');
  };

  const save = async () => {
    setTouched({ pixelId: true, token: true });
    if (!canSave) return;
    setFailure(null);
    setView('checking');
    const result = await checkPixel({ pixelId, token });
    if (!alive.current) return;
    if (!result.ok) {
      setFailure(result);
      setView('form');
      setFocusNext(result.field === 'token' ? 'token' : 'pixelId');
      return;
    }
    if (!savePixel({ pixelId, token, pixelName: result.pixelName })) return couldntSave();
    setView('connected');
  };

  // ---------- Leaving ----------
  // Back (the form's Cancel): to Manage when there's a pixel, else closed
  const leaveForm = () => (record ? setView('manage') : onClose());
  const back = () => (dirty ? setAsking(() => leaveForm) : leaveForm());
  // ✕, Escape, a click outside
  const close = () => {
    if (view === 'checking') return; // a moment; it can't be left half-done
    if (view === 'form' && dirty) setAsking(() => onClose);
    else if (view === 'connected') onClose({ connected: true });
    else onClose();
  };

  // ---------- Header and footer for each view ----------
  const formTitle = {
    setup: 'Connect your Meta Pixel',
    token: 'Replace your access token',
    'change-id': 'Change your Pixel ID',
  }[mode];
  const title = view === 'manage' ? 'Your Meta Pixel' : formTitle;

  let footer;
  if (view === 'manage') {
    footer = (
      <>
        <button type="button" className="mp-remove" onClick={() => setRemoving(true)}>
          Remove pixel
        </button>
        <div className="mp-foot__buttons">
          <button type="button" className="oh__add" onClick={onClose}>
            Done
          </button>
        </div>
      </>
    );
  } else if (view === 'connected') {
    footer = (
      <div className="mp-foot__buttons">
        <button type="button" className="oh__add" onClick={() => onClose({ connected: true })}>
          Done
        </button>
      </div>
    );
  } else {
    const checking = view === 'checking';
    footer = (
      <>
        <p className="mp-foot__hint" aria-live="polite">
          {checking ? '' : hint}
        </p>
        <div className="mp-foot__buttons">
          <button type="button" className="oh__edit" onClick={back} disabled={checking}>
            {record ? 'Back' : 'Cancel'}
          </button>
          <button
            type="button"
            className="oh__add mp-foot__save"
            onClick={save}
            disabled={checking || !canSave}
            aria-busy={checking || undefined}
          >
            {checking ? (
              <>
                <span className="mp-spinner mp-spinner--small" aria-hidden="true" /> Checking…
              </>
            ) : (
              'Save and check'
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Drawer
        className="mp-drawer"
        title={title}
        sub="Used for all your webinars, including new ones."
        onClose={close}
        footer={footer}
      >
        {view === 'manage' && record && (
          <Manage
            record={record}
            status={status}
            onChangeId={() => openForm('change-id')}
            onToken={() => openForm('token')}
          />
        )}

        {view === 'checking' && <Checking />}

        {view === 'connected' && (() => {
          // Its name in Meta, as the coach will see it in Ads Manager and Events Manager
          const pixelName = record?.pixelName || 'your pixel';
          return (
          <Result ref={resultRef} tone="ok" title="Your Meta Pixel is connected">
            {/* Its name in Meta, so they can tell it's the pixel they meant */}
            <p className="mp-result__pixel">
              <span className="mp-result__name">{record?.pixelName || 'Your pixel'}</span>
              <span className="mp-result__id">Pixel ID {record?.pixelId}</span>
            </p>

            {/* So Done doesn't end on a question: is there more to do, and does it work? */}
            <div className="mp-next">
              <h4 className="mp-next__title">What happens next</h4>
              <ol className="mp-next__steps">
                <li>
                  <strong>Nothing more to do here.</strong> All your webinars now send visits, sign-ups and payments to
                  Meta.
                </li>
                <li>
                  <strong>In Meta Ads Manager, in your ad set,</strong> pick the pixel <strong>{pixelName}</strong> (Meta
                  may call it a dataset) and this event:
                  {/* Each ad is for one webinar, so it's asked the way the coach meets it: is this one free or paid? */}
                  <dl className="mp-next__events">
                    <div>
                      <dt>If the webinar is free</dt>
                      <dd>Complete registration</dd>
                    </div>
                    <div>
                      <dt>If the webinar is paid</dt>
                      <dd>Purchase</dd>
                    </div>
                  </dl>
                </li>
                <li>
                  <strong>To check it’s working,</strong> wait for your next sign-up, then look in either place:
                  {/* Two products, so each place is named: ours, then Meta's */}
                  <ul className="mp-next__places">
                    <li>
                      <strong>On your Webinars page:</strong> click Manage next to Meta Pixel. It shows when the last
                      sign-up was sent to Meta.
                    </li>
                    <li>
                      <strong>In Meta Events Manager:</strong> open <strong>{pixelName}</strong>. The sign-up appears in
                      its list of events received.
                    </li>
                  </ul>
                </li>
              </ol>
            </div>
          </Result>
          );
        })()}

        {/* Kept mounted while checking (hidden), so what they typed stays put */}
        {(view === 'form' || view === 'checking') && (
          <div className="mp-form" hidden={view !== 'form'}>
            {/* The video's for setting up from nothing; the steps' own help covers the rest */}
            {mode === 'setup' && <VideoCard video={PIXEL_VIDEOS.overview} />}

            {mode === 'token' && status === 'broken' && (
              <p className="mp-alert mp-alert--quiet">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  Your old access token stopped working on {dayLabel(record.brokenAt)}. Create a new one from your
                  pixel’s Settings and paste it below.
                </span>
              </p>
            )}

            <ol className="mp-steps">
              <Step
                n={1}
                title="Pixel ID"
                desc={
                  mode === 'token'
                    ? 'The pixel this access token is for.'
                    : 'A 15 or 16 digit number from Meta Events Manager.'
                }
                helpLabel="Where do I find this?"
                helpSteps={PIXEL_ID_STEPS}
                video={PIXEL_VIDEOS.pixelId}
                error={idError}
                input={(props) =>
                  mode === 'token' ? (
                    // Fixed here: the token is what's being added. Change starts over with a new ID.
                    <div className="mp-secret">
                      <input
                        {...props}
                        ref={pixelRef}
                        className="mp-input mp-input--fixed mp-secret__input"
                        type="text"
                        readOnly
                        value={pixelId}
                      />
                      <button type="button" className="mp-secret__toggle" onClick={() => openForm('change-id')}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <input
                      {...props}
                      ref={pixelRef}
                      className={`mp-input ${idError ? 'mp-input--error' : ''}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="e.g. 1234567890123456"
                      value={pixelId}
                      onChange={(e) => {
                        setPixelId(cleanPixelId(e.target.value));
                        if (failure?.field === 'pixelId' || failure?.field === 'both') setFailure(null);
                      }}
                      onPaste={() => setTouched((t) => ({ ...t, pixelId: true }))}
                      onBlur={() => setTouched((t) => ({ ...t, pixelId: true }))}
                      onKeyDown={(e) => e.key === 'Enter' && save()}
                    />
                  )
                }
              />

              <Step
                n={2}
                title="Access token"
                desc="Lets us send sign-ups to Meta from our side, so they’re counted even when a browser blocks tracking."
                note={
                  mode === 'change-id'
                    ? 'New pixel, new access token. Your old token only works with your old pixel, so add this pixel’s token here.'
                    : null
                }
                helpLabel="How do I create one?"
                helpSteps={TOKEN_STEPS}
                helpNote={TOKEN_ADMIN_NOTE}
                video={PIXEL_VIDEOS.token}
                error={tokenError}
                marked={tokenMarked}
                input={(props) => (
                  <div className="mp-secret">
                    <input
                      {...props}
                      ref={tokenRef}
                      className={`mp-input mp-secret__input ${tokenMarked ? 'mp-input--error' : ''}`}
                      type={showToken ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      data-1p-ignore=""
                      data-lpignore="true"
                      placeholder="Paste the code that starts with EAA"
                      value={token}
                      onChange={(e) => {
                        setToken(cleanToken(e.target.value));
                        if (failure?.field === 'token' || failure?.field === 'both') setFailure(null);
                      }}
                      onPaste={() => setTouched((t) => ({ ...t, token: true }))}
                      onBlur={() => setTouched((t) => ({ ...t, token: true }))}
                      onKeyDown={(e) => e.key === 'Enter' && save()}
                    />
                    <button
                      type="button"
                      className="mp-secret__toggle"
                      onClick={() => setShowToken((s) => !s)}
                      aria-pressed={showToken}
                      aria-label={showToken ? 'Hide access token' : 'Show access token'}
                    >
                      {showToken ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      {showToken ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}
              />
            </ol>

            {mode === 'setup' && <WhatMetaSees />}
          </div>
        )}
      </Drawer>

      {asking && (
        <ConfirmDialog
          title="Discard your changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const then = asking;
            setAsking(null);
            then();
          }}
        >
          <p>Your Pixel ID or access token hasn’t been saved.</p>
        </ConfirmDialog>
      )}

      {removing && (
        <ConfirmDialog
          title="Remove your Meta Pixel?"
          confirmLabel="Remove pixel"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            removePixel();
            onClose();
          }}
        >
          <p>Meta will stop seeing visits, sign-ups and payments from all your webinars, including ones coming up.</p>
          <p>Your pixel and what it’s collected stay in Meta. You can connect it again any time.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// ---------- Manage: what's connected ----------
// One row per thing, each with the one action it has. The token's row
// says whether it works, never what it is.
function Manage({ record, status, onChangeId, onToken }) {
  const broken = status === 'broken';

  // Last sign-up Meta got from us: since it was connected, up to when it
  // stopped working. Kept up to date as people sign up (here or elsewhere).
  const lastSent = () =>
    latestSignupAt({ after: record.connectedAt, before: broken ? record.brokenAt : Infinity });
  const [last, setLast] = useState(lastSent);
  useEffect(() => {
    setLast(lastSent());
    return onSignupsChange(() => setLast(lastSent()));
  }, [record.connectedAt, record.brokenAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mp-manage">
      {broken && (
        <div className="mp-alert" role="alert">
          <p className="mp-alert__title">
            <AlertTriangle size={17} aria-hidden="true" />
            Your Meta Pixel has stopped working
          </p>
          <p className="mp-alert__text">
            Your access token stopped working on {dayLabel(record.brokenAt)}, so Meta isn’t getting your sign-ups
            properly. This happens when the token is deleted, or your admin access to the pixel is removed.
          </p>
          <button type="button" className="oh__add mp-alert__fix" onClick={onToken}>
            Replace access token
          </button>
        </div>
      )}

      <dl className="mp-facts">
        <div className="mp-fact">
          <dt className="mp-fact__label">Pixel</dt>
          <dd className="mp-fact__value">
            <span className="mp-fact__main">{record.pixelName || 'Your pixel'}</span>
            <span className="mp-fact__sub">Pixel ID {record.pixelId}</span>
          </dd>
          <button type="button" className="mp-fact__action" onClick={onChangeId}>
            Change<span className="mp-sr-only"> Pixel ID</span>
          </button>
        </div>

        <div className="mp-fact">
          <dt className="mp-fact__label">Access token</dt>
          <dd className="mp-fact__value">
            {broken ? (
              <>
                <span className="mp-fact__main mp-fact__main--bad">
                  <AlertTriangle size={15} aria-hidden="true" /> Stopped working
                </span>
                <span className="mp-fact__sub">Since {dayLabel(record.brokenAt)}</span>
              </>
            ) : (
              <>
                <span className="mp-fact__main mp-fact__main--ok">
                  <Check size={15} strokeWidth={3} aria-hidden="true" /> Saved
                </span>
                <span className="mp-fact__sub">Hidden for your safety. Replace it if you made a new one.</span>
              </>
            )}
          </dd>
          <button type="button" className="mp-fact__action" onClick={onToken}>
            Replace
            <span className="mp-sr-only"> access token</span>
          </button>
        </div>

        <div className="mp-fact">
          <dt className="mp-fact__label">Last sign-up sent to Meta</dt>
          <dd className="mp-fact__value">
            {last ? (
              <span className="mp-fact__main">{whenLabel(last)}</span>
            ) : (
              <>
                <span className="mp-fact__main">None yet</span>
                <span className="mp-fact__sub">
                  {broken
                    ? 'No one signed up before it stopped working.'
                    : 'The next person who signs up for any webinar will show here.'}
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <WhatMetaSees />
    </div>
  );
}

// What gets sent, in everyday words, closed until they ask
function WhatMetaSees() {
  return (
    <details className="mp-sees">
      <summary className="mp-sees__toggle">
        What Meta will see
        <ChevronDown size={16} className="mp-chevron" aria-hidden="true" />
      </summary>
      <div className="mp-sees__body">
        <p>For every webinar you run, we tell Meta when:</p>
        <ul>
          {PIXEL_EVENTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>Meta uses this to show your ads to more people likely to sign up, and to tell you which ads worked.</p>
      </div>
    </details>
  );
}

// One numbered step: its title is the box's label, then the box, its
// problem (if any), and how-to steps closed until they ask
// marked: the box is part of a problem said elsewhere (a mismatch, said under the Pixel ID)
// note: a line above the box, for what changed (a new pixel needs a new token)
function Step({ n, title, tag, desc, note, helpLabel, helpSteps, helpNote, video, error, marked = Boolean(error), input }) {
  const id = useId();
  const descId = `${id}-desc`;
  const errorId = `${id}-error`;
  return (
    <li className="mp-step">
      <span className="mp-step__num" aria-hidden="true">
        {n}
      </span>
      <div className="mp-step__body">
        <div className="mp-step__head">
          <label className="mp-step__title" htmlFor={id}>
            <span className="mp-sr-only">Step {n}: </span>
            {title}
          </label>
          {tag && <span className="mp-step__tag">{tag}</span>}
        </div>
        <p className="mp-step__desc" id={descId}>
          {desc}
        </p>

        {note && (
          <p className="mp-step__note">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{note}</span>
          </p>
        )}

        <div className="mp-step__field">
          {input({
            id,
            'aria-invalid': marked ? true : undefined,
            'aria-describedby': error ? `${descId} ${errorId}` : descId,
          })}
        </div>
        {error && (
          <p className="mp-step__error" id={errorId} role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="mp-step__help-row">
          <details className="mp-help">
            <summary className="mp-help__toggle">
              {helpLabel}
              <ChevronDown size={16} className="mp-chevron" aria-hidden="true" />
            </summary>
            <ol className="mp-help__steps">
              {helpSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {helpNote && <p className="mp-help__note">{helpNote}</p>}
          </details>
          {video?.url && (
            <a className="mp-step__video" href={video.url} target="_blank" rel="noopener">
              <Play size={13} aria-hidden="true" /> Watch this step{video.length ? ` (${video.length})` : ''}
              <span className="mp-sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

// The setup video, or a "coming soon" card until its link is added
function VideoCard({ video }) {
  const poster = (
    <span className="mp-video__poster">
      <span className="mp-video__play" aria-hidden="true">
        <Play size={22} fill="currentColor" />
      </span>
      {!video.url && <span className="mp-video__soon">Video coming soon</span>}
    </span>
  );
  const caption = (
    <span className="mp-video__caption">
      <span className="mp-video__title">{video.title}</span>
      <span className="mp-video__length">{video.length}</span>
    </span>
  );
  if (!video.url) {
    return (
      <div className="mp-video mp-video--soon">
        {poster}
        {caption}
      </div>
    );
  }
  return (
    <a className="mp-video" href={video.url} target="_blank" rel="noopener">
      {poster}
      {caption}
      <span className="mp-sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// "Checking with Meta": a ring, and what's being checked (only ever with a token)
function Checking() {
  return (
    <div className="mp-checking" role="status">
      <span className="mp-spinner" aria-hidden="true" />
      <p className="mp-checking__title">Checking with Meta</p>
      <p className="mp-checking__sub">Finding your pixel and testing your access token. This takes a few seconds.</p>
    </div>
  );
}

// After saving: a mark, a heading (focused, so it's read out) and what it means
const Result = forwardRef(function Result({ tone, title, children }, ref) {
  return (
    <div className={`mp-result mp-result--${tone}`}>
      <span className="mp-result__mark" aria-hidden="true">
        <Check size={26} strokeWidth={3} />
      </span>
      <h3 className="mp-result__title" ref={ref} tabIndex={-1}>
        {title}
      </h3>
      <div className="mp-result__text">{children}</div>
    </div>
  );
});