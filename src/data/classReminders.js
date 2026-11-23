import { classDay, classMeetingHref, classTime, nextClasses, saveBatch, scheduleLine } from './batches';
import { zoneAbbr } from './callReminders';

// ------------------------------------------------------------
// A live class's emails, for its Reminders tab (ClassEmails.jsx). The
// same idea as a 1:1 call's (callReminders.js), with a webinar's timings,
// since a class is a group session too:
//
//   Welcome           when someone buys one of the class's linked contracts.
//                     Always on (it's how they learn when the class is and
//                     how to join); its words can be changed.
//   24 hours before   each class. On to start with.
//   1 hour before     each class, with Join class
//   5 minutes before  each class, with Join class
//   Class cancelled   sent from the cancel page when the coach cancels one
//                     (BatchAnnounce.jsx, batchNotices.js). Listed so the
//                     coach sees it; its words are changed there, each time.
//
// Saved on the class itself, in two keys so a switch and the words never
// overwrite each other (as a 1:1 call's are):
//   reminders:      { dayBefore, hourBefore, fiveBefore: true | false }
//                   A missing key means its default (above).
//   reminderEmails: { hourBefore: { subject, body } }
//                   Only the emails the coach has changed; the rest use
//                   our template.
//
// The Join class button isn't in the body, so it can't be deleted.
// Breaks and cancelled classes send no reminders. In this prototype
// nothing is emailed; in the real product a job on the server sends each
// one at its time, to every student (classStudents.js).
//
// remindersOf(batch) → { dayBefore, hourBefore, fiveBefore }
// saveReminderOn(batch, id, on), saveEmailText(batch, id, { subject, body }) → true if saved
// emailTextOf(batch, id) → { subject, body, edited }
// classEmailValues(batch, { name }, now) → the fill-ins, for the preview
// ------------------------------------------------------------

export const CLASS_REMINDERS = [
  {
    id: 'dayBefore',
    name: '24 hours before',
    offsetMins: 24 * 60,
    subject: 'Tomorrow: {{class_title}} at {{time}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>A reminder that <b>{{class_title}}</b> with {{your_name}} is tomorrow, <b>{{date}} at {{time}}</b>.</p>' +
      '<p>Join with the button below when it’s time.</p>' +
      '<p>See you there,<br>{{your_name}}</p>',
  },
  {
    id: 'hourBefore',
    name: '1 hour before',
    offsetMins: 60,
    subject: 'Starting in 1 hour: {{class_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p><b>{{class_title}}</b> starts in 1 hour, at <b>{{time}}</b>.</p>' +
      '<p>Join with the button below.</p>' +
      '<p>See you there,<br>{{your_name}}</p>',
  },
  {
    id: 'fiveBefore',
    name: '5 minutes before',
    offsetMins: 5,
    subject: 'Starting in 5 minutes: {{class_title}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p><b>{{class_title}}</b> starts in 5 minutes. Tap below to join.</p>' +
      '<p>{{your_name}}</p>',
  },
];

// The welcome email: always on, so it has no switch
export const CLASS_WELCOME = {
  id: 'welcome',
  name: 'Welcome after joining',
  goes: 'Goes out as soon as someone buys one of this class’s contracts. It’s always on.',
  editNote: 'New students get the new words. Students already in got theirs.',
  subject: 'You’re in: {{class_title}}',
  body:
    '<p>Hi {{first_name}},</p>' +
    '<p>Welcome to <b>{{class_title}}</b> with {{your_name}}!</p>' +
    '<p>Your next class is on <b>{{date}} at {{time}}</b>. Join with the button below when it’s time. We’ll remind you before each class.</p>' +
    '<p>See you there,<br>{{your_name}}</p>',
};

export const classReminderById = (id) =>
  id === CLASS_WELCOME.id ? CLASS_WELCOME : (CLASS_REMINDERS.find((r) => r.id === id) ?? null);

// The line under the editor's title
export const goesLine = (r) => r.goes ?? `Goes out ${r.name} each class.`;

// What + Insert detail offers
export const CLASS_FIELDS = [
  { key: 'first_name', label: 'First name', hint: 'Fills in each student’s first name' },
  { key: 'class_title', label: 'Class name', hint: 'Fills in this class’s name' },
  { key: 'date', label: 'Date', hint: 'Fills in the class’s date, e.g. Thu 5 Nov' },
  { key: 'time', label: 'Time', hint: 'Fills in the class’s time, e.g. 6:30 am IST' },
  { key: 'your_name', label: 'Coach name', hint: 'Fills in your name as the coach' },
];

export const JOIN_LABEL = 'Join class';

// ---------- Switches ----------

// On unless switched off
const defaultOn = () => true;

export function remindersOf(batch) {
  const saved = batch?.reminders ?? {};
  return Object.fromEntries(CLASS_REMINDERS.map((r) => [r.id, typeof saved[r.id] === 'boolean' ? saved[r.id] : defaultOn(batch, r.id)]));
}

export const saveReminderOn = (batch, id, on) => saveBatch({ ...batch, reminders: { ...remindersOf(batch), [id]: on } });

// ---------- Words ----------

export function emailTextOf(batch, id) {
  const r = classReminderById(id);
  const saved = batch?.reminderEmails?.[id];
  const edited = typeof saved?.subject === 'string' && typeof saved?.body === 'string';
  return { subject: edited ? saved.subject : r.subject, body: edited ? saved.body : r.body, edited };
}

// Words that match the template store nothing (it's not "edited")
export function saveEmailText(batch, id, { subject, body }) {
  const r = classReminderById(id);
  const next = { ...(batch.reminderEmails ?? {}) };
  if (subject === r.subject && body === r.body) delete next[id];
  else next[id] = { subject, body };
  return saveBatch({ ...batch, reminderEmails: next });
}

// ---------- Filled in ----------

// The fill-ins for one student, for the class's next class (the preview
// uses a sample student)
export function classEmailValues(batch, student, hostName, now = Date.now()) {
  const next = nextClasses(batch, now, 1)[0] ?? null;
  const host = String(hostName ?? '').trim() || 'Your coach';
  return {
    first_name: String(student?.name ?? '').trim().split(/\s+/)[0] || 'there',
    class_title: batch.title,
    date: next ? classDay(next.date, null) : 'a date I’ll share soon',
    time: next ? `${classTime(next, batch)} ${zoneAbbr(next.start, batch.timeZone)}`.trim() : '',
    // Emails written before classes were scheduled one by one may still use it
    schedule: scheduleLine(batch, now),
    your_name: host,
    join_link: `${window.location.origin}${classMeetingHref(batch.id)}`,
  };
}

export const classFooterOf = (values) => `You’re getting this because you joined ${values.class_title} with ${values.your_name}.`;

export const SAMPLE_STUDENT = { name: 'Priya Sharma', email: 'priya@example.com' };
