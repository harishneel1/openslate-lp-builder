import { ArrowRight, ExternalLink, PartyPopper } from 'lucide-react';
import ProfileExample from '../components/ProfileExample';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import './MyPageReveal.css';

// ------------------------------------------------------------
// The end of setup: their page, built from their answers and
// already live, with a way to open it and a way to finish.
// ------------------------------------------------------------
export default function MyPageReveal({ handle, onDone }) {
  const link = `${PAGE_DOMAIN}/${handle}`;
  const url = pageUrl(handle);

  return (
    <div className="mpr">
      <div className="mpr__main">
        <p className="mpr__badge">
          <PartyPopper size={16} aria-hidden="true" /> It’s live
        </p>
        <h1 className="mpr__title">Your storefront is ready</h1>
        <p className="mpr__sub">Share your link and people can book a call with you right away.</p>

        <div className="mpr__link">
          <span className="mpr__url">{link}</span>
          {/* A real link, so cmd/middle-click and popup blockers behave normally */}
          <a className="mpr__open" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Open page
          </a>
        </div>

        <button type="button" className="mpr__done" onClick={onDone}>
          Done, go to my storefront
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>

      <aside className="mpr__aside">
        <ProfileExample mine link={link} tall />
      </aside>
    </div>
  );
}