// ------------------------------------------------------------
// "Edit page" in the preview tab (PreviewPage.jsx) → the landing page
// editor in the builder tab (App.jsx).
//
// The preview opens in its own tab, so it can't change the builder
// directly. It leaves a note in localStorage, which the builder tab
// hears (the browser's storage event) and opens that webinar's editor;
// then the preview tab closes, and the browser shows the builder again.
// If the preview can't close itself (its address was typed or
// bookmarked), it goes to the builder with ?edit=<id> instead, and the
// builder opens the editor when it loads.
// ------------------------------------------------------------

export const EDIT_REQUEST_KEY = 'pagebuilder:edit-request';

// From the preview tab
export function requestEdit(funnelId) {
  try {
    // A fresh value each time, so asking twice still fires the event
    localStorage.setItem(EDIT_REQUEST_KEY, JSON.stringify({ id: funnelId, at: Date.now() }));
  } catch {
    // Storage off: the ?edit= fallback below still works
  }
  window.close();
  setTimeout(() => {
    // The builder's own address ('/'), not this page's: a webinar's link (/<slug>) opens its page, not the builder
    window.location.assign(`/?edit=${encodeURIComponent(funnelId)}`);
  }, 150);
}

// In the builder: the webinar to open the editor for, from a storage event's new value
export function editRequestId(value) {
  try {
    const request = JSON.parse(value);
    return typeof request?.id === 'string' ? request.id : null;
  } catch {
    return null;
  }
}

// In the builder, on load: ?edit=<id>, or null. Removes it from the address,
// so a refresh doesn't open the editor again.
export function takeEditParam() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('edit');
  if (id === null) return null;
  params.delete('edit');
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  return id;
}