import { mockAccount } from './myPage';
import { MESSAGE_IDS } from './whatsappMessages';

// ------------------------------------------------------------
// The creator's WhatsApp connection: one for the whole account, used by
// every webinar and 1:1 call. Connected and looked after in Settings →
// WhatsApp (WhatsAppSettings.jsx); the Reminders tab of a webinar or a
// call (WhatsAppTab.jsx) still shows it too, until its own round.
//
// Reminders on WhatsApp always go from the creator's own number. Getting
// it connected takes three steps. What each step is hasn't been settled
// (it depends on Meta's process and our WhatsApp partner's), so for now
// they're placeholders the creator clicks through (WhatsAppTab.jsx), and
// the last one connects a stand-in number.
//
// Everything is kept in this browser. In the real product our WhatsApp
// partner keeps the connection and tells us when Meta approves the name
// or drops the number.
//
// Saved as null (not started, or disconnected), or one of:
//
//   Part way through setting up:
//   { status: 'setup', step: 2 }      the step they're on (1 to SETUP_STEPS)
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
//                                     (older saves only: no longer asked)
//     connectedAt: ISO string,
//     welcomed: false,                not yet seen "You're all set" in
//                                     Settings; missing means seen (older saves)
//     verified: false,                Meta has verified their business,
//                                     which raises the daily limit (DAILY_LIMIT)
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

// How many different students a number can start conversations with in a
// day: Meta's limits, unverified and verified. Meta can change them, so
// they're here only. To confirm with AiSensy.
export const DAILY_LIMIT = { unverified: 250, verified: 2000 };

export const dailyLimit = (connection) => (connection?.verified ? DAILY_LIMIT.verified : DAILY_LIMIT.unverified);

// How many steps getting connected takes
export const SETUP_STEPS = 3;

// How long the stand-in's name review takes. Meta's real one takes
// anything from minutes to a day or two.
const REVIEW_MS = 20 * 1000;

// The number and name the stand-in connects at the end of the steps
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

// The saved connection, or null. Anything malformed counts as not connected.
export function loadWhatsApp() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (!isObject(c)) return null;
    if (c.status === 'setup') return Number.isInteger(c.step) && c.step >= 1 && c.step <= SETUP_STEPS ? c : null;
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
  if (!current || current.status === 'setup') return null;
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

// ---------- Setting up ----------

// The step they're on (1 to SETUP_STEPS), or 0 before they've started
export const setupStep = (connection) => (connection?.status === 'setup' ? connection.step : 0);

// Move to a step. Step 1 also starts it; 0 goes back to not started.
export const goToStep = (step) => saveWhatsApp(step >= 1 ? { status: 'setup', step } : null);

// Done with the last step: the stand-in number is connected
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
    verified: false,
    messages: messagesInReview(),
  };
  return saveWhatsApp(connection) ? connection : null;
}

// "You're all set" seen: not shown again
export const markWelcomed = () => update({ welcomed: true });

// A lost number, connected again (the stand-in: straight back)
export const reconnectWhatsApp = () => update({ status: 'connected' });

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

// ---------- Going to Settings → WhatsApp ----------
// From anywhere (a webinar's or a call's Reminders tab): the app (App.jsx)
// hears this and opens Settings on its WhatsApp tab.
export const OPEN_SETTINGS_EVENT = 'open-whatsapp-settings';
export const goToWhatsAppSettings = () => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));

// ---------- Prototype controls (the demo panel on the WhatsApp tab) ----------

export const demo = {
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
  // Settings' connected screen
  setVerified: (verified) => update({ verified }),
  replayWelcome: () => update({ welcomed: false }),
  // Back in review, as just after connecting (the stand-in approves them again shortly)
  reconnect: () => update({ status: 'connected' }),
  nameInReview: () => update({ nameStatus: 'review', reviewEndsAt: new Date(Date.now() + REVIEW_MS).toISOString() }),
  messagesInReview: () => update({ messages: messagesInReview() }),
};