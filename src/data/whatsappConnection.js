import { mockAccount } from './myPage';
import { MESSAGE_IDS, SHOWN_MESSAGE_IDS } from './whatsappMessages';
import { atMetaLimit, couldntSend, isVerified, loadBusiness, needsFix, notEligible } from './whatsappBusiness';

// ------------------------------------------------------------
// The creator's WhatsApp connection: one for the whole account, used by
// every webinar and 1:1 call. Connected and looked after in Settings →
// WhatsApp → Connection (WhatsAppSettings.jsx), through Meta's own sign-up
// window (metaSignup.js; mocked by MetaSignupMock.jsx). A webinar's or a
// call's Reminders tab (WhatsAppTab.jsx) shows it and points to Settings.
//
// Reminders on WhatsApp always go from the creator's own number.
//
// Everything is kept in this browser. In the real product our WhatsApp
// partner keeps the connection and tells us when Meta approves the name
// or drops the number.
//
// Saved as null (not connected, or disconnected), or, connected (or
// lost: WhatsApp stopped letting us send from it):
//
//   {
//     status: 'connected' | 'lost',
//     number: '+91 98765 43210',      the no-reply number: sends reminders,
//                                     can't be chatted on
//     contactNumber: '+91 91234 56789',  the WhatsApp number the coach chats
//                                     on. The automatic reply points students
//                                     who message the no-reply number to it.
//                                     Asked for after connecting; missing
//                                     until added (needsContactNumber).
//     name: 'Harish Neel',            the name people see on each message
//     nameStatus: 'review' | 'approved' | 'rejected',
//     nameDeferred: true,             Meta put the name's review off until
//                                     the business is verified (DEFERRED)
//     nameRejection: { reason, text } why Meta rejected the name: one of
//                                     NAME_REJECTIONS' ids (or null), and
//                                     Meta's own words
//     reviewEndsAt: ISO string,       stand-in for Meta's review: the name
//                                     is approved once this has passed
//     business: 'Harish Neel',        their business on Meta
//     sharedChats: true,              chose to share their existing chats
//                                     (older saves only: no longer asked)
//     connectedAt: ISO string,
//     templatesIntro: false,          not yet seen Templates' note about our
//                                     default messages; missing means seen
//     welcomed: false,                not yet seen "You're all set" in
//                                     Settings; missing means seen (older saves)
//     messages: {                     our default messages (whatsappMessages.js),
//       'call-2h': {                  sent to Meta for review on this number
//         status: 'review' | 'approved' | 'rejected',
//         reviewEndsAt: ISO string,   stand-in, as for the name
//         sentAt: ISO string,         sent to Meta (Templates' journey)
//         decidedAt: ISO string,      Meta approved or rejected it
//       },                            (both missing on older saves)
//       ...
//     },
//   }
//
// The business behind the number is kept on its own (whatsappBusiness.js):
// Meta has to verify it before any message can go out (isSetUp).
//
// Meta reviews every message a business sends first, on that business's
// own number. So connecting sends all our default messages for review,
// and none of them goes out until it's approved.
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-whatsapp';

// Fired on every change, so every tab showing the connection follows it
export const WHATSAPP_CHANGED_EVENT = 'whatsapp-changed';

// How long the stand-in's name review takes. Meta's real one takes
// anything from minutes to a day or two.
const REVIEW_MS = 20 * 1000;

// The number and name the stand-in connects (Prototype controls' Connected)
export const MOCK_NUMBER = '+91 98765 43210';
// The contact number Prototype controls add
export const MOCK_CONTACT_NUMBER = '+91 91234 56789';
export const DEFAULT_NAME = mockAccount.name;

// ---------- Meta's review of the display name ----------
// Meta's webhook, which we assume AiSensy passes through as it is:
//   { "field": "phone_number_name_update",
//     "value": { "display_phone_number": "919876543210",
//                "decision": "APPROVED" | "REJECTED" | "DEFERRED",
//                "requested_verified_name": "Harish Neel",
//                "rejection_reason": "…" } }
//   APPROVED  approved
//   REJECTED  rejected, with Meta's reason: choose another name
//   DEFERRED  Meta checks it once the business is verified: in review
// Meta's rejection_reason isn't a fixed list. These are the reasons its
// display name rules give, each in plain words with what to do; we match
// Meta's words to one, and show Meta's own words for anything else.
// (To confirm with AiSensy: the reason texts it actually passes on.)
//   text(name)  what went wrong    fix  what to do
export const NAME_REJECTIONS = {
  mismatch: {
    label: 'Doesn’t match business',
    match: /match|relat|associat|business name|brand/i,
    text: (name) => `Meta couldn’t see a link between “${name}” and your business.`,
    fix: 'Use your legal business name, or a brand name shown on your website or documents.',
  },
  format: {
    label: 'Formatting',
    match: /format|capital|emoji|punctuation|character|space/i,
    text: (name) => `“${name}” breaks Meta’s formatting rules.`,
    fix: 'Use normal capitals (all capitals only for a short form like “HNC”), and no emojis or extra punctuation.',
  },
  generic: {
    label: 'Too generic',
    match: /generic|common|descriptive|geograph/i,
    text: (name) => `“${name}” is too general on its own.`,
    fix: 'Add your own name or brand to it, like “Harish Neel Coaching” instead of “Life Coaching”.',
  },
};

// Meta's reason text → { reason, text }
export const readNameRejection = (text) => ({
  reason: Object.keys(NAME_REJECTIONS).find((id) => NAME_REJECTIONS[id].match.test(text ?? '')) ?? null,
  text: String(text ?? ''),
});

// What the stand-in says when it rejects a name: the kind of words Meta uses
export const MOCK_NAME_REASONS = {
  mismatch: 'The display name does not match the business name associated with this account.',
  format: 'The display name does not follow formatting guidelines: capitalisation and emojis.',
  generic: 'The display name is a generic term and cannot be used on its own.',
};

// The plain words for a rejected name: { title, text, fix }
export function nameRejectionOf(connection) {
  const r = connection?.nameRejection ?? readNameRejection(MOCK_NAME_REASONS.mismatch);
  const known = NAME_REJECTIONS[r.reason];
  return {
    text: known ? known.text(connection.name) : r.text || 'Meta didn’t say why.',
    fix: known ? known.fix : 'Try your legal business name, or your own name.',
  };
}

// Meta's webhook for the name: the "value" of a phone_number_name_update.
// Returns true if it changed the connection.
export function applyNameUpdate(value) {
  const c = loadWhatsApp();
  if (!hasNumber(c) || !value?.decision) return false;
  if (value.decision === 'APPROVED') return Boolean(update({ nameStatus: 'approved', nameDeferred: false, nameRejection: null }));
  if (value.decision === 'DEFERRED') return Boolean(update({ nameStatus: 'review', nameDeferred: true, nameRejection: null }));
  if (value.decision === 'REJECTED') {
    return Boolean(update({ nameStatus: 'rejected', nameDeferred: false, nameRejection: readNameRejection(value.rejection_reason) }));
  }
  return false;
}

const nameUpdate = (c, decision, reason) => ({
  display_phone_number: String(c?.number ?? '').replace(/\D/g, ''),
  decision,
  requested_verified_name: c?.name ?? '',
  ...(reason ? { rejection_reason: reason } : {}),
});

// Why the stand-in rejects a message: the kind of reason Meta gives
export const MOCK_MESSAGE_REJECTION =
  'Meta read this as marketing. Reminders have to stick to the booking: what, when and how to join.';

// The stand-in's message reviews end a few seconds apart, as Meta's do
const MESSAGE_REVIEW_MS = 12 * 1000;
const MESSAGE_REVIEW_STEP_MS = 4 * 1000;

// Every default message, freshly sent to Meta for review
function messagesInReview(now = Date.now()) {
  return Object.fromEntries(
    MESSAGE_IDS.map((id, i) => [
      id,
      {
        status: 'review',
        sentAt: new Date(now).toISOString(),
        reviewEndsAt: new Date(now + MESSAGE_REVIEW_MS + i * MESSAGE_REVIEW_STEP_MS).toISOString(),
      },
    ]),
  );
}

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// The saved connection, or null. Anything malformed counts as not connected.
export function loadWhatsApp() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (!isObject(c)) return null;
    if (!['connected', 'lost'].includes(c.status)) return null;
    if (typeof c.number !== 'string' || typeof c.name !== 'string') return null;
    if (!['review', 'approved', 'rejected'].includes(c.nameStatus)) return null;
    return c;
  } catch {
    return null;
  }
}

// true when saved (or cleared with null)
function saveWhatsApp(connection) {
  try {
    if (connection) localStorage.setItem(KEY, JSON.stringify(connection));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(WHATSAPP_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

function update(changes) {
  const current = loadWhatsApp();
  if (!hasNumber(current)) return null;
  const next = { ...current, ...changes };
  return saveWhatsApp(next) ? next : null;
}

// ---------- Days, in the creator's own time ----------

// 'YYYY-MM-DD' for a moment, in this browser's time zone
export function dayOf(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "Mon 9 Nov"
export function dayLabel(day) {
  const d = new Date(`${day}T12:00:00`);
  const part = (opts) => d.toLocaleDateString('en-GB', opts);
  return `${part({ weekday: 'short' })} ${d.getDate()} ${part({ month: 'short' })}`;
}

// ---------- Connecting ----------

// The stand-in number, connected straight away (Prototype controls)
export const finishSetup = () =>
  connectWhatsApp({ number: MOCK_NUMBER, name: DEFAULT_NAME, business: DEFAULT_NAME, sharedChats: false });

// ---------- Connected ----------

export const isConnected = (connection) => connection?.status === 'connected';
export const hasNumber = (connection) => connection?.status === 'connected' || connection?.status === 'lost';

// After Meta's screens say yes. The name goes to Meta for review.
// Returns the new connection, or null if it couldn't be saved.
export function connectWhatsApp({ number, name, business, sharedChats }) {
  const connection = {
    status: 'connected',
    number,
    name,
    nameStatus: 'review',
    reviewEndsAt: new Date(Date.now() + REVIEW_MS).toISOString(),
    business,
    sharedChats: Boolean(sharedChats),
    connectedAt: new Date().toISOString(),
    welcomed: false,
    templatesIntro: false,
    messages: messagesInReview(),
  };
  return saveWhatsApp(connection) ? connection : null;
}

// ---------- The contact number ----------

// Connected, but no contact number yet: Settings asks for it. Nothing goes
// out on WhatsApp until it's added (whatsappConfirm.js, BatchAnnounce.jsx).
export const needsContactNumber = (connection) => hasNumber(connection) && !connection.contactNumber;

// Meta still reviewing any of the reminders
export const remindersInReview = (connection) =>
  SHOWN_MESSAGE_IDS.some((id) => messageStatus(connection, id) === 'review');

// Setup finished, the one go-live check: a number connected, Meta has
// verified the business (whatsappBusiness.js), the contact number is
// added, and Meta is done reviewing the reminders. No WhatsApp message goes
// out until it's true: every place that sends checks it (the Reminders
// tabs, ReminderChannels.jsx, the call messages in whatsappConfirm.js, a
// batch's notices in BatchAnnounce.jsx). Until then, a webinar's or call's
// Reminders tab says what's left (WhatsAppTab.jsx), and Settings' connected
// screen too ("Not live yet", and its steps). A number WhatsApp later
// dropped ('lost') still counts: that's a problem to fix, shown as one,
// not setup.
// business: the saved business details (read here when not given)
export const isSetUp = (connection, business = loadBusiness()) =>
  hasNumber(connection) &&
  isVerified(business) &&
  Boolean(connection.contactNumber) &&
  !remindersInReview(connection);

// Connected, and the one thing missing is Meta verifying the business:
// what the Reminders tab and the channel switch say while it's checked
//   null | 'review' (Meta checking) | 'fix' (turned down: fix and
//   resubmit) | 'ineligible' (turned down for a reason no fix changes)
//   | 'limit' (turned down 3 times, Meta's limit: a call with our team)
//   | 'handoff' (the document didn't reach AiSensy: a call with our team)
export function verificationPending(connection, business = loadBusiness()) {
  if (!hasNumber(connection) || isVerified(business)) return null;
  if (couldntSend(business)) return 'handoff';
  if (notEligible(business)) return 'ineligible';
  if (atMetaLimit(business)) return 'limit';
  return needsFix(business) ? 'fix' : 'review';
}

const digitsOf = (text) => String(text ?? '').replace(/\D/g, '');

// The countries a contact number can be from: India only for now. More
// can be added here; the side panel's dropdown lists them.
export const CONTACT_COUNTRIES = [{ code: '+91', label: 'India (+91)' }];

// The number they typed (without the country code), as a number to save,
// or { error } in plain words. An Indian mobile number: 10 digits,
// starting 6 to 9. A pasted +91 or leading 0 is fine. It can't be the
// no-reply number itself.
//   "98765 43210" → '+91 98765 43210'
export function readContactNumber(text, noReplyNumber, country = '+91') {
  let digits = digitsOf(text);
  if (!digits) return { error: 'Enter your WhatsApp number.' };
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10) return { error: 'Enter a 10-digit mobile number.' };
  if (!/^[6-9]/.test(digits)) return { error: 'Enter a mobile number. Landline numbers don’t work on WhatsApp.' };
  const number = `${country} ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digitsOf(number) === digitsOf(noReplyNumber)) {
    return { error: 'This is your no-reply number. Enter the number you chat with students on.' };
  }
  return { number };
}

// A saved contact number, split for the side panel's two fields:
//   '+91 91234 56789' → { country: '+91', local: '91234 56789' }
export function splitContactNumber(number) {
  const match = String(number ?? '').match(/^(\+\d+)\s+(.*)$/);
  return match ? { country: match[1], local: match[2] } : { country: CONTACT_COUNTRIES[0].code, local: '' };
}

// Saves the contact number (already read with readContactNumber)
export const setContactNumber = (contactNumber) => update({ contactNumber });

// "You're all set" seen: not shown again
export const markWelcomed = () => update({ welcomed: true });

// Templates' note about our default messages seen: not shown again
export const markTemplatesIntroSeen = () => update({ templatesIntro: true });

// A lost number, connected again (the stand-in: straight back)
export const reconnectWhatsApp = () => update({ status: 'connected' });

// A new name, after Meta rejected the last one: back into review
export function renameWhatsApp(name) {
  return update({
    name,
    nameStatus: 'review',
    nameDeferred: false,
    nameRejection: null,
    reviewEndsAt: new Date(Date.now() + REVIEW_MS).toISOString(),
  });
}

// A message's review, or 'review' for one not sent to Meta yet
export const messageStatus = (connection, id) => connection?.messages?.[id]?.status ?? 'review';

// A message's journey with Meta: when it was sent, and when Meta decided
// (null while in review). Older saves fall back to the connection's date.
export function messageDates(connection, id) {
  const m = connection?.messages?.[id] ?? {};
  const sent = m.sentAt ?? connection?.connectedAt ?? null;
  return { sent, decided: m.status === 'review' ? null : (m.decidedAt ?? sent) };
}

// Anything still with Meta: the name, or any message
export const anyInReview = (connection) =>
  hasNumber(connection) &&
  (connection.nameStatus === 'review' || MESSAGE_IDS.some((id) => messageStatus(connection, id) === 'review'));

// The stand-in's reviews finishing: each approved once its time has
// passed. A number connected before messages existed sends them now.
// The real product hears all this from our WhatsApp partner instead.
export function settleReview(now = Date.now()) {
  const c = loadWhatsApp();
  if (!hasNumber(c)) return;
  const changes = {};
  // A deferred name waits for the business to be verified
  const nameDue = c.nameStatus === 'review' && c.reviewEndsAt && now >= Date.parse(c.reviewEndsAt);
  if (nameDue && (!c.nameDeferred || isVerified(loadBusiness()))) {
    changes.nameStatus = 'approved';
    changes.nameDeferred = false;
  }

  const before = c.messages ?? {};
  const messages = { ...messagesInReview(now), ...before };
  let changed = MESSAGE_IDS.some((id) => !before[id]);
  for (const id of MESSAGE_IDS) {
    const m = messages[id];
    if (m.status === 'review' && m.reviewEndsAt && now >= Date.parse(m.reviewEndsAt)) {
      messages[id] = { status: 'approved', sentAt: m.sentAt, decidedAt: m.reviewEndsAt };
      changed = true;
    }
  }
  if (changed) changes.messages = messages;
  if (Object.keys(changes).length) update(changes);
}

// One message's review, set directly (the prototype controls)
function setMessage(id, status) {
  const c = loadWhatsApp();
  if (!hasNumber(c)) return;
  const was = c.messages?.[id] ?? {};
  update({
    messages: {
      ...messagesInReview(),
      ...c.messages,
      [id]: { status, sentAt: was.sentAt, decidedAt: new Date().toISOString() },
    },
  });
}

export const disconnectWhatsApp = () => saveWhatsApp(null);

// ---------- Going to Settings → WhatsApp ----------
// From anywhere (a webinar's or a call's Reminders tab): the app (App.jsx)
// hears this and opens Settings on WhatsApp.
//   page:   'whatsapp' (Connection, the default) or 'whatsapp-templates'
//   create: { product, moment } to open Templates' editor on a new
//           template for that message (a reminder's "Create a new template")
export const OPEN_SETTINGS_EVENT = 'open-whatsapp-settings';
export const goToWhatsAppSettings = ({ page = 'whatsapp', create = null } = {}) =>
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { page, create } }));

// ---------- Prototype controls (the demo panel on the WhatsApp tab) ----------

export const demo = {
  approveName: () => applyNameUpdate(nameUpdate(loadWhatsApp(), 'APPROVED')),
  // reason: one of NAME_REJECTIONS' ids (Meta's kind of words for it)
  rejectName: (reason = 'mismatch') => applyNameUpdate(nameUpdate(loadWhatsApp(), 'REJECTED', MOCK_NAME_REASONS[reason])),
  deferName: () => applyNameUpdate(nameUpdate(loadWhatsApp(), 'DEFERRED')),
  // WhatsApp stopped letting us send (the number was moved, banned, or
  // the creator removed us in WhatsApp)
  loseNumber: () => update({ status: 'lost' }),
  approveMessages: (ids) => {
    const c = loadWhatsApp();
    if (!hasNumber(c)) return;
    const messages = { ...messagesInReview(), ...c.messages };
    const now = new Date().toISOString();
    for (const id of ids) messages[id] = { status: 'approved', sentAt: messages[id]?.sentAt, decidedAt: now };
    update({ messages });
  },
  rejectMessage: (id) => setMessage(id, 'rejected'),
  reset: () => saveWhatsApp(null),
  // Settings' connected screen
  addContactNumber: () => update({ contactNumber: MOCK_CONTACT_NUMBER }),
  removeContactNumber: () => update({ contactNumber: null }),
  replayWelcome: () => update({ welcomed: false, templatesIntro: false }),
  // Back in review, as just after connecting (the stand-in approves them again shortly)
  reconnect: () => update({ status: 'connected' }),
  nameInReview: () =>
    update({ nameStatus: 'review', nameDeferred: false, nameRejection: null, reviewEndsAt: new Date(Date.now() + REVIEW_MS).toISOString() }),
  messagesInReview: () => update({ messages: messagesInReview() }),
};