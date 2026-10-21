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
// Only used when deleting: the Contracts page doesn't show these on its rows.
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