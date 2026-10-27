import { useState } from 'react';
import { useFlash } from './PixelStatus';
import { AlertTriangle } from 'lucide-react';
import MetaPixelDrawer, { usePixel } from './MetaPixelDrawer';
import { dayLabel, pixelStatus } from '../data/metaPixel';
import './MetaPixelRow.css';

// ------------------------------------------------------------
// "Meta Pixel": a settings row at the top of the Webinars list, laid out
// like Google Calendar on 1:1 calls (.oh__row: label, value, actions).
// It's for every webinar, so it sits above them. Not set up isn't an
// alert (many coaches don't run ads), so the row stays plain then.
//
//   none       Meta Pixel   Not set up                              [Set up]
//                           Running Facebook or Instagram ads? …
//   connected  Meta Pixel   Harish Neel’s Pixel  ● Connected        [Manage]
//                           Pixel ID 1234567890123456
//   broken     Meta Pixel   ⚠ Your Meta Pixel has stopped working      [Fix]
//   (red)                   Your access token stopped working on 27 Oct. …
//
// Every button opens the same panel (MetaPixelDrawer): the setup form when
// there's nothing yet, Manage otherwise (Fix: with the problem on top, and
// Replace access token). Just connected: the row glows green for a moment,
// so the coach sees where the status lives.
// ------------------------------------------------------------
export default function MetaPixelRow() {
  const record = usePixel();
  const status = pixelStatus(record);
  const [open, setOpen] = useState(false);
  const [flash, flashNow] = useFlash();

  return (
    <>
      <div className={`oh__row mp-row ${status === 'broken' ? 'mp-row--broken' : ''} ${flash ? 'mp-row--flash' : ''}`}>
        <span className="oh__row-label">Meta Pixel</span>

        {status === 'connected' && (
          <div className="oh__row-value">
            <p className="mp-row__connected">
              <span className="mp-row__name">{record.pixelName || 'Your pixel'}</span>
              <span className="mp-row__status">Connected</span>
            </p>
            <p className="mp-row__sub mp-row__id">Pixel ID {record.pixelId}</p>
          </div>
        )}

        {status === 'broken' && (
          <div className="oh__row-value">
            <p className="mp-row__title mp-row__title--broken">
              <AlertTriangle size={16} aria-hidden="true" />
              Your Meta Pixel has stopped working
            </p>
            <p className="mp-row__sub">
              Your access token stopped working on {dayLabel(record.brokenAt)}. Replace it to send sign-ups to Meta
              again.
            </p>
          </div>
        )}

        {status === 'none' && (
          <div className="oh__row-value">
            <p className="mp-row__title">Not set up</p>
            <p className="mp-row__sub">Running Facebook or Instagram ads? Connect your pixel so Meta can see who signs up.</p>
          </div>
        )}

        <div className="oh__row-actions">
          <button type="button" className="oh__btn" onClick={() => setOpen(true)}>
            {{ connected: 'Manage', broken: 'Fix', none: 'Set up' }[status]}
          </button>
        </div>
      </div>

      {open && (
        <MetaPixelDrawer
          onClose={(result) => {
            setOpen(false);
            if (result?.connected) flashNow();
          }}
        />
      )}
    </>
  );
}