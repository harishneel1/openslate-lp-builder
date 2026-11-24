// ------------------------------------------------------------
// The files themselves, for the few kinds the prototype needs to show:
// PDFs (a PDF lesson is read in the player, PdfViewer.jsx). Cloud
// Storage's list (cloudStorage.js) keeps only each file's name and size,
// in localStorage, which can't hold files; the files go in the browser's
// IndexedDB here, by the file's id. In the real product the server keeps
// the file and the viewer loads it from there.
//
// saveBlob(id, blob)   kept; a promise of true, or false if it couldn't be
// loadBlob(id)         a promise of the Blob, or null (none kept, say a
//                      demo file, or one uploaded before files were kept)
// deleteBlob(id)       gone with the file
// ------------------------------------------------------------

const DB_NAME = 'pagebuilder-files';
const STORE = 'blobs';

let opening = null;
function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('No IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      opening = null; // try again next time
      throw err;
    });
  }
  return opening;
}

function run(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const saveBlob = (id, blob) =>
  run('readwrite', (s) => s.put(blob, id))
    .then(() => true)
    .catch(() => false);

export const loadBlob = (id) =>
  run('readonly', (s) => s.get(id))
    .then((blob) => (blob instanceof Blob ? blob : null))
    .catch(() => null);

export const deleteBlob = (id) =>
  run('readwrite', (s) => s.delete(id))
    .then(() => true)
    .catch(() => false);
