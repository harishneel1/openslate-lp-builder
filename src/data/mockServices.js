// Services: pages people sign up on, and pay on when the service is paid.
// They're created in the Services tab and picked here as the funnel's registration page.
// One service can be used by any number of funnels.
//
// Mock data until the real services API is wired up.
// Services made on the mock "Create service" page (?mock=create-service)
// are kept in this browser and listed alongside these.
//   price: in rupees, 0 = free
//   type: 'onetime' | 'subscription' | 'free'
//   status: 'active' | 'inactive' (inactive ones can't be picked)
//   createdAt: used to show the newest first

// Where "Create a new service" goes. Swap for the real Services page.
export const CREATE_SERVICE_URL = '?mock=create-service';

// Set to false to see the picker with no services at all
// (services you create on the mock page still show)
const SHOW_SAMPLE_SERVICES = true;

const CREATED_KEY = 'pagebuilder:mock-services';

export const mockServices = [
  {
    id: 'svc-vasthu-webinar-nov',
    title: 'Fix the Vasthu Mistakes That Block Money – Live Webinar',
    price: 99,
    type: 'onetime',
    startDate: '2026-10-28',
    status: 'active',
    createdAt: '2026-10-10',
  },
  {
    id: 'svc-vasthu-qa',
    title: 'Free Vasthu Q&A Session',
    price: 0,
    type: 'free',
    startDate: '2026-10-21',
    status: 'active',
    createdAt: '2026-10-02',
  },
  {
    id: 'svc-money-corner',
    title: 'Money Corner Masterclass',
    price: 499,
    type: 'onetime',
    startDate: '2026-09-14',
    status: 'active',
    createdAt: '2026-08-30',
  },
  {
    id: 'svc-vasthu-circle',
    title: 'Monthly Vasthu Circle',
    price: 299,
    type: 'subscription',
    startDate: '2026-08-01',
    status: 'active',
    createdAt: '2026-07-20',
  },
  {
    id: 'svc-home-reset',
    title: 'Home Energy Reset – 21 Day Program',
    price: 4999,
    type: 'onetime',
    startDate: '2026-07-05',
    status: 'active',
    createdAt: '2026-06-18',
  },
  {
    id: 'svc-consultation',
    title: '1:1 Vasthu Consultation for Your Home',
    price: 2500,
    type: 'onetime',
    startDate: '2026-05-01',
    status: 'active',
    createdAt: '2026-04-22',
  },
  {
    id: 'svc-new-home-checklist',
    title: 'Moving Into a New Home? Free Vasthu Checklist Walkthrough',
    price: 0,
    type: 'free',
    startDate: '2026-03-12',
    status: 'active',
    createdAt: '2026-03-01',
  },
  {
    id: 'svc-diwali-2025',
    title: 'Diwali Vasthu Workshop 2025',
    price: 199,
    type: 'onetime',
    startDate: '2025-10-18',
    status: 'inactive',
    createdAt: '2025-10-01',
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

function allServices() {
  return [...(SHOW_SAMPLE_SERVICES ? mockServices : []), ...loadCreated()];
}

// Services that can be picked, newest first.
// Reads storage each time, so a service made in another tab shows up.
export function getServices() {
  return allServices()
    .filter((s) => s.status === 'active')
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
  const amount = `₹${service.price.toLocaleString('en-IN')}`;
  return service.type === 'subscription' ? `${amount}/month` : amount;
}

// "28 Oct 2026"
export function serviceDate(service) {
  const date = new Date(`${service.startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}