// ------------------------------------------------------------
// A link that opens a WhatsApp chat with someone: https://wa.me/<number>.
// On a phone it opens the WhatsApp app; on a computer, WhatsApp Desktop
// or WhatsApp Web. No API or sign-up: it's a plain link.
//
// Checkout saves numbers as '<code> <number>', e.g. '+91 98765 43210'.
// WhatsApp wants digits only, with the country code: 919876543210.
// A leading 0 typed after the code ('+44 07911 123456') is dropped,
// since numbers written for calling inside the country start with one.
// ------------------------------------------------------------

// '+91 98765 43210' → '919876543210', or null if it can't be a number
export function whatsappNumber(phone) {
  const text = String(phone ?? '').trim();
  if (!text) return null;

  // Code and number as checkout saves them: '+44 07911 123456'
  const split = text.match(/^\+(\d{1,4})[\s-]+(.+)$/);
  const digits = split
    ? split[1] + split[2].replace(/\D/g, '').replace(/^0+/, '')
    : text.replace(/\D/g, '');

  // Real numbers with their country code are 8 to 15 digits
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

// The chat link, with a message ready to send (they can edit it first).
// null when the number can't be used.
export function whatsappHref(phone, message = '') {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}
// A link that opens WhatsApp with a message ready, and lets them pick who
// to send it to (no number needed): https://wa.me/?text=…
// On a phone it opens the app's chat picker; on a computer, WhatsApp
// Desktop or WhatsApp Web. Used by Share webinar (ShareDialog).
export function whatsappShareHref(message) {
  return `https://wa.me/?text=${encodeURIComponent(String(message ?? ''))}`;
}