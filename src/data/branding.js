import { useEffect, useSyncExternalStore } from 'react';
import { mockAccount } from './myPage';

// ------------------------------------------------------------
// The coach's branding (Settings → Branding, BrandingSettings.jsx):
// business name, logo and favicon. Brand colour is coming later.
//
// Until they save it once, the dashboard shows OpenSlate's logo
// (BrandMark.jsx). After that it shows theirs: their logo if they've
// uploaded one, otherwise their initials (HN).
//
// A stand-in: kept in this browser. The real app saves it to the account,
// and stores the pictures as files rather than data URLs.
// ------------------------------------------------------------

const KEY = 'branding';
const CHANGED = 'branding-changed';
// saved: they've pressed Save at least once (until then, OpenSlate's logo)
const EMPTY = { saved: false, name: '', logo: null, favicon: null };

// What the form starts with before anything's saved
export const DEFAULT_NAME = mockAccount.name;

let cache = null;
function read() {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next) {
  cache = next;
  try {
    if (next.saved) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // fine: it just won't be remembered after a reload
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(fn) {
  const onStorage = (e) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener(CHANGED, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGED, fn);
    window.removeEventListener('storage', onStorage);
  };
}

// { saved, name, logo, favicon }, and updates when it changes
export function useBranding() {
  return useSyncExternalStore(subscribe, read);
}

export const branding = () => read();

// Save: { name, logo, favicon }
export function saveBranding({ name, logo, favicon }) {
  write({ saved: true, name: name.trim(), logo, favicon });
}

// ---------- Prototype controls ----------
export const brandingDemo = {
  // Never saved: OpenSlate's logo again
  reset() {
    write(EMPTY);
  },
  // Saved with just a name: their initials
  initialsOnly() {
    write({ saved: true, name: DEFAULT_NAME, logo: null, favicon: null });
  },
};

// ---------- Student pages ----------
// What students see: the saved business name and logo, or (before
// branding's saved) the coach's own name and no logo, as before.
// saved is always true here: students never see OpenSlate's logo.
export function studentBrand(b) {
  return {
    saved: true,
    branded: b.saved,
    name: (b.saved && b.name) || DEFAULT_NAME,
    logo: b.saved ? b.logo : null,
    favicon: b.saved ? b.favicon || b.logo : null,
  };
}

export function useStudentBrand() {
  return studentBrand(useBranding());
}

// Shows `icon` (a data URL) as the browser tab's icon while mounted, or
// leaves it alone when null. Puts the old one back after.
export function useFavicon(icon) {
  useEffect(() => {
    if (!icon) return undefined;
    let link = document.querySelector("link[rel~='icon']");
    const before = link?.getAttribute('href') ?? null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = icon;
    return () => {
      if (before === null) link.remove();
      else link.setAttribute('href', before);
    };
  }, [icon]);
}
