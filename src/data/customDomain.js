import { useSyncExternalStore } from 'react';

// ------------------------------------------------------------
// The coach's custom domain (Settings → Custom domain,
// CustomDomainSettings.jsx). One per coach, and a subdomain only:
// academy.harishneel.com, not harishneel.com.
//
// Everything here is a stand-in. The real backend checks DNS, issues the
// SSL certificate and moves the status on; this keeps the domain and its
// status in this browser so every state can be seen.
//
// Status, in order:
//   none      Not connected: nothing entered yet
//   checking  Checking DNS: waiting to find their CNAME record
//   ssl       Issuing SSL: the record's found, the certificate is on its way
//   live      Live
//   error     Something's wrong: `error` says what (ERRORS)
//
// Links aren't changed by any of this yet: the developers point them at
// the domain once it's live.
// ------------------------------------------------------------

// Where links live without a custom domain
export const DEFAULT_DOMAIN = 'app.openslate.ai';
// What their CNAME record points to
export const CNAME_TARGET = 'domains.openslate.ai';

export const STATUS_LABELS = {
  none: 'Not connected',
  checking: 'Checking DNS',
  ssl: 'Issuing SSL',
  live: 'Live',
  error: 'Needs attention',
};

// What can go wrong, in plain words, with the one thing to do about it.
// action: what the error's button does ('verify' checks again, 'remove'
// clears the domain so they can enter another one)
export const ERRORS = {
  'not-found': {
    label: 'Record not found',
    title: 'We can’t find the record yet',
    fix: 'Check it’s added exactly as below. New records can take a few hours to show up.',
    action: 'verify',
  },
  'wrong-target': {
    label: 'Points elsewhere',
    title: 'The record points somewhere else',
    fix: `Change its value to ${CNAME_TARGET}.`,
    action: 'verify',
  },
  proxied: {
    label: 'Cloudflare proxy on',
    title: 'Cloudflare’s proxy is on',
    fix: 'In Cloudflare, click the orange cloud next to the record so it turns grey (DNS only).',
    action: 'verify',
  },
  taken: {
    label: 'Already in use',
    title: 'This domain is used by another account',
    fix: 'Use a different subdomain, or contact us if it’s yours.',
    action: 'remove',
  },
  'ssl-failed': {
    label: 'SSL failed',
    title: 'We couldn’t secure your domain',
    fix: 'Make sure the record is still there, then try again.',
    action: 'verify',
  },
};

// Endings where the domain's own name is two parts (harishneel.co.in), so
// academy.harishneel.co.in is still a subdomain
const TWO_PART_ENDINGS = new Set([
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in', 'edu.in', 'gov.in',
  'co.uk', 'org.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'com.sg', 'com.my',
  'co.za', 'com.br', 'co.jp', 'com.mx', 'com.ae',
]);

// Cleans what they typed: "https://Academy.HarishNeel.com/" → "academy.harishneel.com"
export function cleanDomain(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.$/, '');
}

// The part before their main domain: "academy" for academy.harishneel.com.
// It's the Name of their CNAME record.
export function recordName(domain) {
  const labels = domain.split('.');
  const ending = labels.slice(-2).join('.');
  const rootSize = TWO_PART_ENDINGS.has(ending) ? 3 : 2;
  return labels.slice(0, -rootSize).join('.');
}

// The main domain: harishneel.com for academy.harishneel.com
export function rootOf(domain) {
  const name = recordName(domain);
  return name ? domain.slice(name.length + 1) : domain;
}

// Checks what they typed. { domain } when it can be used, or { error }.
export function checkDomain(text) {
  const domain = cleanDomain(text);
  if (!domain) return { error: 'Enter a domain, like academy.yourdomain.com' };
  const labels = domain.split('.');
  const label = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (labels.length < 2 || !labels.every((l) => label.test(l)) || !/^[a-z]{2,}$/.test(labels.at(-1))) {
    return { error: 'That doesn’t look like a domain. Try academy.yourdomain.com' };
  }
  if (domain === 'openslate.ai' || domain.endsWith('.openslate.ai')) {
    return { error: 'Use your own domain, not an openslate.ai one' };
  }
  if (!recordName(domain)) return { error: `Use a subdomain, like academy.${domain}` };
  if (recordName(domain) === 'www') return { error: `Use a subdomain other than www, like academy.${rootOf(domain)}` };
  return { domain };
}

// ---------- The saved state ----------
const KEY = 'customDomain';
const CHANGED = 'custom-domain-changed';
const EMPTY = { domain: null, status: 'none', error: null, checkedAt: null };

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
  cache = next.domain ? next : EMPTY;
  try {
    if (next.domain) localStorage.setItem(KEY, JSON.stringify(cache));
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

// { domain, status, error, checkedAt }, and updates when it changes
export function useCustomDomain() {
  return useSyncExternalStore(subscribe, read);
}

export const customDomain = () => read();

// ---------- What the coach does ----------
// Connect: starts checking DNS
export function connectDomain(domain) {
  write({ domain, status: 'checking', error: null, checkedAt: null });
}

// Remove: back to Not connected
export function removeDomain() {
  write(EMPTY);
}

// Verify now: what the backend's check finds (mocked). By default each
// check moves one step on: Checking DNS → Issuing SSL → Live. The
// prototype controls can make the next check fail instead (setNextCheck).
export function verifyDomain() {
  const now = read();
  if (!now.domain || now.status === 'live') return;
  const outcome = nextCheck;
  nextCheck = 'pass';
  window.dispatchEvent(new Event(CHANGED));
  const checkedAt = Date.now();
  if (outcome !== 'pass') {
    write({ ...now, status: 'error', error: outcome, checkedAt });
    return;
  }
  // From an error: a DNS problem fixed goes on to SSL; an SSL one fixed goes live
  const status =
    now.status === 'checking' ? 'ssl'
      : now.status === 'ssl' ? 'live'
        : now.error === 'ssl-failed' ? 'live'
          : 'ssl';
  write({ ...now, status, error: null, checkedAt });
}

// What the value of their record is now, for "points somewhere else" (mocked)
export const FOUND_VALUE = 'ghs.googlehosted.com';

// ---------- Prototype controls ----------
let nextCheck = 'pass';
export const nextCheckOutcome = () => nextCheck;
export function setNextCheck(outcome) {
  nextCheck = outcome;
  window.dispatchEvent(new Event(CHANGED));
}

export const domainDemo = {
  // Jump straight to a status, with a sample domain if none is entered
  setStatus(status, error = null) {
    if (status === 'none') return removeDomain();
    const now = read();
    write({
      domain: now.domain || 'academy.harishneel.com',
      status,
      error: status === 'error' ? error : null,
      checkedAt: status === 'checking' ? null : Date.now(),
    });
  },
};

// Subscribes to the next-check switch too, so the controls redraw
export function useNextCheck() {
  return useSyncExternalStore(subscribe, nextCheckOutcome);
}
