import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Megaphone } from 'lucide-react';
import MetaPixelDrawer, { usePixel } from './MetaPixelDrawer';
import { pixelStatus } from '../data/metaPixel';
import './PixelStatus.css';

// ------------------------------------------------------------
// The Meta Pixel's status in a few words, with the one thing to do next.
// Every button opens the same panel (MetaPixelDrawer) and the same pixel
// as the row on the Webinars list: there's one for the whole account, so
// connecting it here connects it everywhere.
//
// variant 'line': under Share webinar and Copy link on a webinar's page
// (WebinarDetails). One quiet line; it never competes with Share.
//
//   none       📣 Running Meta ads?  Connect your Meta Pixel
//   connected  ● Meta Pixel connected  Manage
//   broken     ⚠ Meta Pixel stopped working.  Fix it                (red)
//
// variant 'strip': along the bottom of "Your webinar link" on the
// overview (FunnelOverview), right after they get their link, which
// already says to put it in Meta ads.
//
//   ─────────────────────────────────────────────────────────────────
//   📣 Running Meta ads? Connect your Meta Pixel so Meta     [Set up]
//      can see who signs up.
//
// Just connected from here: it glows green for a moment (useFlash), so
// the coach sees where the status lives after the panel closes.
// ------------------------------------------------------------

const FLASH_MS = 2400;

// [flash, flashNow]: flash is true for a moment after flashNow()
export function useFlash() {
  const [flash, setFlash] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flashNow = () => {
    clearTimeout(timer.current);
    setFlash(false);
    // Next frame, so a second flash restarts the animation
    requestAnimationFrame(() => {
      setFlash(true);
      timer.current = setTimeout(() => setFlash(false), FLASH_MS);
    });
  };
  return [flash, flashNow];
}
export default function PixelStatus({ variant = 'line' }) {
  const record = usePixel();
  const status = pixelStatus(record);
  const [open, setOpen] = useState(false);
  const [flash, flashNow] = useFlash();

  const panel = open && (
    <MetaPixelDrawer
      onClose={(result) => {
        setOpen(false);
        if (result?.connected) flashNow();
      }}
    />
  );

  if (variant === 'strip') {
    const copy = {
      none: {
        text: 'Running Meta ads? Connect your Meta Pixel so Meta can see who signs up.',
        button: 'Set up',
      },
      connected: {
        text: `Meta Pixel connected${record?.pixelName ? `: ${record.pixelName}` : ''}. Sign-ups from this link go to Meta.`,
        button: 'Manage',
      },
      broken: {
        text: 'Your Meta Pixel has stopped working. Replace your access token to fix it.',
        button: 'Fix',
      },
    }[status];
    return (
      <div className={`px-strip px-strip--${status} ${flash ? 'px-flash' : ''}`}>
        <p className="px-strip__text">
          <StatusMark status={status} />
          <span>{copy.text}</span>
        </p>
        <button type="button" className="px-strip__btn" onClick={() => setOpen(true)}>
          {copy.button}
        </button>
        {panel}
      </div>
    );
  }

  const line = {
    none: { text: 'Running Meta ads?', button: 'Connect your Meta Pixel' },
    connected: { text: 'Meta Pixel connected', button: 'Manage' },
    broken: { text: 'Meta Pixel stopped working.', button: 'Fix it' },
  }[status];
  return (
    <div className={`px-line px-line--${status} ${flash ? 'px-flash px-line--flash' : ''}`}>
      <StatusMark status={status} />
      <span className="px-line__text">{line.text}</span>
      <button
        type="button"
        className="px-line__btn"
        onClick={() => setOpen(true)}
        aria-label={
          status === 'connected' ? 'Manage your Meta Pixel' : status === 'broken' ? 'Fix your Meta Pixel' : undefined
        }
      >
        {line.button}
      </button>
      {panel}
    </div>
  );
}

// A megaphone (ads) when it isn't set up, ⚠ when it's stopped working, a
// green dot when it's connected. Never colour alone: the words say it too.
function StatusMark({ status }) {
  if (status === 'connected') return <span className="px-dot" aria-hidden="true" />;
  if (status === 'broken') return <AlertTriangle size={15} className="px-mark px-mark--broken" aria-hidden="true" />;
  return <Megaphone size={15} className="px-mark" aria-hidden="true" />;
}