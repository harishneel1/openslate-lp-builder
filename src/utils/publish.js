// Publishing a funnel.
//
// There's no hosting yet, so "publishing" means: the funnel gets a publishedAt
// time and a slug, and its live link points at the preview of its landing page.
// When real hosting arrives, only liveHref() needs to change (e.g. to
// `https://<their-site>/${funnel.slug}`); everything else already uses it.

// "Fix the Vasthu mistakes that block money…" → "fix-the-vasthu-mistakes-that-block"
// taken: slugs their other funnels already use, so two funnels never share one.
export function makeSlug(headline, taken = []) {
  const words = String(headline ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // é → e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  // Up to 6 words, and never longer than 50 characters
  let base = '';
  for (const word of words.slice(0, 6)) {
    const next = base ? `${base}-${word}` : word;
    if (next.length > 50) break;
    base = next;
  }
  if (!base) base = 'webinar';

  let slug = base;
  for (let n = 2; taken.includes(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

export const isPublished = (funnel) => Boolean(funnel?.publishedAt);

// The link they share. Full address, so it works when pasted anywhere:
// http://localhost:5173/fix-the-vasthu-mistakes. The slug belongs to the
// whole webinar (every session shares it), so the link stays the same when
// they add a session: it opens whichever session is current (currentRun in
// data/webinar.js; main.jsx reads the address). Without a slug (not
// published yet), ?go=<id> does the same; any session's id works there.
// When real hosting arrives, only the origin here changes.
export function liveHref(funnel) {
  const { origin, pathname } = window.location;
  if (funnel.slug) return `${origin}/${encodeURIComponent(funnel.slug)}`;
  return `${origin}${pathname}?go=${encodeURIComponent(funnel.seriesId ?? funnel.id)}`;
}

// One run's own pages, for places that are about that date alone (its
// sign-up page in Contracts, the ended page's "Sign up for Sat 7 Nov",
// the coach's previews)
export function runHref(funnel) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?preview=${encodeURIComponent(funnel.id)}`;
}

// "Live since 14 Oct"
export function liveSince(timestamp) {
  return `Link since ${new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}