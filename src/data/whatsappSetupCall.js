import { useEffect, useState } from 'react';

// ------------------------------------------------------------
// WhatsApp setup is done together, on a call with our team. Until then,
// Settings → WhatsApp → Connection shows no steps: one card that says so,
// with the way to book the call (WhatsAppSetupCall.jsx). On the call, our
// team reads out a 6-digit setup code; typing it unlocks the four steps
// (WhatsAppSettings.jsx). Coaches already connected never see any of this.
//
// Kept in this browser (localStorage) under KEY:
//   {
//     booking: { startsAt: ISO string, joinUrl } or null
//              their setup call, once booked. The real product reads this
//              from our own booking page (SETUP_CALL_URL), which books the
//              coach in like any 1:1 call.
//     unlockedAt: ISO string or null    when a code unlocked setup
//     answers: { facebook: 'yes' | 'no', ... }  the yes/no questions on
//              the card (WhatsAppSetupCall.jsx): all Yes before booking
//   }
//
// The unlock lasts for the call:
//   - it ends UNLOCK_MS after the code was typed
//   - it ends when they leave the setup steps, early or by connecting
//     (lockSetup, from the page itself). A reload doesn't end it.
// Either way, what they typed is kept (whatsappBusiness.js): a new call
// and code take them back to where they were.
//
// The code: the real product checks it on our server. Each code is made
// by our team for one coach, works once, and expires after the call.
// The prototype accepts DEMO_CODE only, so a wrong code can be tried.
// ------------------------------------------------------------

const KEY = 'pagebuilder:whatsapp-setup-call';
export const SETUP_CALL_EVENT = 'whatsapp-setup-call-changed';

// Our 1:1 booking page for setup calls. TODO: the real link
export const SETUP_CALL_URL = '#';
export const SETUP_CALL_MINUTES = 20;

// The one code the prototype accepts
export const DEMO_CODE = '482915';

// How long an unlock lasts: the call, with room to spare
const UNLOCK_MS = 2 * 60 * 60 * 1000;

const EMPTY = { booking: null, unlockedAt: null, answers: {} };

export function loadSetupCall() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s || typeof s !== 'object') return EMPTY;
    const b = s.booking;
    return {
      booking: b && typeof b.startsAt === 'string' ? { startsAt: b.startsAt, joinUrl: String(b.joinUrl ?? '') } : null,
      unlockedAt: typeof s.unlockedAt === 'string' ? s.unlockedAt : null,
      answers: Object.fromEntries(
        Object.entries(s.answers && typeof s.answers === 'object' ? s.answers : {}).filter(([, v]) => v === 'yes' || v === 'no'),
      ),
    };
  } catch {
    return EMPTY;
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // fine: it just won't be remembered
  }
  window.dispatchEvent(new Event(SETUP_CALL_EVENT));
}

// One of the card's yes/no questions answered
export const setAnswer = (id, value) => {
  const s = loadSetupCall();
  save({ ...s, answers: { ...s.answers, [id]: value } });
};

export const isUnlocked = (state, now = Date.now()) =>
  Boolean(state.unlockedAt) && now < Date.parse(state.unlockedAt) + UNLOCK_MS;

// The code they typed: { ok: true }, or { error } in plain words
export function unlockWithCode(text) {
  const code = String(text ?? '').replace(/\D/g, '');
  if (!code) return { error: 'Enter the setup code from your call.' };
  if (code.length !== 6) return { error: 'The setup code has 6 digits.' };
  if (code !== DEMO_CODE) return { error: 'That code didn’t work. Check it with our team on the call.' };
  save({ ...loadSetupCall(), unlockedAt: new Date().toISOString() });
  return { ok: true };
}

export const lockSetup = () => {
  const s = loadSetupCall();
  if (s.unlockedAt) save({ ...s, unlockedAt: null });
};

// Leaving the setup page locks it. Put off a moment, so a page that's
// only re-mounting (React's dev mode does this) doesn't lock itself:
// mounting again cancels it.
let pendingLock = null;
export function lockSoon() {
  clearTimeout(pendingLock);
  pendingLock = setTimeout(lockSetup, 0);
}
export const keepUnlocked = () => clearTimeout(pendingLock);

// "Tue 24 Nov, 11:00 am"
export function slotLabel(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day}, ${time}`;
}

export function useSetupCall() {
  const [state, setState] = useState(loadSetupCall);
  useEffect(() => {
    const refresh = () => setState(loadSetupCall());
    window.addEventListener(SETUP_CALL_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SETUP_CALL_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  // An unlock running out while they're on the page
  const unlocked = isUnlocked(state);
  useEffect(() => {
    if (!unlocked) return undefined;
    const left = Date.parse(state.unlockedAt) + UNLOCK_MS - Date.now();
    const id = setTimeout(() => setState(loadSetupCall()), Math.max(0, left) + 50);
    return () => clearTimeout(id);
  }, [unlocked, state.unlockedAt]);
  return { ...state, unlocked };
}

// ---------- Prototype controls ----------
// Tomorrow at 11 am, as if booked on our page
function tomorrowAt11() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  return d.toISOString();
}

export const setupCallDemo = {
  locked: () => save(EMPTY),
  // Every question answered Yes, and the call booked
  booked: () =>
    save({
      booking: { startsAt: tomorrowAt11(), joinUrl: 'https://zoom.us/j/0000000000' },
      unlockedAt: null,
      answers: { facebook: 'yes', sim: 'yes', fresh: 'yes', document: 'yes' },
    }),
  unlocked: () => save({ ...loadSetupCall(), unlockedAt: new Date().toISOString() }),
};
