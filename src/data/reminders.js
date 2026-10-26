import { meetingHref, webinarEnd, webinarStart, webinarWhen } from './webinar';

// ------------------------------------------------------------
// A webinar's reminder emails: the five of them, when each goes out,
// who it has gone to, and the email itself.
//
// Each email starts from a template we wrote (below), with the
// webinar's details filled in when it's sent, like a mail-merge. The
// coach can change any of it in the email editor (ReminderEditor.jsx).
// Nothing is written by AI.
//
// Saved on the webinar record as `reminders` (App.jsx):
//   { [id]: { on: true | false, subject?: string, body?: string } }
//   subject/body only once the coach has edited the email; without
//   them the template is used. Run again copies the whole thing.
//
// The body is simple HTML (p, b, i, a, ul, ol, li, br) with fill-in
// fields kept as markers, e.g. {{first_name}}. The sending system
// swaps in each person's values. FIELDS lists them.
//
// In this prototype nothing is emailed: "Sent to 9" is worked out from
// the real registrations and times, to show what would have gone out.
// ------------------------------------------------------------

// The fill-in fields the editor's "Insert detail" menu offers
//   hint: what it fills in with, for the hover hint in the editor
export const FIELDS = [
  { key: 'first_name', label: 'First name', hint: 'Fills in each person’s first name' },
  { key: 'webinar_title', label: 'Webinar title', hint: 'Fills in the webinar’s title' },
  { key: 'date', label: 'Date', hint: 'Fills in the webinar’s date' },
  { key: 'time', label: 'Time', hint: 'Fills in the webinar’s time' },
  { key: 'join_link', label: 'Join link', hint: 'Fills in each person’s own join link' },
  { key: 'your_name', label: 'Your name', hint: 'Fills in your name' },
];

export const fieldHint = (key) => FIELDS.find((f) => f.key === key)?.hint ?? '';

export const fieldLabel = (key) => FIELDS.find((f) => f.key === key)?.label ?? key;

const HOUR = 60 * 60_000;

// The five reminders, in the order they go out.
//   name:   what the list and the editor call it; reads on its own
//   when:   short, for sentences
//   offset: when, from the start (or from the end, for 'after')
//   askOff: turning it off asks first (the confirmation has the join link)
//   join:   the email always has the Join webinar button
export const REMINDERS = [
  {
    id: 'registered',
    name: 'Confirmation email after registering',
    when: 'Right after they register',
    askOff: true,
    join: true,
    // Lean on purpose: the date and time are the one thing people come
    // back for, so they get one bold line (the title is already in the
    // subject and the footer). The reply ask helps later reminders land
    // in the main inbox, and gives the coach questions to answer live.
    subject: 'You’re in: {{webinar_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>You’re registered. See you on <b>{{date}} at {{time}}</b>, live on Zoom.</p>' +
      '<p>Keep this email. The button below is your link to join on the day.</p>' +
      '<p>One small thing: reply and tell me the one question you most want answered. I’ll try to cover it live.</p>' +
      '<p>See you there,<br>{{your_name}}</p>',
  },
  {
    id: 'day',
    name: 'Reminder email 1 day before webinar',
    when: '1 day before',
    offset: -24 * HOUR,
    join: true,
    subject: 'Tomorrow: {{webinar_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Just a reminder: we meet <b>tomorrow, {{date}} at {{time}}</b>.</p>' +
      '<p>Keep an hour free, and join from a quiet place. Bring a notebook, you’ll want to write things down.</p>' +
      '<p>See you tomorrow,<br>{{your_name}}</p>',
  },
  {
    id: 'hour',
    name: 'Reminder email 1 hour before webinar',
    when: '1 hour before',
    offset: -HOUR,
    join: true,
    subject: 'Starting in 1 hour: {{webinar_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>We start in 1 hour, at <b>{{time}}</b>.</p>' +
      '<p>Keep this email handy. The button below takes you straight in.</p>' +
      '<p>See you soon,<br>{{your_name}}</p>',
  },
  {
    id: 'five',
    name: 'Reminder email 5 mins before webinar',
    when: '5 minutes before',
    offset: -5 * 60_000,
    join: true,
    subject: 'We’re starting now: {{webinar_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>We’re about to begin. Click the button below to join now.</p>' +
      '<p>{{your_name}}</p>',
  },
  {
    id: 'after',
    name: 'Thank-you email after webinar',
    when: 'After it ends',
    offset: 0, // at the end
    fromEnd: true,
    join: false,
    subject: 'Thank you for joining: {{webinar_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Thank you for spending this time with me today. I hope you found something you can use in your home this week.</p>' +
      '<p>If you have a question, just reply to this email.</p>' +
      '<p>Warmly,<br>{{your_name}}</p>',
  },
];

export const reminderById = (id) => REMINDERS.find((r) => r.id === id) ?? null;

// The coach's saved choice for one reminder, with the template behind it
//   { on, subject, body, edited }
export function emailOf(webinar, id) {
  const r = reminderById(id);
  const saved = webinar.reminders?.[id] ?? {};
  const edited = typeof saved.subject === 'string' && typeof saved.body === 'string';
  return {
    on: saved.on !== false, // on unless they turned it off
    subject: edited ? saved.subject : r.subject,
    body: edited ? saved.body : r.body,
    edited,
  };
}

// The reminders after a change, ready to save on the webinar.
// Saving text that matches the template stores no text (not "edited").
export function withEmail(reminders = {}, id, { subject, body }) {
  const r = reminderById(id);
  const prev = reminders[id] ?? {};
  const same = subject === r.subject && body === r.body;
  const next = { ...prev };
  if (same) {
    delete next.subject;
    delete next.body;
  } else {
    next.subject = subject;
    next.body = body;
  }
  return { ...reminders, [id]: next };
}

export const withOn = (reminders = {}, id, on) => ({ ...reminders, [id]: { ...(reminders[id] ?? {}), on } });

// One email's status, from its timeline row, in two lengths that always
// agree: short for the Emails list's Status column ("38 sent",
// "Today, 1 pm"), full for its hover hint and the editor's status line.
//   { short, full, tone: 'next' | 'off' | null }
export function emailStatus(row, answers, now = Date.now()) {
  const people = (count) => `${count} ${count === 1 ? 'person' : 'people'}`;
  const ended = (webinarEnd(answers) ?? Infinity) <= now;
  const label = row.at === null ? null : whenLabel(row.at, answers, now);
  // In a sentence: "today at 1:00 pm", "Fri 23 Oct at 2:00 pm"
  const when = label?.replace(', ', ' at ').replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase());
  const short = label?.replace(':00 ', ' '); // "Today, 1 pm"

  if (row.at === null) {
    // The confirmation: goes out as each person registers
    if (!row.on) return { short: 'Off', full: 'Off: this email won’t be sent', tone: 'off' };
    const full = ended
      ? `Sent to ${people(row.sentTo)}`
      : row.sentTo
        ? `Goes to each person after they register. Sent to ${people(row.sentTo)} so far`
        : 'Goes to each person after they register';
    return { short: row.sentTo ? `${row.sentTo} sent` : 'None yet', full, tone: null };
  }
  if (row.skipped) return { short: 'Skipped', full: 'Skipped: the webinar was set up after this time', tone: 'off' };
  if (!row.past) {
    if (!row.on) return { short: 'Off', full: 'Off: this email won’t be sent', tone: 'off' };
    return { short, full: `Goes out ${when}`, tone: row.next ? 'next' : null };
  }
  if (!row.on) return { short: 'Not sent', full: `It was off, so it wasn’t sent ${when}`, tone: 'off' };
  return row.sentTo
    ? { short: `${row.sentTo} sent`, full: `Sent to ${people(row.sentTo)} · ${when}`, tone: null }
    : { short: '0 sent', full: `Went out ${when}, before anyone registered`, tone: null };
}

// When a reminder goes out (ms), or null for the one sent at registration
export function sendTime(answers, id) {
  const r = reminderById(id);
  if (!r || r.offset === undefined) return null;
  const base = r.fromEnd ? webinarEnd(answers) : webinarStart(answers);
  return base === null ? null : base + r.offset;
}

// Each reminder's status for the timeline:
//   { id, at (ms or null), past, sentTo (people), on, skipped, next }
//   sentTo: people who had registered by the time it went out (all of
//   them for the confirmation). A reminder turned off sends to no one.
//   skipped: its time had passed before the webinar was published (set
//   up 2 hours before, say: the 1-day reminder never had a chance).
export function timeline(webinar, people, now = Date.now()) {
  const live = Number.isFinite(webinar.publishedAt) ? webinar.publishedAt : null;
  const rows = REMINDERS.map((r) => {
    const { on } = emailOf(webinar, r.id);
    const at = sendTime(webinar.answers, r.id);
    if (at === null) return { id: r.id, at, past: true, on, skipped: false, sentTo: on ? people.length : 0 };
    const past = at <= now;
    const skipped = live !== null && at < live;
    const sentTo = past && on && !skipped ? people.filter((p) => p.registeredAt <= at).length : 0;
    return { id: r.id, at, past, on, skipped, sentTo };
  });
  const next = rows.find((row) => !row.past && row.on);
  return rows.map((row) => ({ ...row, next: row === next }));
}

// The values that fill in the fields, for one person.
// person: { name } or null (a sample, for the preview)
export function fieldValues(webinar, person, hostName) {
  const when = webinarWhen(webinar.answers);
  const { origin, pathname } = window.location;
  return {
    first_name: String(person?.name ?? 'Priya').trim().split(/\s+/)[0] || 'there',
    webinar_title: String(webinar.answers.headline ?? 'Your webinar').trim(),
    date: when ? `${when.weekday} ${when.day} ${when.month}` : 'the day',
    time: when ? when.line.split(', ').slice(1).join(', ') : '', // "7:00 pm IST"
    join_link: `${origin}${pathname}${meetingHref(webinar.id)}`,
    your_name: String(hostName ?? '').trim() || 'Your host',
  };
}

// Swaps the markers for values. html: true escapes them for the body.
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function fillIn(text, values, { html = false } = {}) {
  return String(text ?? '').replace(/\{\{(\w+)\}\}/g, (all, key) =>
    key in values ? (html ? escape(values[key]) : values[key]) : all,
  );
}

// ---------- Times, in words ----------

// The webinar's clock (its own time zone), from its date and time
function zoneShift(answers) {
  const start = webinarStart(answers);
  const asIfUtc = Date.parse(`${answers.date}T${answers.time ?? '19:00'}:00Z`);
  return start === null ? 0 : asIfUtc - start;
}

// "4 hr 32 min", "1 hr", "32 min", "less than a minute"
export function inWords(mins) {
  if (mins < 1) return 'less than a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 48) return `${Math.round(h / 24)} days`;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// "Today, 3:00 pm", "Yesterday, 4:00 pm", "Fri 23 Oct, 4:00 pm", on the webinar's clock
export function whenLabel(ms, answers, now = Date.now()) {
  const shift = zoneShift(answers);
  const d = new Date(ms + shift);
  const h = d.getUTCHours();
  const clock = `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  const dayOf = (x) => Math.floor((x + shift) / 86_400_000);
  const diff = dayOf(ms) - dayOf(now);
  if (diff === 0) return `Today, ${clock}`;
  if (diff === -1) return `Yesterday, ${clock}`;
  if (diff === 1) return `Tomorrow, ${clock}`;
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${date.replace(',', '')}, ${clock}`;
}

// "1:52 pm" now, on the webinar's clock
export function clockNow(answers, now = Date.now()) {
  return whenLabel(now, answers, now).replace(/^Today, /, '');
}