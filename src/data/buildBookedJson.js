import { buildProfileJson } from './buildProfileJson';
import { getMockProfile } from './mockProfile';
import { getMyProfile, isMyCall } from './myProfile';
import { getBooking } from './bookingsStore';
import { readMeetingLink } from './callDetails';
import { zoneOptions } from './timeZones';
import { formatTime, zoned } from '../utils/slots';

// ------------------------------------------------------------
// Everything the confirmation page shows. In the real product
// this is the saved booking, loaded by its id; here it's
// rebuilt from the details checkout put in the URL, plus, for the
// creator's own calls, the booking checkout saved (bookingId),
// with the creator's meeting link.
//
// Returns null when the call or the time can't be found.
// ------------------------------------------------------------

// A made-up but stable meeting code for the mock, e.g. 'kqm-rbtw-zpa'
function mockMeetingCode(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const letters = 'abcdefghijkmnopqrstuvwxyz';
  const pick = (n) => Array.from({ length: n }, (_, i) => letters[(h >>> (i * 2 + n)) % letters.length]).join('');
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

export function buildBookedJson({ serviceId, time, timeZone, profileState, bookingId = null }) {
  const mine = isMyCall(serviceId);
  const raw = mine ? getMyProfile() : getMockProfile(profileState);
  const page = buildProfileJson(raw);
  const service = page.services.find((s) => s.id === serviceId && s.kind === 'call');
  const ms = Date.parse(time);
  if (!service || !Number.isFinite(ms)) return null;

  const { durationMins, format } = raw.services.find((s) => s.id === serviceId);
  const end = ms + durationMins * 60_000;

  const z = zoned(ms, timeZone);
  const [y, m, d] = z.date.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const part = (opts) => date.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

  const { name, firstName = name.split(' ')[0], initials, photo } = page.creator;

  // Their own call: the link saved with the booking (their meeting link).
  // Meera's demo calls: a made-up Meet link, as before.
  const saved = mine ? getBooking(bookingId) : null;
  const meetingLink = mine
    ? (saved?.meetingLink ?? null)
    : format === 'phone'
      ? null
      : `https://meet.google.com/${mockMeetingCode(`${serviceId}${ms}`)}`;

  return {
    id: saved?.id ?? `booking-${serviceId}-${ms}`,
    creator: { name, firstName, initials, photo },
    service,
    format, // 'video' | 'phone'
    meetingLink, // null: a phone call (or, for a booking made before links were needed, none saved)
    meetingProvider: meetingLink ? readMeetingLink(meetingLink).provider : null, // 'Zoom', ... or null
    start: ms,
    end,
    weekday: part({ weekday: 'long' }),
    day: d,
    month: part({ month: 'short' }),
    monthLong: part({ month: 'long' }),
    time: formatTime(ms, timeZone),
    ends: formatTime(end, timeZone),
    zoneLabel: zoneOptions(timeZone).find((o) => o.id === timeZone)?.label ?? timeZone,
  };
}