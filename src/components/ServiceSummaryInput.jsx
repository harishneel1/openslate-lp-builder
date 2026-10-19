import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { createMockService, getService, servicePrice, updateMockService } from '../data/mockServices';
import { CALL_DEFAULTS } from '../data/callDetails';
import { makeMockStats } from '../data/myProfile';
import './ServiceSummaryInput.css';

// The kind of service, shown after its name
const SERVICE_TYPE = '1:1 consultation';

// Stand-ins: both open Meera's Discovery call service, as a preview, until
// creators' own services and the Services editor can be linked to
const PREVIEW_URL = '?mock=checkout&service=call-discovery&preview=1';
const EDIT_URL = '?mock=checkout&service=call-discovery&preview=1';

// What people fill in when they book, as on the checkout page
const FORM_FIELDS = 'Name, email, phone number, and what they’d like to talk about (optional)';

// The service (registration form) for their call, made for them from the
// call's name and price. Made the first time this screen shows; if they've
// gone back and changed the call since, it's updated to match. Its id is
// saved as serviceId, and its made-up rating and counts as callStats.
export default function ServiceSummaryInput({ answers, onChange }) {
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
        We couldn’t create your service just now. Go back a step and try again.
      </p>
    );
  }

  const priceText = service ? servicePrice(service) : free ? 'Free' : `₹${price.toLocaleString('en-IN')}`;

  return (
    <div className="qinput svc">
      <div className="svc__card">
        <dl>
          <div className="svc__row">
            <dt>Contract Name</dt>
            <dd className="svc__name">
              {service?.title ?? title} <span className="svc__type">| {SERVICE_TYPE}</span>
            </dd>
          </div>
          <div className="svc__row">
            <dt>Price</dt>
            <dd className={priceText === 'Free' ? 'svc__free' : ''}>{priceText}</dd>
          </div>
          <div className="svc__row">
            <dt>People fill in</dt>
            <dd>{FORM_FIELDS}</dd>
          </div>
        </dl>
        <div className="svc__actions">
          <a className="svc__action" href={PREVIEW_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden="true" /> Preview
          </a>
          <a className="svc__action" href={EDIT_URL} target="_blank" rel="noreferrer">
            <Pencil size={15} aria-hidden="true" /> Edit
          </a>
        </div>
      </div>
    </div>
  );
}