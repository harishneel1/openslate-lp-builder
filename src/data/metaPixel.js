import { mockAccount } from './myPage';

// ------------------------------------------------------------
// The coach's Meta Pixel: one for the whole account, used by every
// webinar (and every session of it), now and later. Kept in this
// browser for now (localStorage); in the real product the server keeps
// it, and the access token never comes back to the browser once saved.
//
// One record, or nothing when it isn't set up. Both the Pixel ID and the
// access token are required: a pixel without a working token is treated
// as a problem, never as half done.
//   { pixelId, pixelName, token, connectedAt, checkedAt, brokenAt }
//   pixelId:     15 or 16 digits (Meta also calls it a dataset ID)
//   pixelName:   its name in Meta, from the check
//   token:       the Conversions API access token (always there)
//   connectedAt: when it was first saved (ms)
//   checkedAt:   when it last passed the check (ms)
//   brokenAt:    when Meta started refusing the token (ms), or null. The
//                real server notices when its CAPI sends start failing.
//
// Status, worked out from the record (pixelStatus):
//   'none'       not set up
//   'connected'  Pixel ID and access token, checked with Meta
//   'broken'     it was connected, but Meta now refuses the token (deleted,
//                or the coach lost admin access). Shown in red as "stopped
//                working". (The browser pixel keeps firing, but the UI
//                treats it as not working: coaches fix it or remove it.)
//
// ---------- For the dev team: what gets sent to Meta ----------
// Coaches never see or choose these. Every event goes from the browser
// (Pixel) AND from the server (CAPI) with the same event_id, so Meta
// counts it once. Each one carries the webinar it's for, so a coach can
// make per-webinar custom conversions in Meta later if they want.
//
//   Page                 Event                 When
//   Landing page         PageView              on load
//   Sign-up page         InitiateCheckout      on load
//   Thank you page       CompleteRegistration  free webinar, after sign-up
//   Thank you page       Purchase              paid webinar, after payment
//
//   custom_data on every event:
//     content_name  the webinar's headline (funnelName)
//     content_ids   [the series id], so every session of one webinar counts as one
//     content_type  'webinar'
//   Purchase also:   value (what they paid, in rupees), currency 'INR'
//   user_data (CAPI): hashed email and phone from the sign-up form, plus
//     the fbp / fbc cookies and client IP / user agent, for matching
// ------------------------------------------------------------

const KEY = 'pagebuilder:meta-pixel';
const CHANGED_EVENT = 'meta-pixel-changed';

// ---------- Videos ----------
// Paste each video's link here once it's recorded; until then the drawer
// shows a "coming soon" card. A step's own link only shows when it has one.
export const PIXEL_VIDEOS = {
  overview: { url: null, title: 'How to connect your Meta Pixel', length: 'About 5 min' },
  pixelId: { url: null, length: '1 min' },
  token: { url: null, length: '2 min' },
};

// ---------- Help steps, under each box ----------
export const PIXEL_ID_STEPS = [
  'On a computer, open Meta Events Manager (business.facebook.com/events_manager).',
  'On the left, click Data sources, then click your pixel. Meta may call it a dataset.',
  'Its ID is the long number under its name. Copy it and paste it here.',
];

// Meta's wording as of Oct 2026 (it changes often: check against the live
// Events Manager when recording the videos)
export const TOKEN_STEPS = [
  'In Events Manager, click your pixel (Meta may call it a dataset), then click Settings.',
  'Scroll down to Conversions API. Under Set up direct integration, click Generate access token.',
  'Copy the whole code and paste it here. Meta shows it only once, so paste it before you close that window.',
];

export const TOKEN_ADMIN_NOTE =
  'Don’t see Generate access token? You need to be an admin of this pixel. Ask whoever set up your ads to make you one.';

// ---------- What Meta will see, in everyday words ----------
export const PIXEL_EVENTS = [
  'Someone visits your webinar page',
  'Someone starts signing up',
  'Someone signs up for a free webinar',
  'Someone pays for a paid webinar, and how much',
];

// ---------- Saving ----------
function readRecord() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!r || typeof r !== 'object' || typeof r.pixelId !== 'string' || !r.pixelId) return null;
    // No token = not set up (older saves from when a Pixel ID could be saved alone)
    if (typeof r.token !== 'string' || !r.token) return null;
    return {
      pixelId: r.pixelId,
      pixelName: typeof r.pixelName === 'string' ? r.pixelName : '',
      token: r.token,
      connectedAt: Number(r.connectedAt) || Date.now(),
      checkedAt: Number(r.checkedAt) || Date.now(),
      brokenAt: Number(r.brokenAt) || null,
    };
  } catch {
    return null;
  }
}

function writeRecord(record) {
  try {
    if (record) localStorage.setItem(KEY, JSON.stringify(record));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// The saved pixel, or null
export const loadPixel = () => readRecord();

// Saves what passed the check (pixelName comes from it). Keeps the first
// connectedAt when it's an update; a new save clears brokenAt.
export function savePixel({ pixelId, token, pixelName = '' }) {
  const before = readRecord();
  const now = Date.now();
  return writeRecord({
    pixelId: cleanPixelId(pixelId),
    pixelName,
    token: cleanToken(token),
    connectedAt: before?.connectedAt ?? now,
    checkedAt: now,
    brokenAt: null,
  });
}

// Removes it (Round 3's Remove)
export const removePixel = () => writeRecord(null);

// Calls back when it changes, here or in another tab
export function onPixelChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
  };
}

export function pixelStatus(record) {
  if (!record) return 'none';
  return record.brokenAt ? 'broken' : 'connected';
}

// ---------- Dates, as the panel and the rows say them ----------
// "Today, 7:42 pm", "Yesterday, 9:05 am", "24 Oct, 7:42 pm"
export function whenLabel(ms, now = Date.now()) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const day = (x) => new Date(x).setHours(0, 0, 0, 0);
  const daysAgo = Math.round((day(now) - day(ms)) / 86_400_000);
  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

// "27 Oct"
export const dayLabel = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ---------- Checks as they type ----------
// Spaces and line breaks sneak in when copying from Meta: dropped
export const cleanPixelId = (value) => String(value ?? '').replace(/\s+/g, '');
export const cleanToken = (value) => String(value ?? '').replace(/\s+/g, '');

// Each returns what's wrong in plain words, or null when it looks right.
// Empty is null here too: the footer says what's missing (both are required).
export function pixelIdProblem(value) {
  const id = cleanPixelId(value);
  if (!id) return null;
  if (/^EAA/i.test(id)) return 'This looks like an access token. Paste it in step 2 below, and put your Pixel ID here.';
  if (/\D/.test(id)) return 'A Pixel ID has only numbers. Copy it again from Events Manager.';
  if (id.length < 15 || id.length > 16) {
    return `A Pixel ID is 15 or 16 numbers. This one has ${id.length}.`;
  }
  return null;
}

// Tokens made in Events Manager start with EAA and run to 150+ characters.
// (Devs: loosen this if Meta's format changes.)
export function tokenProblem(value) {
  const token = cleanToken(value);
  if (!token) return null;
  if (/^\d+$/.test(token)) return 'This looks like your Pixel ID. The access token is a much longer code that starts with EAA.';
  if (!/^EAA/.test(token)) return 'This doesn’t look like an access token. It’s a long code that starts with EAA.';
  if (/[^A-Za-z0-9]/.test(token)) return 'This access token has characters that don’t belong in it. Copy it again from Events Manager.';
  if (token.length < 100) return 'This access token looks cut off. Copy the whole code again from Events Manager.';
  return null;
}

// ---------- The check with Meta (mocked) ----------
// Both boxes are required, so it always runs with a token (Meta answers
// nothing without one, so a Pixel ID on its own couldn't be checked).
//
// The real one, on the server:
//   1. Ask Meta about the pixel, with the token. Meta answers with its
//      name, or refuses. Meta gives the same refusal whether the pixel
//      doesn't exist or the token can't reach it, so both are one error:
//      'mismatch'. A broken, expired or cancelled token gets its own error.
//   2. Send one test sign-up through CAPI (if it can be sent without the
//      coach copying a test code; devs to confirm). Accepted → connected.
//   3. Save the token encrypted. It never comes back to the browser.
//
// Resolves to { ok: true, pixelName } or { ok: false, field, message }.
// field: the box the message goes under: 'pixelId', 'token', or 'both'
// (the message under the Pixel ID, both boxes marked).
//
// To see each answer without a real pixel, add to the app's address:
//   ?pixel=mismatch       the Pixel ID and token don't go together
//   ?pixel=token-invalid  the token is broken, expired or cancelled
//   ?pixel=no-permission  the token can't send events
//   ?pixel=broken         a connected pixel stops working (see below)
export const CHECK_MS = 1800;

const FAILURES = {
  mismatch: {
    field: 'both',
    message: 'This Pixel ID and access token don’t match. Check the Pixel ID is right, and that you created the token from this pixel’s Settings.',
  },
  'token-invalid': {
    field: 'token',
    message: 'This access token doesn’t work any more. Create a new one in Events Manager and paste it here.',
  },
  'no-permission': {
    field: 'token',
    message: 'This access token isn’t allowed to send sign-ups to Meta. Only an admin of the pixel can create one that works.',
  },
};

export function mockOutcome() {
  const asked = new URLSearchParams(window.location.search).get('pixel');
  return FAILURES[asked] ? asked : 'ok';
}

// The name Meta would answer with (the coach's own, in the prototype)
const mockPixelName = () => `${mockAccount.name}’s Pixel`;

export function checkPixel() {
  const outcome = mockOutcome();
  return new Promise((resolve) => {
    setTimeout(() => {
      const failure = FAILURES[outcome];
      resolve(failure ? { ok: false, ...failure } : { ok: true, pixelName: mockPixelName() });
    }, CHECK_MS);
  });
}

// ---------- ?pixel=broken: a connected pixel stops working ----------
// Runs once, when the app loads: a saved, connected pixel is marked as
// refused by Meta (as if its token had just been deleted). Fixing it
// (Replace access token) clears that. Refreshing with the switch still
// in the address breaks it again, so take it off once you've seen it.
(function mockBreak() {
  try {
    if (new URLSearchParams(window.location.search).get('pixel') !== 'broken') return;
    const r = readRecord();
    if (r?.token && !r.brokenAt) localStorage.setItem(KEY, JSON.stringify({ ...r, brokenAt: Date.now() }));
  } catch {
    // no storage: nothing to break
  }
})();