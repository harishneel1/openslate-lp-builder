// ------------------------------------------------------------
// Checkout's money rules and lists, for the mock. In the real
// product these come from the existing checkout (coupons, GST).
// ------------------------------------------------------------

export const GST_RATE = 0.18;

// How long a chosen time is held while they pay (seconds)
export const HOLD_SECONDS = 10 * 60;

// Mock coupons: code → percent off the price before GST
export const COUPONS = { WELCOME10: 10, FRIEND20: 20 };

// A GSTIN: 2-digit state code, PAN (5 letters, 4 digits, 1 letter),
// entity number, 'Z', check character. e.g. 33ABCDE1234F1Z5
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// For the GST details' State field: all 28 states and 8 union territories
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

// Shown under the pay button. The real checkout already has the official
// logo images for these: use those files in place of the text labels.
export const PAYMENT_METHODS = ['UPI', 'PhonePe', 'Paytm', 'Visa', 'Mastercard', 'RuPay', 'Google Pay'];

// ₹2,950.00
export const money = (n) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Price, coupon and GST → the lines of the order summary
export function breakdown(amount, couponPercent = 0) {
  const discount = Math.round(amount * couponPercent) / 100;
  const taxable = amount - discount;
  const gst = Math.round(taxable * GST_RATE * 100) / 100;
  return { amount, discount, gst, total: taxable + gst };
}

// Where most clients are; India first as the usual case
export const COUNTRY_CODES = [
  { code: '+91', name: 'India' },
  { code: '+971', name: 'UAE' },
  { code: '+65', name: 'Singapore' },
  { code: '+44', name: 'UK' },
  { code: '+1', name: 'US and Canada' },
  { code: '+61', name: 'Australia' },
];