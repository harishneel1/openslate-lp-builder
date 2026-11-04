import { saveBatch } from './batches';
import { saveBatchContract } from './mockServices';

// ------------------------------------------------------------
// Saving a batch: its contract first (made the first time, kept in step
// after), then the batch with its contract's id. Every screen that saves
// a batch (Create a batch, its editor) goes through here, so a batch and
// its contract can't drift apart.
//
// Kept apart from batches.js so the batch store doesn't load the
// contracts store (which reads batches back, via tiedProducts.js).
//
// storeBatch(batch) → the saved batch, or null if storage failed
// ------------------------------------------------------------
export function storeBatch(batch) {
  const contractId = saveBatchContract(batch);
  if (!contractId) return null;
  const saved = { ...batch, contractId };
  return saveBatch(saved) ? saved : null;
}