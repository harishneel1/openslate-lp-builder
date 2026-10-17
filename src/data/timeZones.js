// ------------------------------------------------------------
// Time zones offered in the booking page's picker. Most clients
// are in India; the rest cover where Indian creators' clients
// abroad usually are. The visitor's own zone is added if it
// isn't here. Add a line to offer another one.
// ------------------------------------------------------------
export const timeZones = [
  { id: 'Asia/Kolkata', name: 'India' },
  { id: 'Asia/Dubai', name: 'UAE' },
  { id: 'Asia/Singapore', name: 'Singapore' },
  { id: 'Europe/London', name: 'UK' },
  { id: 'Europe/Berlin', name: 'Central Europe' },
  { id: 'America/New_York', name: 'US Eastern' },
  { id: 'America/Chicago', name: 'US Central' },
  { id: 'America/Los_Angeles', name: 'US Pacific' },
  { id: 'Australia/Sydney', name: 'Australia Eastern' },
];

// Browsers name some zones differently ('Asia/Calcutta' for 'Asia/Kolkata'),
// so compare them the way the browser itself does
const canonical = (zone) => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

// A zone → the one from our list it equals, the zone itself if it's
// valid but not listed, or null if it isn't a real zone
export function matchZone(zone) {
  if (!zone) return null;
  const key = canonical(zone);
  if (!key) return null;
  return timeZones.find((z) => canonical(z.id) === key)?.id ?? zone;
}

// 'GMT+5:30' at that moment (it changes with daylight saving)
function offset(zone, now) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value;
  return !part || part === 'GMT' ? 'GMT+0' : part;
}

// 'GMT+5:30' → 330, for sorting
function offsetMinutes(label) {
  const m = label.match(/GMT([+-])(\d+)(?::(\d+))?/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

// The picker's options, west to east, each { id, label: 'India (Kolkata), GMT+5:30' }
export function zoneOptions(current, now = new Date()) {
  const list = timeZones.some((z) => z.id === current) ? timeZones : [...timeZones, { id: current, name: null }];
  return list
    .map(({ id, name }) => {
      const city = id.split('/').pop().replace(/_/g, ' ');
      const place = !name ? city : name === city ? name : `${name} (${city})`;
      const off = offset(id, now);
      return { id, label: `${place}, ${off}`, minutes: offsetMinutes(off) };
    })
    .sort((a, b) => a.minutes - b.minutes)
    .map(({ id, label }) => ({ id, label }));
}