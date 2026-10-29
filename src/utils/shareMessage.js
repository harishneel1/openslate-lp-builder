import { lengthLabel, webinarPrice, webinarWhen } from '../data/webinar';

// ------------------------------------------------------------
// The message Share webinar puts in WhatsApp: what it is, when, and the
// link. Kept short, and written about the webinar rather than as the
// coach ("Join my…"), so it still reads right when a student forwards it
// to a friend.
//
//   🎥 Fix the Vasthu mistakes that block money in your home
//   A webinar for families who want money to stay and calm at home…
//
//   📅 Mon 9 Nov, 7:00 pm IST
//   ⏱ 60 min · Live on Zoom · English
//   💰 Free
//
//   Save your seat 👇
//   http://localhost:5173/fix-the-vasthu-mistakes
//
// Lines with nothing to say are left out (no subheadline, no date yet…).
// With no session coming up (upcoming: false), it's just what the webinar
// is and the link: no date, no price, no "Save your seat".
// webinar: the session the link opens now (its date goes in the message)
// title: its name (funnelName); link: the one link for every session (liveHref)
// ------------------------------------------------------------
export function webinarShareMessage(webinar, title, link, { upcoming = true } = {}) {
  const answers = webinar.answers ?? {};
  const subheadline = String(answers.subheadline ?? '').trim();
  const when = webinarWhen(answers);
  const format = answers.format === 'Pre-recorded' ? 'Pre-recorded' : 'Live on Zoom';
  const details = [lengthLabel(answers), format, String(answers.language ?? '').trim()].filter(Boolean).join(' · ');
  const price = webinarPrice(answers);
  const priceLine = price.was ? `${price.label} (was ${price.was})` : price.label;

  if (!upcoming) {
    return [[`🎥 ${title}`, subheadline], ['Find out more 👇', link]]
      .map((lines) => lines.filter(Boolean).join('\n'))
      .join('\n\n');
  }

  const blocks = [
    [`🎥 ${title}`, subheadline],
    [when && `📅 ${when.line}`, details && `⏱ ${details}`, `💰 ${priceLine}`],
    ['Save your seat 👇', link],
  ];
  return blocks
    .map((lines) => lines.filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}