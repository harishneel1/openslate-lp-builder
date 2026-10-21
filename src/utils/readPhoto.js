// Reads a photo the creator picked and returns it as a small data URL.
// Checks the file first, then shrinks it so it fits comfortably in
// localStorage (a 2 MB phone photo becomes roughly 40 KB).
// The real app should upload the photo to storage and save the link instead.

const MAX_MB = 5;      // largest file we accept
const MAX_SIDE = 400;  // longest side after shrinking, in px (plenty for avatars)
const QUALITY = 0.85;  // JPEG quality

// Throws an Error with a message that's safe to show the creator.
// maxSide: longest side after shrinking (bigger for a contract's cover)
export async function readPhoto(file, { maxSide = MAX_SIDE } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG or PNG).');
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`That photo is over ${MAX_MB} MB. Please choose a smaller one.`);
  }

  const img = await loadImage(file);

  // Scale down so the longest side is maxSide; never scale up
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // White behind see-through PNGs, otherwise they turn black as JPEG
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', QUALITY);
}

// The picture's width and height, for checking its shape (a cover should be wide)
export function photoSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Loads the file into an <img> so we can draw it on a canvas
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read that file. Please try another."));
    };
    img.src = url;
  });
}