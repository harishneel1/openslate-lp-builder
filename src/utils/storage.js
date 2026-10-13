// Saves the page builder's progress in this browser (localStorage),
// so a refresh or a closed tab doesn't lose anything.
//
// v2 shape:
// {
//   activeNav, previewMode,
//   openId,            // the funnel that's open, or null (on the picker)
//   funnels: [         // newest first
//     { id, type, createdAt, updatedAt, step, answers,
//       themeId, serviceId, donePages, resumeAtEnd, landingAtEnd }
//     serviceId: the service picked as the registration page, or null
//   ]
// }
// If we change this shape again, bump to v3 so old saves are ignored or converted.

const KEY = 'pagebuilder:v2';
const OLD_KEY = 'pagebuilder:v1'; // one save, one funnel (before the funnel list)

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `funnel-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// A new, empty funnel of this type (e.g. 'webinar')
export function createFunnel(type) {
  const now = Date.now();
  return {
    id: makeId(),
    type,
    createdAt: now,
    updatedAt: now,
    step: 'overview',
    answers: {},
    themeId: null,
    serviceId: null,
    donePages: [],
    resumeAtEnd: false,
    landingAtEnd: false,
  };
}

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

// The old single save becomes the first funnel in the list
function convertOldSave(old) {
  const hasWork =
    (old.answers && Object.keys(old.answers).length > 0) ||
    (Array.isArray(old.donePages) && old.donePages.length > 0);
  if (!hasWork) return { activeNav: old.activeNav, previewMode: old.previewMode, openId: null, funnels: [] };

  const funnel = {
    ...createFunnel(old.funnelId ?? 'webinar'),
    step: old.step,
    answers: old.answers,
    themeId: old.themeId ?? null,
    donePages: old.donePages ?? [],
    resumeAtEnd: old.resumeAtEnd === true,
    landingAtEnd: old.landingAtEnd === true,
  };
  return {
    activeNav: old.activeNav,
    previewMode: old.previewMode,
    openId: old.funnelId ? funnel.id : null, // it was open → keep it open
    funnels: [funnel],
  };
}

// Returns the saved object, or {} if there's nothing (or it's unreadable)
export function loadSaved() {
  const saved = readJson(KEY);
  if (saved) return saved;

  const old = readJson(OLD_KEY);
  if (old) return convertOldSave(old);

  return {};
}

// Returns true if it saved, false if the browser refused
// (storage full, or blocked in some private-browsing modes)
export function saveProgress(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Wipes everything (old and new saves)
export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // nothing to clear
  }
}