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

// The link they share. Full address, so it works when pasted anywhere.
export function liveHref(funnel) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?preview=${encodeURIComponent(funnel.id)}`;
}

// "Live since 14 Oct"
export function liveSince(timestamp) {
  return `Live since ${new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}