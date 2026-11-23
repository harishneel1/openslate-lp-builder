import { saveBatch } from './batches';

// ------------------------------------------------------------
// Saving a class. Every screen that saves one (Create a class, its
// editor) goes through here.
//
// A class no longer makes or changes a contract: it only links the
// contracts the coach picked (contractIds), which are made and changed on
// the Contracts page. A batch from before that still has its own
// contract (contractId); it's left as it is.
//
// storeBatch(batch) → the saved class, or null if storage failed
// ------------------------------------------------------------
export function storeBatch(batch) {
  return saveBatch(batch) ? batch : null;
}
