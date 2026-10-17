import { initials } from '../utils/initials';
import { serviceKinds, getServiceKind } from './serviceKinds';

// ------------------------------------------------------------
// Turns the raw profile data into the page JSON the profile
// page renders from. Every formatting and show/hide rule lives
// here, so the components stay simple and the real codebase
// has one place to copy the rules from.
// ------------------------------------------------------------

// Below this many ratings an average looks unreliable, so it isn't shown
const MIN_RATINGS = 3;

const text = (v) => String(v ?? '').trim();
const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;

// "2026-08-24" → "24 Aug 2026". Built from parts so the day never shifts with time zones.
function formatDate(date) {
  const [y, m, d] = text(date).split('-').map(Number);
  const value = new Date(y, m - 1, d);
  return Number.isNaN(value.getTime())
    ? text(date)
    : value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// { value: '4.9', count: 21 }, or null when there aren't enough ratings yet
function rating(value, ratingCount) {
  const n = count(ratingCount);
  return n >= MIN_RATINGS && Number.isFinite(value) ? { value: value.toFixed(1), count: n } : null;
}

// The crossed-out price only shows when it's higher than a paid price
function price(service) {
  const amount = count(service.price);
  const compare = count(service.comparePrice);
  return {
    isFree: amount === 0,
    amount, // rupees, for checkout's sums
    label: amount === 0 ? 'Free' : rupees(amount),
    compare: amount > 0 && compare > amount ? rupees(compare) : null,
  };
}

// Same shape for every kind, so the card never needs to know which kind it is
function buildService(s) {
  const kind = getServiceKind(s.kind);
  return {
    id: s.id,
    kind: kind.id,
    title: text(s.title),
    description: text(s.description),
    // Longer text for the service's own page (optional)
    about: (Array.isArray(s.about) ? s.about.map(text).filter(Boolean) : []).length
      ? s.about.map(text).filter(Boolean)
      : [text(s.description)].filter(Boolean),
    facts: kind.facts(s),
    cta: kind.cta,
    price: price(s),
    rating: rating(s.rating, s.ratingCount),
    image: text(s.image) || null,
    href: kind.href(s),
  };
}

// The filter tabs: only kinds this creator offers, in serviceKinds order
function buildKinds(services) {
  return serviceKinds
    .map((k) => ({
      id: k.id,
      label: k.label,
      title: k.title,
      count: services.filter((s) => s.kind === k.id).length,
    }))
    .filter((k) => k.count > 0);
}

// Only the numbers worth showing, so a brand-new creator gets none
function buildStats(creator, reviewCount) {
  const stats = [];
  const r = rating(creator.rating, creator.ratingCount);
  if (r) stats.push({ id: 'rating', value: r.value, label: `from ${r.count} ratings` });
  const bookings = count(creator.bookingCount);
  if (bookings) stats.push({ id: 'bookings', value: String(bookings), label: bookings === 1 ? 'booking' : 'bookings' });
  if (reviewCount) stats.push({ id: 'reviews', value: String(reviewCount), label: reviewCount === 1 ? 'review' : 'reviews' });
  return stats;
}

export function buildProfileJson({ creator, services, testimonials }) {
  const live = (Array.isArray(services) ? services : [])
    .filter((s) => s && s.status === 'active' && getServiceKind(s.kind) && text(s.title))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const titles = Object.fromEntries(live.map((s) => [s.id, text(s.title)]));

  const reviews = (Array.isArray(testimonials) ? testimonials : [])
    .filter((t) => t && text(t.text))
    // Pinned first, then newest
    .sort(
      (a, b) =>
        Number(b.pinned === true) - Number(a.pinned === true) || text(b.date).localeCompare(text(a.date)),
    )
    .map((t) => ({
      id: t.id,
      name: text(t.name) || 'Anonymous',
      initials: initials(t.name),     // '' when anonymous: show an icon instead
      text: text(t.text),
      date: formatDate(t.date),
      serviceId: t.serviceId,
      service: titles[t.serviceId] ?? null, // null if that service is no longer offered
      pinned: t.pinned === true,
    }));

  const name = text(creator?.name);

  return {
    creator: {
      name,
      initials: initials(name),
      photo: text(creator?.photo) || null,
      headline: text(creator?.headline),
      bio: text(creator?.bio),
      stats: buildStats(creator ?? {}, reviews.length),
    },
    services: live.map(buildService),
    kinds: buildKinds(live),
    testimonials: reviews,
  };
}