// ------------------------------------------------------------
// The creator's one public page: its address, and the checks
// for the link they choose (yourdomain.com/<handle>).
// ------------------------------------------------------------

// Where pages live. For now, this app's own address (localhost:5173), so
// localhost:5173/harishneel opens the page. Swap for 'openslate.ai' once
// pages are hosted there.
export const PAGE_DOMAIN = window.location.host;

// The full web address of a page, to copy or open: http://localhost:5173/harishneel
export const pageUrl = (handle) => `${window.location.protocol}//${PAGE_DOMAIN}/${handle}`;

// One offering's own link, for creators who share a single call rather than
// their whole page: http://localhost:5173/harishneel/my-call
// Built from the offering's id, not its title, so renaming a call never
// breaks a link that's already been sent. (A creator-chosen slug can
// replace the id once the real API stores one.)
export const offeringUrl = (handle, id) => `${pageUrl(handle)}/${encodeURIComponent(id)}`;

// Who's signed in. Stand-in until the real account comes from the API.
export const mockAccount = { name: 'Harish Neel' };

// Where the setup answers are kept in this browser, and the event fired when
// they change (so the sidebar card can show the new link straight away)
export const SETUP_STORAGE_KEY = 'myPageSetup';
export const SETUP_CHANGED_EVENT = 'mypage-setup-changed';

// The link they've picked so far, or null
export function savedHandle() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY))?.handle || null;
  } catch {
    return null;
  }
}

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

// What's allowed in a link: lowercase letters, numbers and underscores.
// Spaces and anything else are dropped as they type.
export function cleanHandle(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, HANDLE_MAX);
}

// Their name squashed into a link: "Harish Neel" → "harishneel"
export const suggestedHandle = (name) => cleanHandle(name);

// Stand-in for the real "is this link free?" call to the server.
// Includes words we keep for our own pages.
const TAKEN = new Set([
  'meerajoshi', 'priya', 'coach', 'lifecoach', 'yoga', 'fitness',
  'admin', 'help', 'support', 'login', 'signup', 'about', 'pricing', 'dashboard',
]);

export const isHandleTaken = (handle) => TAKEN.has(handle);

// Up to three free links close to the one they wanted
export function handleSuggestions(handle) {
  return [`${handle}_coach`, `${handle}coaching`, `the${handle}`, `${handle}_official`]
    .map(cleanHandle)
    .filter((h, i, all) => h.length >= HANDLE_MIN && !isHandleTaken(h) && all.indexOf(h) === i)
    .slice(0, 3);
}