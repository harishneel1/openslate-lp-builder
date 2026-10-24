import { SETUP_STORAGE_KEY } from './myPage';
import { MY_CALL_ID, addedCallsOf } from './myProfile';
import { funnelTypes } from './funnelTypes';
import { loadSaved } from '../utils/storage';
import { funnelName } from '../utils/funnelName';

// ------------------------------------------------------------
// Contracts stand on their own: courses and anything else can use one
// loosely. Two products are tied to theirs, so a contract can't be
// deleted while one of them uses it:
//   1:1 calls  each call has its own contract (it can't be swapped)
//   webinars   the contract picked on the webinar's funnel (drafts too,
//              since they'd break if it went)
// Courses are never tied, so they aren't looked up here.
//
// Used when deleting, and to find the contracts a 1:1 call owns, which
// follow that call (callContracts.js).
// Reads this browser's saves for now; in the real product it comes from the server.
//
// tiedProducts() → { [contractId]: [{ kind: 'call' | 'webinar', id, name }] }
// ------------------------------------------------------------

function loadSetupAnswers() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

const callName = (call) => String(call.callTitle ?? '').trim() || '1:1 call';

export function tiedProducts() {
  const tied = {};
  const add = (contractId, product) => {
    if (typeof contractId !== 'string' || !contractId) return;
    (tied[contractId] ??= []).push(product);
  };

  // 1:1 calls: the first one (on the setup answers), then the ones added later
  const answers = loadSetupAnswers();
  if (answers.serviceId) add(answers.serviceId, { kind: 'call', id: MY_CALL_ID, name: callName(answers) });
  addedCallsOf(answers).forEach((call) => add(call.serviceId, { kind: 'call', id: call.id, name: callName(call) }));

  // Webinars: the contract on each webinar funnel
  const webinar = funnelTypes.find((t) => t.id === 'webinar');
  const saved = loadSaved();
  const funnels = Array.isArray(saved.funnels) ? saved.funnels : [];
  if (webinar) {
    funnels
      .filter((f) => f?.type === 'webinar' && f.serviceId)
      .forEach((f) => add(f.serviceId, { kind: 'webinar', id: f.id, name: funnelName({ answers: f.answers ?? {} }, webinar) }));
  }

  return tied;
}

// What's tied to one contract, read fresh (an empty list when nothing is)
export const tiedTo = (contractId) => tiedProducts()[contractId] ?? [];
// The 1:1 call or webinar that owns a contract and keeps it matching
// itself, so it's changed there and not on the contract screen, or null.
//   a call's: marked with callId (callContracts.js)
//   a webinar's: made by that webinar (webinarId), while it still exists
// → { kind: 'call' | 'webinar', id, name } or null
export function ownerOf(contract) {
  if (!contract) return null;
  if (contract.callId) return { kind: 'call', id: contract.callId, name: contract.callName || contract.title };
  if (contract.webinarId) {
    const webinar = tiedTo(contract.id).find((t) => t.kind === 'webinar' && t.id === contract.webinarId);
    if (webinar) return { kind: 'webinar', id: webinar.id, name: webinar.name };
  }
  return null;
}