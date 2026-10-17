import { buildBookingJson } from './buildBookingJson';
import { zoneOptions } from './timeZones';
import { formatTime } from '../utils/slots';

// ------------------------------------------------------------
// Everything the checkout page shows: the call, the coach, the
// chosen time, and whether that time can still be booked.
//
// status:
//   'ok'       show the form
//   'taken'    the time isn't free any more (or the link has no
//              valid time): send them back to pick another
//   'missing'  the call doesn't exist
//
// In the real product the server checks the time again when they
// pay, since someone else can take it in the meantime.
// ------------------------------------------------------------
export function buildCheckoutJson({ serviceId, time, profileState, slotsState, timeZone, taken = false, now = Date.now() }) {
  const base = buildBookingJson({ serviceId, profileState, slotsState, timeZone, now });
  const { creator, service, durationMins, availability } = base;
  if (!service) return { status: 'missing', creator, service: null, slot: null };

  const ms = Date.parse(time);
  const start = Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  const day = start && availability.days.find((d) => d.slots.some((s) => s.start === start));
  if (!day || taken) return { status: 'taken', creator, service, slot: null };

  const chosen = day.slots.find((s) => s.start === start);
  const zone = zoneOptions(timeZone).find((z) => z.id === timeZone);

  return {
    status: 'ok',
    creator,
    service,
    slot: {
      start,
      weekday: day.weekday,
      day: day.day,
      month: day.month,
      time: chosen.time,
      ends: formatTime(ms + durationMins * 60_000, timeZone),
      zoneLabel: zone?.label ?? timeZone,
    },
  };
}