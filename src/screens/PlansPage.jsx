import { ArrowUpCircle } from 'lucide-react';
import './PageNotFound.css'; // the same centred page
import './PlansPage.css';

// ------------------------------------------------------------
// The plans page, at ?mock=plans (see main.jsx). Upgrade plan opens it in
// a new tab, from Cloud Storage and from "Ready to join?" when storage is
// almost full or full. A placeholder: what's here (plans, prices, paying)
// isn't decided yet, and only this page changes when it is.
// The link: PLANS_HREF in data/cloudStorage.js.
// ------------------------------------------------------------

export default function PlansPage() {
  return (
    <main className="pnf plans">
      <span className="plans__icon" aria-hidden="true">
        <ArrowUpCircle size={24} />
      </span>
      <h1 className="pnf__title">Plans are coming soon</h1>
      <p className="pnf__text">This is where you’ll see plans and upgrade for more storage.</p>
    </main>
  );
}