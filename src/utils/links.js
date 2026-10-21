// Web links the creator types (a button's link, a redirect page)

// Adds https:// when they've left it off: "mysite.com/join" → "https://mysite.com/join"
export function withScheme(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

// A real web address: http(s), with a dot in the name ("mysite.com", not "mysite")
export function isWebLink(text) {
  const t = withScheme(text);
  if (!t) return false;
  try {
    const url = new URL(t);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') && !url.hostname.endsWith('.');
  } catch {
    return false;
  }
}

// Short, for summaries: "https://www.mysite.com/join?x=1" → "mysite.com/join"
export function shortLink(text) {
  try {
    const url = new URL(withScheme(text));
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    return `${url.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return String(text ?? '').trim();
  }
}