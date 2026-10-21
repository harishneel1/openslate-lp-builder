// ------------------------------------------------------------
// A contract's prices: up to one each in INR, USD and EUR. Visitors see
// the one for where they are:
//   India → INR    Europe → EUR    everywhere else → USD
// and the main price (the first one) when there's none in their currency.
//
//   prices: [{ currency, price, discount }]
//     price     the selling price, a whole number
//     discount  what they pay instead, lower than price; null = no discount
//   gst: { enabled, included }  INR prices only, always 18%
//     included false: 18% is added on top at checkout
//     included true:  the price already has it in
// ------------------------------------------------------------

export const CURRENCIES = [
  { id: 'INR', symbol: '₹', name: 'Indian rupee', locale: 'en-IN', region: 'India' },
  { id: 'USD', symbol: '$', name: 'US dollar', locale: 'en-US', region: 'Everywhere else' },
  { id: 'EUR', symbol: '€', name: 'Euro', locale: 'en-IE', region: 'Europe' },
];

export const GST_RATE = 0.18;
export const GST_PERCENT = '18%';

// Where a visitor is, and the currency they're shown
export const REGIONS = [
  { id: 'IN', label: 'India', currency: 'INR' },
  { id: 'EU', label: 'Europe', currency: 'EUR' },
  { id: 'ELSE', label: 'Elsewhere', currency: 'USD' },
];

export const currencyOf = (id) => CURRENCIES.find((c) => c.id === id) ?? CURRENCIES[0];

// "₹1,499", "$49", "€45"
export function formatMoney(amount, currency = 'INR') {
  const c = currencyOf(currency);
  const n = Math.round(Number(amount) || 0);
  return `${c.symbol}${n.toLocaleString(c.locale)}`;
}

// What people pay for one price: the discount when there is one
export const payAmount = (p) => (p && p.discount != null && p.discount > 0 ? p.discount : (p?.price ?? 0));

// The price a visitor from this region sees (REGIONS id), or the main one
export function priceFor(prices, regionId) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const currency = REGIONS.find((r) => r.id === regionId)?.currency;
  return prices.find((p) => p.currency === currency) ?? prices[0];
}

// GST on one price, if it applies: { amount, included } or null
export function gstOn(price, gst) {
  if (!price || price.currency !== 'INR' || !gst?.enabled) return null;
  const pay = payAmount(price);
  const amount = gst.included ? pay - pay / (1 + GST_RATE) : pay * GST_RATE;
  return { amount: Math.round(amount), included: Boolean(gst.included) };
}