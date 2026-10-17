import { buildProfileJson } from './buildProfileJson';
import { getMockProfile } from './mockProfile';
import { zoneOptions } from './timeZones';
import { formatTime, zoned } from '../utils/slots';

// ------------------------------------------------------------
// Everything the confirmation page shows. In the real product
// this is the saved booking, loaded by its id; here it's
// rebuilt from the details checkout put in the URL.
//
// Returns null when the call or the time can't be found.
// ------------------------------------------------------------

// A made-up but stable meeting code for the mock, e.g. 'kqm-rbtw-zpa'
function mockMeetingCode(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const letters = 'abcdefghijkmnopqrstuvwxyz';
  const pick = (n) => Array.from({ length: n }, (_, i) => letters[(h >> (i * 2 + n)) % letters.length]).join('');
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

export function buildBookedJson({ serviceId, time, timeZone, profileState }) {
  const raw = getMockProfile(profileState);
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

  return {
    id: `booking-${serviceId}-${ms}`,
    creator: { name, firstName, initials, photo },
    service,
    format, // 'video' | 'phone'
    meetingLink: format === 'phone' ? null : `https://meet.google.com/${mockMeetingCode(`${serviceId}${ms}`)}`,
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