// ------------------------------------------------------------
// Meta's Embedded Signup, mocked. In the real product, Connect WhatsApp
// calls Facebook's JavaScript SDK (FB.login with our configuration id),
// which opens Meta's signup in a popup window. When the coach finishes,
// Meta posts a message to our page:
//
//   { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH',
//     data: { phone_number_id, waba_id } }
//
// and FB.login's callback gets a one-time code, which our server (with
// AiSensy) swaps for access, registers the number and sends the reminder
// templates for review. Closing early posts event 'CANCEL' with the
// screen they were on (data.current_step); Meta's own errors post an
// error message and code.
//
// Here the popup is our own page (?mock=meta-signup, MetaSignupMock.jsx),
// made to resemble Meta's screens. It posts the same message, plus a
// `mock` part with what the coach typed (the number, the display name),
// which the real product would read back from Meta's API instead.
//
// Round 1: finishing. Round 2: closing early (the mock posts CANCEL, as
// Meta does) and a blocked popup (a prototype switch makes the next one
// fail, since a real block can't be set off on demand). Round 3: the five
// errors (SIGNUP_ERRORS), picked for the next setup in the prototype
// controls, since a real one can't be set off on demand either.
// ------------------------------------------------------------

// Our product's name as Meta's screens show it: the name of our app on
// Meta, which coaches see while connecting. A placeholder until it's set.
export const PLATFORM_NAME = 'Your App';

export const SIGNUP_MESSAGE = 'WA_EMBEDDED_SIGNUP';

// Where coaches reach us when setup fails. A placeholder until it's set.
export const SUPPORT_EMAIL = 'support@example.com';

// ---------- The errors ----------
// Errors happen in two places, as in the real flow:
//   where 'phone' | 'code'  inside Meta's window, on that screen. Meta shows
//                           its own message there (meta), in its own words,
//                           and the coach can fix it there (another number,
//                           another code). Closing the window instead tells
//                           our page, which explains it in ours.
//   where 'finishing'       after Meta's window: our server finds it while
//                           connecting the number ("Finishing setup…").
// title, text: what our page says. Our words, not Meta's: no asking coaches
// to delete their own WhatsApp (they keep it, and use a spare number).
// The exact list, and how each reaches us, is to confirm with AiSensy.
export const SIGNUP_ERRORS = {
  'on-whatsapp': {
    where: 'phone',
    label: 'Number on WhatsApp',
    title: 'This number is still on WhatsApp',
    text: 'Use a spare number that isn’t on WhatsApp, then try again.',
    meta: 'This phone number is already registered on WhatsApp. Use a different number, or delete the WhatsApp account on this number first.',
  },
  unsupported: {
    where: 'phone',
    label: 'Number not supported',
    title: 'This type of number isn’t supported',
    text: 'Use a regular mobile number with a SIM card, then try again.',
    meta: 'This phone number can’t be used with WhatsApp Business. Virtual and landline numbers aren’t supported.',
  },
  'no-code': {
    where: 'code',
    label: 'Code not received',
    title: 'We couldn’t verify your number',
    text: 'Make sure it can receive an SMS or call, then try again.',
    meta: 'We couldn’t verify this phone number. Request a new code, or choose another way to verify.',
  },
  elsewhere: {
    where: 'finishing',
    label: 'Connected elsewhere',
    title: 'This number is connected to another WhatsApp service',
    text: 'Disconnect it there first, then try again.',
  },
  permissions: {
    where: 'finishing',
    label: 'Permissions not granted',
    title: 'Setup needs your permission to send messages',
    text: 'Try again and approve every permission Meta asks for.',
  },
};

// ---------- Prototype: the error the next setup hits ----------
// Kept in this browser (the Meta window reads it as it opens, then clears
// it), so Try again after an error goes through.
const ERROR_KEY = 'pagebuilder:next-signup-error';
export const ERROR_CHANGED_EVENT = 'signup-error-changed';

export function nextError() {
  try {
    const id = localStorage.getItem(ERROR_KEY);
    return SIGNUP_ERRORS[id] ? id : null;
  } catch {
    return null;
  }
}

export function setNextError(id) {
  try {
    if (id) localStorage.setItem(ERROR_KEY, id);
    else localStorage.removeItem(ERROR_KEY);
  } catch {
    // fine: the choice just won't stick
  }
  window.dispatchEvent(new Event(ERROR_CHANGED_EVENT));
}

// The Meta window, as it opens: the error it should hit, used up
export function takeNextError() {
  const id = nextError();
  if (id) setNextError(null);
  return id;
}

const WIDTH = 600;
const HEIGHT = 720;

// ---------- Prototype: block the next popup ----------
// Kept for this browser tab only. Used once, then it's off again.
const BLOCK_KEY = 'pagebuilder:block-next-signup-popup';
export const BLOCK_CHANGED_EVENT = 'signup-popup-block-changed';

export function willBlockPopup() {
  try {
    return sessionStorage.getItem(BLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBlockPopup(on) {
  try {
    if (on) sessionStorage.setItem(BLOCK_KEY, '1');
    else sessionStorage.removeItem(BLOCK_KEY);
  } catch {
    // fine: the switch just won't stick
  }
  window.dispatchEvent(new Event(BLOCK_CHANGED_EVENT));
}

// Opens the mock signup as a popup, centred on this window, as Meta's is.
// Returns the window, or null if the browser blocked it (or the prototype
// switch above stood in for that).
export function openSignupWindow() {
  if (willBlockPopup()) {
    setBlockPopup(false);
    return null;
  }
  const left = Math.round(window.screenX + (window.outerWidth - WIDTH) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - HEIGHT) / 2);
  return window.open(
    '/?mock=meta-signup',
    'meta-signup',
    `popup=yes,width=${WIDTH},height=${HEIGHT},left=${left},top=${top}`,
  );
}

// From the popup: tell the page that opened it that setup finished.
// false when there's no such page (the mock was opened on its own).
// fail: an error our server would find while finishing (SIGNUP_ERRORS'
// 'finishing' ones), passed along so the mock can show it
export function postFinish({ number, displayName, business, fail = null }) {
  if (!window.opener || window.opener.closed) return false;
  const message = {
    type: SIGNUP_MESSAGE,
    event: 'FINISH',
    data: { phone_number_id: `mock-phone-${Date.now()}`, waba_id: `mock-waba-${Date.now()}` },
    mock: { number, displayName, business, fail },
  };
  window.opener.postMessage(JSON.stringify(message), window.location.origin);
  return true;
}

// From the popup: the coach left before finishing. step: the screen they
// were on, as Meta names it (data.current_step).
export function postCancel(step) {
  if (!window.opener || window.opener.closed) return false;
  const message = { type: SIGNUP_MESSAGE, event: 'CANCEL', data: { current_step: step } };
  window.opener.postMessage(JSON.stringify(message), window.location.origin);
  return true;
}

// From the popup: closed while Meta's own error was showing. Meta's
// message carries its error message and code; `mock` says which of ours.
export function postError(id) {
  if (!window.opener || window.opener.closed) return false;
  const message = {
    type: SIGNUP_MESSAGE,
    event: 'ERROR',
    data: { error_message: SIGNUP_ERRORS[id]?.meta ?? '', error_code: `mock-${id}` },
    mock: { error: id },
  };
  window.opener.postMessage(JSON.stringify(message), window.location.origin);
  return true;
}

// On our page: a message event, read as Meta's signup message, or null.
// (The real check is that it comes from facebook.com; the mock is ours.)
export function readSignupMessage(event) {
  if (event.origin !== window.location.origin) return null;
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    return data?.type === SIGNUP_MESSAGE ? data : null;
  } catch {
    return null;
  }
}