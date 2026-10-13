// Services: pages people sign up on, and pay on when the service is paid.
// They're created in the Services tab and picked here as the funnel's registration page.
// One service can be used by any number of funnels.
//
// Mock data until the real services API is wired up.
//   price: in rupees, 0 = free
//   type: 'onetime' | 'subscription' | 'free'
//   status: 'active' | 'inactive' (inactive ones can't be picked)
//   createdAt: used to show the newest first

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

// Services that can be picked, newest first
export function getServices() {
  return mockServices
    .filter((s) => s.status === 'active')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// One service by id (inactive ones too, so a funnel that uses one still shows it), or null
export function getService(id) {
  if (!id) return null;
  return mockServices.find((s) => s.id === id) ?? null;
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