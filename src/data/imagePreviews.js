// ------------------------------------------------------------
// Prototype only: pictures of images the coach uploads (a course's cover),
// so they can be seen. The prototype keeps no files, only their names
// (cloudStorage.js), so a small copy of each uploaded image is kept in
// this browser, by its Cloud Storage id, for every tab to show.
// Images over MAX_BYTES aren't kept (the browser's room is small): they
// show as a placeholder, as do images picked from Cloud Storage that were
// uploaded before this (the demo files).
// The real product shows the file itself, from storage.
//
// keepPreview(fileId, file) → Promise of true if it was kept
// previewOf(fileId) → a data URL to show, or null
// ------------------------------------------------------------

const KEY = 'pagebuilder:image-previews';
const MAX_BYTES = 1.5 * 1024 * 1024;

function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

export function previewOf(fileId) {
  const url = readAll()[fileId];
  return typeof url === 'string' && url.startsWith('data:image/') ? url : null;
}

export function keepPreview(fileId, file) {
  if (!file || file.size > MAX_BYTES || !String(file.type).startsWith('image/')) return Promise.resolve(false);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [fileId]: reader.result }));
        resolve(true);
      } catch {
        resolve(false); // no room: it shows as a placeholder
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}