import { addedCallsOf } from './myProfile';

// ------------------------------------------------------------
// A 1:1 call while it's being made (CreateCallFlow.jsx), before it
// exists. Kept in this browser so the preview beside the questions,
// which is the real booking page in a frame (?mock=book&draft=1), can
// read it. The frame is another page, so it hears every change through
// the browser's storage event and redraws.
//
// One draft at a time: starting a new call replaces it, and it's
// cleared when the call is created or they leave.
// ------------------------------------------------------------
export const CALL_DRAFT_KEY = 'callDraft';

export function saveCallDraft(draft) {
  try {
    localStorage.setItem(CALL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the preview just stops following along
  }
}

export function loadCallDraft() {
  try {
    return JSON.parse(localStorage.getItem(CALL_DRAFT_KEY)) ?? null;
  } catch {
    return null;
  }
}

export function clearCallDraft() {
  try {
    localStorage.removeItem(CALL_DRAFT_KEY);
  } catch {
    // Nothing to clear
  }
}

// The setup answers with the draft added as their newest call, so
// everything that builds a call (getMyProfile) can build it too.
// The draft's own id is the id the call will have once it's created.
export function withDraftCall(answers, draft) {
  if (!draft?.callId) return answers;
  const { callId, ...call } = draft;
  // A name they've cleared still shows as a space for one, not a missing call
  const callTitle = String(call.callTitle ?? '').trim() || 'Your call’s name';
  return { ...answers, addedCalls: [{ ...call, callTitle, id: callId }, ...addedCallsOf(answers)] };
}