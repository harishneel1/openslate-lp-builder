import { CheckCircle2, Clock, HelpCircle, Info } from 'lucide-react';
import './ConfirmStatus.css';

// ------------------------------------------------------------
// Whether a student said they're coming, from the 2-hour WhatsApp message
// (whatsappConfirm.js). Two shapes:
//
// ConfirmChip: a small tag, beside the other chips on a booking's row (a
// call's page, the Bookings page) and on the next-call card:
//   [✓ Confirmed on WhatsApp]  green: they tapped "Yes, I'll be there"
//   [◷ Waiting for WhatsApp reply]  grey: asked, no answer yet. Calm, since most
//                  answer close to the call, or not at all
//   [? No reply on WhatsApp]   amber: the call started and they never answered. The
//                  booking is still on: worth a look, not an alarm
// Each says more on hover (the app's tooltip, data-tip).
//
// ConfirmLine: one line in the booking's side panel (BookingDrawer.jsx),
// beside the calendar invite's reply, in the same style.
//
// confirm: booking.confirm (describeBooking), or null: nothing shows. Only
//   ever set while the call's 2-hour WhatsApp message is switched on
//   (confirmOf, whatsappConfirm.js).
// name: the student's first name
// ------------------------------------------------------------

const CHIP = {
  confirmed: {
    icon: CheckCircle2,
    label: 'Confirmed on WhatsApp',
    tip: (name) => `${name} tapped “Yes, I’ll be there” on WhatsApp.`,
  },
  waiting: {
    icon: Clock,
    label: 'Waiting for WhatsApp reply',
    tip: (name) => `We asked ${name} on WhatsApp to confirm. The booking is on either way.`,
  },
  none: {
    icon: HelpCircle,
    label: 'No reply on WhatsApp',
    tip: (name) => `${name} didn’t confirm on WhatsApp. The booking is still on.`,
  },
};

export function ConfirmChip({ confirm, name, className = '' }) {
  const chip = confirm ? CHIP[confirm.status] : null;
  if (!chip) return null;
  const Icon = chip.icon;
  return (
    <span
      className={`bk-call__chip cf-chip cf-chip--${confirm.status} ${className}`}
      // Its rows and cards are buttons, so the chip isn't focusable itself:
      // its words read as part of the button's
      data-tip={chip.tip(name)}
      data-tip-align="end"
    >
      <Icon size={13} aria-hidden="true" /> {chip.label}
    </span>
  );
}

// asked: when the message went, in words ('2:00 pm')
// whatsapp: a chat link with a message ready, for a student who didn't answer
export function ConfirmLine({ confirm, name, asked, whatsapp }) {
  if (!confirm) return null;

  if (confirm.status === 'none') {
    return (
      <div className="bkd-invite cf-line cf-line--none" role="status">
        <HelpCircle size={16} aria-hidden="true" />
        <div>
          <p className="bkd-invite__text">{name} didn’t confirm on WhatsApp</p>
          <p className="bkd-invite__more">The booking is still on. Check with {name} that they’re coming.</p>
          {whatsapp && (
            <a className="bkd-invite__action" href={whatsapp} target="_blank" rel="noreferrer">
              Message on WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  const confirmed = confirm.status === 'confirmed';
  const Icon = confirmed ? CheckCircle2 : Clock;
  const tip = `We asked at ${asked}, 2 hours before the call. The booking is on either way.`;
  return (
    <p className={`bkd-invite cf-line cf-line--${confirm.status}`}>
      <Icon size={16} aria-hidden="true" />
      <span className="bkd-invite__text">
        {confirmed ? `${name} confirmed on WhatsApp` : `Waiting for ${name} to confirm on WhatsApp`}
      </span>
      {!confirmed && (
        <span className="bkd-invite__info" tabIndex={0} role="img" aria-label={tip} data-tip={tip} data-tip-align="end">
          <Info size={15} aria-hidden="true" />
        </span>
      )}
    </p>
  );
}