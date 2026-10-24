// Services: pages people sign up on, and pay on when the service is paid.
// They're created in the Services tab and picked here as the funnel's registration page.
// One service can be used by any number of funnels.
//
// Mock data until the real services API is wired up.
import { mockAccount } from './myPage';
import { formatMoney, payAmount } from './contractPricing';
import { asCallContract, callContracts } from './callContracts';
import { ownerOf } from './tiedProducts';

// Contracts made or edited on the contract screen (ContractEditor.jsx) are
// kept in this browser and listed alongside these.
//   price: what people pay in the main currency, 0 = free (the list and pickers show this)
//   currency: the main price's currency, 'INR' when missing
//   type: 'onetime' | 'subscription' | 'free'
//   status: 'active' | 'inactive' (inactive ones can't be picked)
//   createdAt: used to show the newest first
//   signups: how many people have signed up (sample ones only, for the
//            mock; see contractSignups.js)
// and, from the contract screen (missing on older ones: see contractOf):
//   cover: the cover image (a data URL for now), or null
//   description: plain text; a blank line between paragraphs
//   prices: every price, the main one first, and gst: see contractPricing.js
//   questions: what checkout asks after name, email and phone (callQuestions.js shape)
//   success: what happens after they pay
//     { buttonLabel, buttonUrl, redirectUrl, redirectDelay }
//     buttonUrl ''  → no button on the success page
//     redirectUrl '' → they stay on it
//     redirectDelay: seconds on the success page before the redirect (0 = straight away)

// Where "Create a new contract" goes from other screens (opens in a new tab).
export const CREATE_SERVICE_URL = '?mock=create-service';

// Set to false to see the picker with no services at all
// (services you create on the mock page still show)
const SHOW_SAMPLE_SERVICES = false;

const CREATED_KEY = 'pagebuilder:mock-services';

// Changes to contracts, kept in this browser so they work for the
// sample services too: { [id]: { ...edited fields, deleted?: true } }
const CHANGES_KEY = 'pagebuilder:mock-service-changes';

// A contract's own screen, in a new tab (from a 1:1 call's "View contract")
export const contractEditUrl = (id) => `?mock=create-service&service=${encodeURIComponent(id)}`;

export const mockServices = [
  {
    id: 'svc-vasthu-webinar-nov',
    title: 'Fix the Vasthu Mistakes That Block Money – Live Webinar',
    price: 99,
    type: 'onetime',
    startDate: '2026-10-28',
    status: 'active',
    createdAt: '2026-10-10',
    signups: 38,
  },
  {
    id: 'svc-vasthu-qa',
    title: 'Free Vasthu Q&A Session',
    price: 0,
    type: 'free',
    startDate: '2026-10-21',
    status: 'active',
    createdAt: '2026-10-02',
    signups: 112,
  },
  {
    id: 'svc-money-corner',
    title: 'Money Corner Masterclass',
    price: 499,
    type: 'onetime',
    startDate: '2026-09-14',
    status: 'active',
    createdAt: '2026-08-30',
    signups: 64,
  },
  {
    id: 'svc-vasthu-circle',
    title: 'Monthly Vasthu Circle',
    price: 299,
    type: 'subscription',
    startDate: '2026-08-01',
    status: 'active',
    createdAt: '2026-07-20',
    signups: 27,
  },
  {
    id: 'svc-home-reset',
    title: 'Home Energy Reset – 21 Day Program',
    price: 4999,
    type: 'onetime',
    startDate: '2026-07-05',
    status: 'active',
    createdAt: '2026-06-18',
    signups: 19,
  },
  {
    id: 'svc-consultation',
    title: '1:1 Vasthu Consultation for Your Home',
    price: 2500,
    type: 'onetime',
    startDate: '2026-05-01',
    status: 'active',
    createdAt: '2026-04-22',
    signups: 46,
  },
  {
    id: 'svc-new-home-checklist',
    title: 'Moving Into a New Home? Free Vasthu Checklist Walkthrough',
    price: 0,
    type: 'free',
    startDate: '2026-03-12',
    status: 'active',
    createdAt: '2026-03-01',
    signups: 203,
  },
  {
    id: 'svc-diwali-2025',
    title: 'Diwali Vasthu Workshop 2025',
    price: 199,
    type: 'onetime',
    startDate: '2025-10-18',
    status: 'active',
    createdAt: '2025-10-01',
    signups: 141,
  },
];

// Services made on the mock create page, from this browser's storage
function loadCreated() {
  try {
    const list = JSON.parse(localStorage.getItem(CREATED_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((s) => s && typeof s.id === 'string') : [];
  } catch {
    return [];
  }
}

function loadChanges() {
  try {
    const changes = JSON.parse(localStorage.getItem(CHANGES_KEY) ?? '{}');
    return changes && typeof changes === 'object' && !Array.isArray(changes) ? changes : {};
  } catch {
    return {};
  }
}

// Every service with this browser's edits on it, less the deleted ones.
// A 1:1 call's contract shows its call's values, with callId saying which
// call it follows (callContracts.js): the call is where it's changed.
function allServices() {
  const changes = loadChanges();
  const byCall = callContracts();
  return [...(SHOW_SAMPLE_SERVICES ? mockServices : []), ...loadCreated()]
    .filter((s) => !changes[s.id]?.deleted)
    .map((s) => {
      const { deleted, ...edits } = changes[s.id] ?? {}; // eslint-disable-line no-unused-vars
      const service = { ...s, ...edits };
      return byCall[s.id] ? asCallContract(service, byCall[s.id]) : service;
    });
}

// A contract a 1:1 call owns (see callContracts.js): only that call changes it
export const isCallContract = (service) => Boolean(service?.callId);

// Saves one service's change. Returns true if it saved.
function saveChange(id, change) {
  const changes = loadChanges();
  changes[id] = { ...changes[id], ...change };
  try {
    localStorage.setItem(CHANGES_KEY, JSON.stringify(changes));
    return true;
  } catch {
    return false;
  }
}

// Every service, newest first (the Contracts page)
export function getAllServices() {
  return allServices().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Removes a service for good. Returns true if it saved.
// The Contracts page only does this when no 1:1 call or webinar uses it (see tiedProducts.js).
export function deleteService(id) {
  return saveChange(id, { deleted: true });
}

// Services that can be picked, newest first. Not a 1:1 call's own
// contract: it belongs to that call, and sharing it would undo that.
// Reads storage each time, so a service made in another tab shows up.
export function getServices() {
  return allServices()
    .filter((s) => s.status === 'active' && !isCallContract(s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// One service by id (inactive ones too, so a funnel that uses one still shows it), or null
export function getService(id) {
  if (!id) return null;
  return allServices().find((s) => s.id === id) ?? null;
}

// Mock create page: saves a new active service. Returns it, or null if storage failed.
export function createMockService({ title, price }) {
  const now = new Date();
  const amount = Math.max(0, Number(price) || 0);
  const service = {
    id: `svc-${now.getTime().toString(36)}`,
    title: String(title).trim(),
    price: amount,
    type: amount > 0 ? 'onetime' : 'free',
    startDate: now.toISOString().slice(0, 10),
    status: 'active',
    createdAt: now.toISOString(),
  };
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify([...loadCreated(), service]));
    return service;
  } catch {
    return null;
  }
}

// Change a service made in this browser (title and price only).
// Returns the updated service, or null if it isn't one of ours or storage failed.
export function updateMockService(id, { title, price }) {
  const list = loadCreated();
  const i = list.findIndex((s) => s.id === id);
  if (i === -1) return null;
  const amount = Math.max(0, Number(price) || 0);
  list[i] = { ...list[i], title: String(title).trim(), price: amount, type: amount > 0 ? 'onetime' : 'free' };
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify(list));
    return list[i];
  } catch {
    return null;
  }
}

// "Free", "₹499" or "₹299/month"
export function servicePrice(service) {
  if (!service || service.price === 0 || service.type === 'free') return 'Free';
  const amount = formatMoney(service.price, service.currency ?? 'INR');
  return service.type === 'subscription' ? `${amount}/month` : amount;
}

// "28 Oct 2026"
export function serviceDate(service) {
  const date = new Date(`${service.startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ------------------------------------------------------------
// The contract screen (ContractEditor.jsx)
// ------------------------------------------------------------

// Seconds on the success page before the redirect: they pick one
export const REDIRECT_DELAYS = [0, 1, 2, 3, 5];
export const DEFAULT_REDIRECT_DELAY = 2;

// The success page's button starts as "Login now", to the creator's own site
export const creatorSiteUrl = () => `https://${mockAccount.domain}`;

export const DEFAULT_SUCCESS = {
  buttonLabel: 'Login now',
  buttonUrl: creatorSiteUrl(),
  redirectUrl: '',
  redirectDelay: DEFAULT_REDIRECT_DELAY,
};

const DEFAULT_BUTTON = { buttonLabel: DEFAULT_SUCCESS.buttonLabel, buttonUrl: DEFAULT_SUCCESS.buttonUrl };

// A contract with every field the contract screen uses, filled in for ones
// made before it existed
export function contractOf(service) {
  const saved = service.success && typeof service.success === 'object' ? service.success : {};
  // The old default ("Continue" with no link) becomes the new one
  const success = saved.buttonLabel === 'Continue' && !saved.buttonUrl ? { ...saved, ...DEFAULT_BUTTON } : saved;
  const prices =
    Array.isArray(service.prices) && service.prices.length > 0
      ? service.prices
      : [{ currency: service.currency ?? 'INR', price: Number(service.price) || 0, discount: null }];
  return {
    ...service,
    prices,
    gst: { enabled: Boolean(service.gst?.enabled), included: Boolean(service.gst?.included) },
    cover: typeof service.cover === 'string' && service.cover ? service.cover : null,
    description: typeof service.description === 'string' ? service.description : '',
    questions: Array.isArray(service.questions) ? service.questions : [],
    success: {
      ...DEFAULT_SUCCESS,
      ...success,
      redirectDelay: REDIRECT_DELAYS.includes(success.redirectDelay) ? success.redirectDelay : DEFAULT_REDIRECT_DELAY,
    },
  };
}

// The fields the contract screen saves, tidied
function contractFields({ title, cover, description, type, prices, gst, questions, success }) {
  const free = type === 'free';
  const list = free
    ? []
    : (Array.isArray(prices) ? prices : []).map((p) => ({
        currency: p.currency,
        price: Math.max(0, Math.round(Number(p.price) || 0)),
        discount: p.discount != null && Number(p.discount) > 0 ? Math.round(Number(p.discount)) : null,
      }));
  const main = list[0];
  return {
    title: String(title ?? '').trim(),
    cover: cover || null,
    description: String(description ?? '').trim(),
    // Only one-time and free are made here; a monthly one keeps its type
    type: free ? 'free' : type === 'subscription' ? 'subscription' : 'onetime',
    price: main ? payAmount(main) : 0,
    currency: main?.currency ?? 'INR',
    prices: list,
    gst: { enabled: !free && Boolean(gst?.enabled), included: Boolean(gst?.included) },
    questions: Array.isArray(questions) ? questions : [],
    success: { ...DEFAULT_SUCCESS, ...success },
  };
}

// A new contract from the contract screen. Returns it, or null if storage failed.
export function createContract(fields) {
  const now = new Date();
  const contract = {
    id: `svc-${now.getTime().toString(36)}`,
    ...contractFields(fields),
    startDate: now.toISOString().slice(0, 10),
    status: 'active',
    createdAt: now.toISOString(),
  };
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify([...loadCreated(), contract]));
    return contract;
  } catch {
    return null;
  }
}

// Saves an edited contract (sample or made here). Returns true if it saved.
// A contract a 1:1 call or a webinar owns isn't saved here: that call or
// webinar is where it changes (ownerOf in tiedProducts.js). A webinar
// saves its own through saveWebinarContract.
export function updateContract(id, fields) {
  if (ownerOf(getService(id))) return false;
  return saveChange(id, contractFields(fields));
}
// ------------------------------------------------------------
// A webinar's sign-up page. Every webinar makes its own contract from
// its event details and price; the coach never picks one. The contract
// remembers which webinar made it (webinarId), so only that webinar
// ever changes it, and a contract picked by hand on an older webinar is
// left as it was.
//
// fields: title, description, type ('free' | 'onetime'), prices (see contractPricing.js)
// startDate: the webinar's date, YYYY-MM-DD
// Returns the contract's id, or null if storage failed.
// ------------------------------------------------------------
export function saveWebinarContract({ webinarId, contractId, fields, startDate }) {
  const existing = contractId ? getService(contractId) : null;
  if (existing && existing.webinarId === webinarId) {
    // Keep what the coach set on the contract screen (cover, questions,
    // GST, after payment); the webinar only owns what it asks about
    const merged = contractFields({ ...contractOf(existing), ...fields });
    return saveChange(contractId, { ...merged, startDate: startDate || existing.startDate }) ? contractId : null;
  }
  const now = new Date();
  const contract = {
    id: `svc-${now.getTime().toString(36)}`,
    ...contractFields({ ...fields, success: DEFAULT_SUCCESS }),
    webinarId,
    startDate: startDate || now.toISOString().slice(0, 10),
    status: 'active',
    createdAt: now.toISOString(),
  };
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify([...loadCreated(), contract]));
    return contract.id;
  } catch {
    return null;
  }
}