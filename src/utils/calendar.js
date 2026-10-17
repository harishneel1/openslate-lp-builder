// ------------------------------------------------------------
// "Add to calendar": a Google Calendar link. Times are UTC
// instants, so the calendar shows them on its own clock.
// (An .ics file for Apple Calendar and Outlook can come later.)
// ------------------------------------------------------------

// 1760880600000 → '20251019T133000Z'
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Opens Google Calendar with the event filled in, ready to save
export function googleCalendarUrl({ title, start, end, details, location }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details,
    location: location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}