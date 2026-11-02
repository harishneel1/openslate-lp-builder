import { mockAccount } from './myPage';
import { MESSAGE_IDS } from './whatsappMessages';

// ------------------------------------------------------------
// The creator's WhatsApp connection: one for the whole account, used by
// every webinar and 1:1 call. Reached only from the WhatsApp tab of a
// webinar or a call (WhatsAppTab.jsx); there's no settings page for it.
//
// Reminders on WhatsApp always go from the creator's own number. To
// connect it, Meta asks for two things:
//   - the number is on the WhatsApp Business app (not regular WhatsApp)
//   - it has been in real use there, for at least 7 days
// We can't ask Meta about the second beforehand: Meta checks it inside
// its own connect screens, and says no if the number isn't ready. So we
// let the creator try, and only if Meta says no do we keep a day to try
// again (7 days on).
//
// Stand-in until the real connection is built: MetaConsent.jsx plays
// Meta's part, and everything is kept in this browser. In the real
// product our WhatsApp partner keeps the connection and tells us when
// Meta approves the name or drops the number.
//
// Saved as null (never connected, or disconnected), or one of:
//
//   Meta said the number isn't ready yet:
//   { status: 'notReady', triedOn: '2026-11-02', name: 'Harish Neel' }
//     triedOn: the day Meta said no; name: what they'd chosen, to try again
//
//   Connected (or lost: WhatsApp stopped letting us send from it):
//   {
//     status: 'connected' | 'lost',
//     number: '+91 98765 43210',
//     name: 'Harish Neel',            the name people see on each message
//     nameStatus: 'review' | 'approved' | 'rejected',
//     reviewEndsAt: ISO string,       stand-in for Meta's review: the name
//                                     is approved once this has passed
//     business: 'Harish Neel',        their business on Meta
//     sharedChats: true,              chose to share their existing chats
//     connectedAt: ISO string,
//     messages: {                     our default messages (whatsappMessages.js),
//       'call-1h': {                  sent to Meta for review on this number
//         status: 'review' | 'approved' | 'rejected',
//         reviewEndsAt: ISO string,   stand-in, as for the name
//       },
//       ...
//     },
//   }
//
// Meta reviews every message a business sends first, on that business's
// own number. So connecting sends all our default messages for review,
// and none of them goes out until it's approved.
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-whatsapp';

// Fired on every change, so every tab showing the connection follows it
export const WHATSAPP_CHANGED_EVENT = 'whatsapp-changed';

// Meta's rule: at least 7 days of real use on WhatsApp Business
export const WAIT_DAYS = 7;

// How long the stand-in's name review takes. Meta's real one takes
// anything from minutes to a day or two.
const REVIEW_MS = 20 * 1000;

// The number the stand-in fills in. They can change it in Meta's screen.
export const MOCK_NUMBER = '+91 98765 43210';
export const DEFAULT_NAME = mockAccount.name;

// Why the stand-in rejects a name: the kind of reason Meta gives
export const MOCK_REJECTION = 'The name doesn’t match your business. Use your own name or your brand’s name.';

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
      { status: 'review', reviewEndsAt: new Date(now + MESSAGE_REVIEW_MS + i * MESSAGE_REVIEW_STEP_MS).toISOString() },
    ]),
  );
}

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// The saved connection, or null. Anything malformed counts as not connected.
export function loadWhatsApp() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (!isObject(c)) return null;
    if (c.status === 'notReady') return isDay(c.triedOn) ? c : null;
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
  if (!current || current.status === 'notReady') return null;
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

// A day plus n days, as 'YYYY-MM-DD' (noon, so clock changes can't move it)
export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayOf(d.getTime());
}

// "Mon 9 Nov"
export function dayLabel(day) {
  const d = new Date(`${day}T12:00:00`);
  const part = (opts) => d.toLocaleDateString('en-GB', opts);
  return `${part({ weekday: 'short' })} ${d.getDate()} ${part({ month: 'short' })}`;
}

// ---------- Meta said the number isn't ready ----------

// The first day worth trying again: a week after Meta said no
export const retryDay = (connection) => addDays(connection.triedOn, WAIT_DAYS);

// Meta said no, and the week since hasn't passed. They can still try
// sooner; this only decides how the tab words it.
export const isTooSoon = (connection, now) => connection?.status === 'notReady' && dayOf(now) < retryDay(connection);

// Meta said the number isn't ready (today)
// (at: the moment, so a second no on the same day still counts as news)
export const markNotReady = (name) =>
  saveWhatsApp({ status: 'notReady', triedOn: dayOf(Date.now()), at: Date.now(), name });

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
    messages: messagesInReview(),
  };
  return saveWhatsApp(connection) ? connection : null;
}

// Reconnecting a lost number through Meta again: same number and name
export function reconnectWhatsApp({ number, sharedChats }) {
  return update({ status: 'connected', number, sharedChats: Boolean(sharedChats) });
}

// A new name, after Meta rejected the last one: back into review
export function renameWhatsApp(name) {
  return update({ name, nameStatus: 'review', reviewEndsAt: new Date(Date.now() + REVIEW_MS).toISOString() });
}

// A message's review, or 'review' for one not sent to Meta yet
export const messageStatus = (connection, id) => connection?.messages?.[id]?.status ?? 'review';

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
  if (c.nameStatus === 'review' && c.reviewEndsAt && now >= Date.parse(c.reviewEndsAt)) changes.nameStatus = 'approved';

  const before = c.messages ?? {};
  const messages = { ...messagesInReview(now), ...before };
  let changed = MESSAGE_IDS.some((id) => !before[id]);
  for (const id of MESSAGE_IDS) {
    const m = messages[id];
    if (m.status === 'review' && m.reviewEndsAt && now >= Date.parse(m.reviewEndsAt)) {
      messages[id] = { status: 'approved' };
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
  update({ messages: { ...messagesInReview(), ...c.messages, [id]: { status } } });
}

export const disconnectWhatsApp = () => saveWhatsApp(null);

// ---------- Prototype controls (the demo panel on the WhatsApp tab) ----------

export const demo = {
  // A week has passed since Meta said no
  skipWeek: () => {
    const c = loadWhatsApp();
    if (c?.status === 'notReady') saveWhatsApp({ ...c, triedOn: addDays(dayOf(Date.now()), -WAIT_DAYS) });
  },
  approveName: () => update({ nameStatus: 'approved' }),
  rejectName: () => update({ nameStatus: 'rejected' }),
  // WhatsApp stopped letting us send (the number was moved, banned, or
  // the creator removed us in WhatsApp)
  loseNumber: () => update({ status: 'lost' }),
  approveMessages: (ids) => {
    const c = loadWhatsApp();
    if (!hasNumber(c)) return;
    const messages = { ...messagesInReview(), ...c.messages };
    for (const id of ids) messages[id] = { status: 'approved' };
    update({ messages });
  },
  rejectMessage: (id) => setMessage(id, 'rejected'),
  reset: () => saveWhatsApp(null),
};