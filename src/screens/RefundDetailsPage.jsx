import { funnelTypes } from '../data/funnelTypes';
import { webinarWhen } from '../data/webinar';
import { peopleOf } from '../data/webinarSignups';
import { funnelName } from '../utils/funnelName';
import { loadSaved } from '../utils/storage';
import './RefundDetailsPage.css';

// ------------------------------------------------------------
// One person's refund, opened in a new tab from the "Refunded ₹…" badge
// beside their name (a session's Manage people, WebinarDetails.jsx).
// A placeholder for now: who, how much, when, and for which session.
// The full page isn't designed yet; its link already carries what it
// will need, so the badge won't have to change.
//
// ?mock=refund&webinar=<session id>&person=<person id>
// ------------------------------------------------------------

const TYPE = funnelTypes.find((t) => t.id === 'webinar');
const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const when = (ms) =>
  new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function RefundDetailsPage({ webinarId, personId }) {
  const person = webinarId && personId ? peopleOf(webinarId).find((p) => p.id === personId) : null;

  if (!person || !person.refundedAt) {
    return (
      <main className="rfd rfd--none">
        <h1 className="rfd__title">Refund not found</h1>
        <p className="rfd__note">This refund doesn’t exist any more, or the link is wrong.</p>
      </main>
    );
  }

  const saved = loadSaved().funnels;
  const session = Array.isArray(saved) ? saved.find((f) => f?.id === webinarId) : null;
  const refunded = person.refunded ?? person.amount;
  const full = refunded >= person.amount;
  const sessionLine = session
    ? [funnelName({ answers: session.answers ?? {} }, TYPE), webinarWhen(session.answers ?? {})?.line].filter(Boolean).join(', ')
    : null;

  return (
    <main className="rfd">
        <div>to be built</div>
    </main>
  );
}