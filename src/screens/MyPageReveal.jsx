import { useState } from 'react';
import { Check, Copy, PartyPopper } from 'lucide-react';
import ProfileExample from '../components/ProfileExample';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import './MyPageReveal.css';

// ------------------------------------------------------------
// The end of setup: their page, built from their answers and
// already live, with the ways to share it.
// ------------------------------------------------------------
export default function MyPageReveal({ handle, onEdit }) {
  const link = `${PAGE_DOMAIN}/${handle}`;
  const url = pageUrl(handle);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand
    }
  }

  return (
    <div className="mpr">
      <div className="mpr__main">
        <p className="mpr__badge">
          <PartyPopper size={16} aria-hidden="true" /> It’s live
        </p>
        <h1 className="mpr__title">Your offerings page is ready</h1>
        <p className="mpr__sub">Share your link and people can book a call with you right away.</p>

        <div className="mpr__link">
          <span className="mpr__url">{link}</span>
          <button type="button" className="mpr__copy" onClick={copyLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        <button type="button" className="mpr__edit" onClick={onEdit}>
          Edit my offerings page
        </button>
      </div>

      <aside className="mpr__aside">
        <ProfileExample mine link={link} tall />
      </aside>
    </div>
  );
}