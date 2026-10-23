import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { createMockService, getService, servicePrice, updateMockService } from '../data/mockServices';
import { CALL_DEFAULTS } from '../data/callDetails';
import { MY_CALL_ID, makeMockStats } from '../data/myProfile';
import './ServiceSummaryInput.css';

// Their contract's checkout, as a preview. In "Create a 1:1 call" the call
// isn't made yet (answers.callId is the id it will have), so the page reads
// it from the draft saved in this browser (callDraft.js). In setup, the
// answers are already saved, under the first call's id.
export function contractPreviewSrc(answers) {
  const id = answers.callId ?? MY_CALL_ID;
  const draft = answers.callId ? '&draft=1' : '';
  return `${window.location.pathname}?mock=checkout&service=${encodeURIComponent(id)}&preview=1${draft}`;
}

// The contract (checkout page) for their call, made for them from the
// call's name and price. Its name is the call's name. Made the first time
// this screen shows; if they've gone back and changed the call since, it's
// updated to match. Its id is saved as serviceId, and its made-up rating
// and counts as callStats.
//
// What the word means is the screen's footnote (myPageQuestions.js).
// What people fill in isn't listed: the contract itself shows that, beside
// the screen in "Create a 1:1 call", or from Preview.
// question.contractAside: the screen already shows the contract beside it
// ("Create a 1:1 call"), so Preview only shows when that column is hidden
// on a narrow window. Without it (setup), Preview always shows.
export default function ServiceSummaryInput({ question, answers, onChange }) {
  const free = (answers.callPricing ?? CALL_DEFAULTS.callPricing) === 'free';
  const title = String(answers.callTitle ?? '').trim();
  const price = free ? 0 : Number(answers.callPrice) || 0;
  const [service, setService] = useState(() => getService(answers.serviceId));
  const [failed, setFailed] = useState(false);
  const done = useRef(false); // once per visit to this screen (React may run the effect twice in development)

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const existing = getService(answers.serviceId);
    const made = existing
      ? updateMockService(existing.id, { title, price })
      : createMockService({ title, price });
    if (!made) {
      setFailed(true);
      return;
    }
    setService(made);
    if (made.id !== answers.serviceId) onChange(made.id, 'serviceId');
    // Its rating, bookings and reviews: made once, then kept
    if (!answers.callStats) onChange(makeMockStats(), 'callStats');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <p className="qinput__error">
        We couldn’t create your contract just now. Go back a step and try again.
      </p>
    );
  }

  const priceText = service ? servicePrice(service) : free ? 'Free' : `₹${price.toLocaleString('en-IN')}`;

  return (
    <div className="qinput svc">
      <div className="svc__card">
        <dl>
          <div className="svc__row">
            <dt>Contract name</dt>
            <dd className="svc__name">{service?.title ?? title}</dd>
          </div>
          <div className="svc__row">
            <dt>Price</dt>
            <dd className={priceText === 'Free' ? 'svc__free' : ''}>{priceText}</dd>
          </div>
        </dl>
        <div className={`svc__actions ${question?.contractAside ? 'svc__actions--narrow-only' : ''}`}>
          <a
            className="svc__action"
            href={contractPreviewSrc(answers)}
            target="_blank"
            rel="noreferrer"
            aria-label="Preview your contract (opens in a new tab)"
          >
            <ExternalLink size={15} aria-hidden="true" /> Preview
          </a>
        </div>
      </div>
    </div>
  );
}