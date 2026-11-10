// ------------------------------------------------------------
// The WhatsApp reminders: our default messages, and which are switched
// on for each webinar and 1:1 call.
//
// Fewer than the emails, on purpose. Each WhatsApp message costs money
// and lands among someone's personal chats, so WhatsApp gets only the
// ones that get people to turn up:
//
//   1:1 calls   confirmation, 24 hours before, 2 hours before (asks them
//               to confirm they're coming), 5 minutes before
//   Webinars    confirmation, 24 hours before, 1 hour before, 5 minutes before
//   Batches     a class cancelled (Live classes: sent once, when the
//               coach cancels it, BatchAnnounce.jsx; no switches)
//
// The emails go out as well, whatever happens here. A WhatsApp message
// adds to its email; it never replaces it.
//
// Meta reviews every message before a business can send it, on that
// business's own number, and only allows fixed wording with blanks to
// fill in (the {first_name}s below) and up to a few buttons. Reminders
// like these are what Meta calls "utility" messages: about something
// the person booked, nothing to sell. The review statuses are kept with
// the connection (whatsappConnection.js), since they belong to the
// number, not to one webinar or call.
//
// Which messages are on is kept per webinar session and per call, like
// the emails' switches. All are on until switched off. The stand-in
// keeps them in this browser:
//   { 'call:<id>': { 'call-2h': false }, 'webinar:<id>': { ... } }
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-whatsapp-switches';
export const WHATSAPP_SWITCHES_EVENT = 'whatsapp-switches-changed';

// Each message: when it goes, what it says, and its buttons.
//   name     the row's name, like the emails' ("24 hours before")
//   template its template name, as Meta takes it: lowercase letters,
//            numbers and _ (the name in Settings → WhatsApp → Templates).
//            The coach's own templates for the same message start from
//            it: call_24h_reminder_1, call_24h_reminder_2 …
//   when     when it goes, in a sentence, under the preview's title
//   example  when it goes in the preview's example, finishing "This is
//            exactly what your student Priya gets on WhatsApp, …"
//   body     WhatsApp's own formatting: *bold*, new lines as \n. The
//            {blanks} are filled in for each person.
//   buttons  from BUTTONS below, in the order WhatsApp shows them. At
//            most two links, and three buttons in all: WhatsApp folds a
//            fourth behind "See all options".
//   sentAt   when it arrives, in the example (a call at 4:00 pm on
//            Thursday, a webinar at 7:00 pm on Thu 12 Nov, someone
//            registering at 10:12 am)
//   replaces the id of the message this one took over from, so its saved
//            switches carry on (RETIRED below)
//
// The 2-hour call message asks the student to confirm they're coming:
// "Yes, I'll be there" is a quick reply (their answer comes back to us),
// "Can't make it? Change it" opens their booking page to reschedule or
// cancel, and Join call opens the meeting link, so the link is to hand
// whenever they look. Three buttons: WhatsApp's most before it folds them
// behind "See all options". It took over from the 1-hour message.
// (Changing a message's buttons means Meta reviews it again.)
export const MESSAGES = {
  call: [
    {
      id: 'call-confirm',
      template: 'call_confirmation',
      name: 'Confirmation after booking',
      when: 'Goes out as soon as someone books.',
      example: 'right after she books a call for 4:00 pm on Thursday',
      body: 'Hi {first_name}, your *{call}* with {host} is booked for {date} at {time}.\n\nNeed to change it? Use the button below.',
      buttons: ['manage'],
      sentAt: '10:12 am',
    },
    {
      id: 'call-24h',
      template: 'call_24h_reminder',
      name: '24 hours before',
      when: 'Goes out 24 hours before the call.',
      example: '24 hours before her call at 4:00 pm on Thursday',
      body: 'Hi {first_name}, a reminder that your *{call}* with {host} is tomorrow at {time}.\n\nNeed to move it? Use the button below.',
      buttons: ['manage'],
      sentAt: '4:00 pm',
    },
    {
      id: 'call-2h',
      template: 'call_2h_reminder',
      name: '2 hours before',
      when: 'Goes out 2 hours before the call, and asks them to confirm they’re coming.',
      example: '2 hours before her call at 4:00 pm on Thursday',
      body: 'Hi {first_name}, your {call} with {host} starts in 2 hours, at {time}.\n\n{host} has kept this time just for you and we need your reply to go ahead.\n\nSo please tap Yes or No below.',
      buttons: ['yes', 'change', 'join'],
      sentAt: '2:00 pm',
      replaces: 'call-1h',
    },
    {
      id: 'call-5m',
      template: 'call_5min_reminder',
      name: '5 minutes before',
      when: 'Goes out 5 minutes before the call.',
      example: '5 minutes before her call at 4:00 pm on Thursday',
      body: 'Hi {first_name}, your *{call}* with {host} starts in 5 minutes. Tap below to join.',
      buttons: ['join'],
      sentAt: '3:55 pm',
    },
  ],
  webinar: [
    {
      id: 'webinar-confirm',
      template: 'webinar_confirmation',
      name: 'Confirmation after registering',
      when: 'Goes out as soon as someone registers.',
      example: 'right after she registers for your webinar on Thu 12 Nov',
      body: 'Hi {first_name}, you’re in! *{webinar}* is on {date} at {time}.\n\nWe’ll remind you here before it starts.',
      buttons: ['details'],
      sentAt: '10:12 am',
    },
    {
      id: 'webinar-24h',
      template: 'webinar_24h_reminder',
      name: '24 hours before',
      when: 'Goes out 24 hours before the webinar.',
      example: '24 hours before your webinar at 7:00 pm on Thu 12 Nov',
      body: 'Hi {first_name}, *{webinar}* is tomorrow at {time}. See you there!',
      buttons: ['details'],
      sentAt: '7:00 pm',
    },
    {
      id: 'webinar-1h',
      template: 'webinar_1h_reminder',
      name: '1 hour before',
      when: 'Goes out 1 hour before the webinar.',
      example: '1 hour before your webinar at 7:00 pm on Thu 12 Nov',
      body: 'Hi {first_name}, *{webinar}* starts in 1 hour, at {time}.\n\nTap below to join when it’s time.',
      buttons: ['join'],
      sentAt: '6:00 pm',
    },
    {
      id: 'webinar-now', // its id from when it was called "Starting now", so saved switches carry on
      template: 'webinar_5min_reminder',
      name: '5 minutes before',
      when: 'Goes out 5 minutes before the webinar.',
      example: '5 minutes before your webinar at 7:00 pm on Thu 12 Nov',
      body: 'Hi {first_name}, *{webinar}* starts in 5 minutes! Tap below to join.',
      buttons: ['join'],
      sentAt: '6:55 pm',
    },
  ],
  // Live classes: sent once, to everyone in the batch, when the coach
  // cancels a class. Fixed wording (Meta's rule), no buttons: members join
  // from their feed as usual. (Breaks send nothing: the coach tells
  // members in class.)
  batch: [
    {
      id: 'batch-cancel',
      template: 'class_cancelled',
      name: 'Class cancelled',
      when: 'Goes out when you cancel a class.',
      example: 'when you cancel a class',
      body: 'Hi {first_name}, there’s *no {batch} class on {date}*. {host} has had to cancel it.\n\nYour next class is on {next}.',
      buttons: [],
      sentAt: '9:12 am',
    },
  ]
};

// What each button says, and where it goes, in a few words (the
// preview's hover hint; tapping it there opens the real thing). Each
// student gets their own link: WhatsApp lets a fixed message's button end
// in one part that changes per person.
//   manage   the student's own booking page (ManageBookingPage.jsx), the
//            same as the 24-hour email's "Pick another time or cancel"
//   change   the same page, worded as the answer to "Will you be there?"
//   yes      a quick reply (type 'reply'): no link. Tapping it sends its
//            words back to the coach's number, which is how we hear the
//            student is coming.
//   join     a call: the coach's meeting link. A webinar: its room.
//   details  a webinar's thank-you page, with the date, time and how to join
// Labels are at most 25 characters (WhatsApp's limit). A button with no
// type is a link.
export const BUTTONS = {
  call: {
    manage: { label: 'Manage your booking', hint: 'Their booking page, to reschedule or cancel' },
    yes: { label: 'Yes, I’ll be there', hint: 'Sends their answer back to you', type: 'reply' },
    change: { label: 'Can’t make it? Change it', hint: 'Their booking page, to reschedule or cancel' },
    join: { label: 'Join call', hint: 'Your meeting link' },
  },
  webinar: {
    details: { label: 'View details', hint: 'The thank-you page, with the date and how to join' },
    join: { label: 'Join webinar', hint: 'The webinar room' },
  },
  batch: {},
};

// A button that sends a reply rather than opening a link
export const isReply = (kind, key) => BUTTONS[kind]?.[key]?.type === 'reply';

// Messages we no longer send, kept so things saved for them still make
// sense: the coach's own templates made for one (shown, but not offered
// to send), and the switches the message that replaced it carries on.
//   replacedBy  the message now sent in its place
export const RETIRED = {
  call: [
    {
      id: 'call-1h',
      template: 'call_1h_reminder',
      name: '1 hour before',
      when: '1:1 calls now remind people 2 hours before instead.',
      example: '1 hour before her call at 4:00 pm on Thursday',
      body: 'Hi {first_name}, your *{call}* with {host} starts in 1 hour, at {time}.\n\nTap below to join when it’s time.',
      buttons: ['join', 'manage'],
      sentAt: '3:00 pm',
      retired: true,
      replacedBy: 'call-2h',
    },
  ],
  webinar: [],
};

export const MESSAGE_IDS = [...MESSAGES.call, ...MESSAGES.webinar, ...MESSAGES.batch].map((m) => m.id);

// Live classes are left out of the sidebar for now (AppLayout.jsx, its
// item's `hidden`). While they are, Settings doesn't count or list their
// message either, so the numbers match what a coach can see. Turn this on
// with the sidebar item.
export const LIVE_CLASSES_SHOWN = false;
export const SHOWN_MESSAGE_IDS = [...MESSAGES.call, ...MESSAGES.webinar, ...(LIVE_CLASSES_SHOWN ? MESSAGES.batch : [])].map(
  (m) => m.id,
);

// The message with its blanks filled in: { first_name, call, webinar, host, date, time }
export const fillMessage = (body, values) => body.replace(/\{(\w+)\}/g, (all, key) => values[key] ?? all);

// ---------- Switches ----------

function loadAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY));
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

// { 'call-2h': true, ... } for one webinar session or call ('call:<id>', 'webinar:<id>').
// A message that replaced another (replaces) starts from the old one's
// switch, so a reminder switched off stays off.
export function switchesOf(offering, kind) {
  const saved = loadAll()[offering] ?? {};
  return Object.fromEntries(
    MESSAGES[kind].map((m) => [m.id, (saved[m.id] ?? (m.replaces ? saved[m.replaces] : undefined)) !== false]),
  );
}

export function setSwitch(offering, id, on) {
  const all = loadAll();
  all[offering] = { ...(all[offering] ?? {}), [id]: on };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(WHATSAPP_SWITCHES_EVENT));
    return true;
  } catch {
    return false;
  }
}