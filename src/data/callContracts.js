import { tiedProducts } from './tiedProducts';
import { getMyProfile, loadAnswers } from './myProfile';

// ------------------------------------------------------------
// A 1:1 call's contract follows the call. The call is the source of
// truth: its name, description, price and booking questions are what
// checkout uses (callService in myProfile.js), so its contract shows the
// same, and can't be changed on the Contracts page (a change there would
// never reach checkout). Changing the call changes its contract.
//
// Which contracts: the ones exactly one product uses, when that product
// is a call (tiedProducts.js). Nothing new is saved to mark them, so
// contracts made before this work the same. One shared by several
// products (only older saves can have that) can't follow two of them,
// so it's left as it was and stays editable. Courses never use one this
// way, so theirs stay fully editable.
//
// What the contract had of its own (cover, GST, other currencies, the
// success page) stays saved as it was; nothing changes it while the call
// owns the contract.
//
// In the real product the server writes the call's values into its
// contract whenever the call is saved. Here they're read through from the
// call, so the two can never drift apart.
//
// callContracts() → { [contractId]: call } (call: as in getMyProfile's services)
// asCallContract(contract, call) → the contract with the call's values, and
//   callId / callName saying which call it follows
// ------------------------------------------------------------

export function callContracts() {
  const tied = tiedProducts();
  const calls = getMyProfile(loadAnswers()).services;
  const owned = {};
  Object.entries(tied).forEach(([contractId, products]) => {
    if (products.length !== 1 || products[0].kind !== 'call') return;
    const call = calls.find((c) => c.id === products[0].id);
    if (call) owned[contractId] = call;
  });
  return owned;
}

// The call's price as the contract's, in rupees: the call's regular price
// (crossed out) as the selling price, and what people pay as the discounted
// price (contractPricing.js). No regular price: just what they pay.
function callPrices(call) {
  const pays = Math.max(0, Math.round(Number(call.price) || 0));
  if (pays === 0) return [];
  const regular = Math.round(Number(call.comparePrice) || 0);
  return regular > pays
    ? [{ currency: 'INR', price: regular, discount: pays }]
    : [{ currency: 'INR', price: pays, discount: null }];
}

export function asCallContract(contract, call) {
  const prices = callPrices(call);
  const name = String(call.title ?? '').trim() || '1:1 call';
  return {
    ...contract,
    title: name,
    description: (Array.isArray(call.about) ? call.about : []).join('\n\n'),
    type: prices.length > 0 ? 'onetime' : 'free',
    price: prices.length > 0 ? (prices[0].discount ?? prices[0].price) : 0,
    currency: 'INR',
    prices,
    questions: Array.isArray(call.questions) ? call.questions : [],
    callId: call.id,
    callName: name,
  };
}