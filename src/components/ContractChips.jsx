import { Briefcase } from 'lucide-react';
import { getAllServices } from '../data/mockServices';
import './ContractChips.css';

// ------------------------------------------------------------
// A class's linked contracts, as chips: on the "is live" screen after
// Create a class (CreateBatchFlow.jsx) and in the head of the class's page
// (BatchOverview.jsx). A long contract name is cut off with "…", with the
// whole name on hover, and the chips wrap onto another line.
//
//   Anyone on these contracts can join:
//   [💼 Yoga monthly] [💼 Yoga 6 months]
//
// The briefcase is the Contracts icon from the sidebar, so it's clear
// these are contracts and not something the class holds itself.
//
// batch: the class (its contractIds)
// label: the line above the chips, or null for the chips alone
// head: true in a page's head (chips to the left, no line above)
// ------------------------------------------------------------

// The class's contracts that still exist, in its own order
export function linkedContracts(batch) {
  const all = new Map(getAllServices().map((c) => [c.id, c]));
  return (batch.contractIds ?? []).map((id) => all.get(id)).filter(Boolean);
}

export default function ContractChips({ batch, label = null, head = false }) {
  const contracts = linkedContracts(batch);
  if (contracts.length === 0) return null;
  return (
    <div className={`cchip ${head ? 'cchip--head' : ''}`}>
      {label && <p className="cchip__label">{label}</p>}
      <ul className="cchip__list">
        {contracts.map((c) => (
          <li key={c.id} className="cchip__item" title={c.title}>
            <Briefcase size={13} aria-hidden="true" />
            <span className="cchip__name">{c.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
