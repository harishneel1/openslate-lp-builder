// ------------------------------------------------------------
// Invoice settings: what goes on the invoices a coach's buyers get
// (Settings → Payment details → Your invoices, screens/InvoiceSettings.jsx;
// the invoice itself is screens/InvoicePage.jsx, through earnings.js's
// invoiceFrom).
//
//   send          email buyers an invoice with every purchase. Off: they
//                 aren't sent, though the coach can still download them
//                 from Sales → Transactions. (The prototype sends no email.)
//   displayName   the brand name at the top of the invoice
//   address, pin  the address under it
//   regSame       GST only: the registered address is the one above
//   regAddress, regPin  GST only: the registered address, when it isn't
//   note          up to NOTE_MAX characters at the bottom of every invoice
//
// GST itself isn't kept here: the GSTIN, legal name and state come from
// the verified business (payouts.js), so nothing is typed twice. Without
// it, invoices say they're not registered for GST.
//
// Kept in this browser (localStorage) under KEY. With nothing saved, the
// coach's own details: the ones the invoices used before this screen.
// ------------------------------------------------------------

const KEY = 'pagebuilder:invoice-settings';
const CHANGED_EVENT = 'invoice-settings-changed';

export const NOTE_MAX = 500;

export const DEFAULT_INVOICE_SETTINGS = {
  send: true,
  displayName: 'Harish Neel',
  address: '7/4, 6th street, 1st cross, Dr. Subbarayan nagar, Kodambakkam, Chennai',
  pin: '600024',
  regSame: true,
  regAddress: '',
  regPin: '',
  note: '',
};

export function loadInvoiceSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return saved && typeof saved === 'object'
      ? { ...DEFAULT_INVOICE_SETTINGS, ...saved }
      : { ...DEFAULT_INVOICE_SETTINGS };
  } catch {
    return { ...DEFAULT_INVOICE_SETTINGS };
  }
}

// false when it couldn't be saved
export function saveInvoiceSettings(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_INVOICE_SETTINGS, ...next }));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// A change here or in another tab. Returns the unsubscribe.
export function onInvoiceSettingsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
  };
}

// Back to the coach's own details (Prototype controls)
export const resetInvoiceSettings = () => saveInvoiceSettings(DEFAULT_INVOICE_SETTINGS);

// ---------- Checking what they type ----------

export const cleanPin = (text) => String(text ?? '').replace(/\D/g, '').slice(0, 6);

export function pinProblem(pin) {
  if (!pin) return 'Enter the PIN code.';
  if (!/^[1-9][0-9]{5}$/.test(pin)) return 'A PIN code has 6 digits and doesn’t start with 0.';
  return null;
}

export function displayNameProblem(name) {
  if (!String(name ?? '').trim()) return 'Enter the name to show on your invoices.';
  return null;
}

export function addressProblem(address) {
  if (!String(address ?? '').trim()) return 'Enter the address.';
  return null;
}

// '7/4, …, Chennai' + '600024' → '7/4, …, Chennai 600024'
export const addressLine = (address, pin) => [String(address ?? '').trim(), pin].filter(Boolean).join(' ');