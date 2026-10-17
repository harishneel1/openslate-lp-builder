// ------------------------------------------------------------
// Every kind of service the profile page knows how to show.
// Adding a kind (packages, courses...) means adding one entry
// here; the cards, tabs and page pick it up from this list.
//
//   label:   the filter tab ("1:1 calls")
//   title:   the section heading when it's the only kind on offer
//   cta:     the card's button
//   facts:   the small details on the card, as { icon, text }.
//            icon is a name ServiceCard maps to a picture.
//   href:    where the card goes (placeholders until those pages exist)
//
// The order here is the order of the tabs.
// ------------------------------------------------------------

const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// 15 → "15 min", 60 → "1 hr", 75 → "1 hr 15 min"
function duration(mins) {
  const m = count(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

// A date and time in the visitor's own time zone: "Sun, 2 Nov, 7:00 pm"
function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date to be announced';
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const link = (page, id) => `?mock=${page}&service=${encodeURIComponent(id)}`;

export const serviceKinds = [
  {
    id: 'call',
    label: '1:1 calls',
    title: 'Book a call',
    cta: 'Pick a time',
    facts: (s) => [
      s.format === 'phone'
        ? { icon: 'phone', text: 'Phone call' }
        : { icon: 'video', text: 'Video call' },
      { icon: 'clock', text: duration(s.durationMins) },
    ],
    href: (s) => link('book', s.id),
  },
  {
    id: 'dm',
    label: 'Priority DMs',
    title: 'Ask a question',
    cta: 'Ask a question',
    facts: (s) => [
      { icon: 'clock', text: `Reply within ${plural(count(s.replyWithinDays) || 1, 'day', 'days')}` },
    ],
    href: (s) => link('ask', s.id),
  },
  {
    id: 'webinar',
    label: 'Webinars',
    title: 'Join a live session',
    cta: 'Save my seat',
    facts: (s) => [
      { icon: 'calendar', text: when(s.startsAt) },
      { icon: 'clock', text: duration(s.durationMins) },
    ],
    href: (s) => link('webinar', s.id), // placeholder: no webinar page yet
  },
  {
    id: 'course',
    label: 'Courses',
    title: 'Courses',
    cta: 'View course',
    facts: (s) => [
      { icon: 'lessons', text: plural(count(s.lessonCount) || 1, 'lesson', 'lessons') },
      { icon: 'clock', text: duration(s.totalMins) },
    ],
    href: (s) => link('course', s.id), // placeholder: no course page yet
  },
];

// One kind by id, or null for kinds this page doesn't know (they aren't shown)
export function getServiceKind(id) {
  return serviceKinds.find((k) => k.id === id) ?? null;
}