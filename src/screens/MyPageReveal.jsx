import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, PartyPopper } from 'lucide-react';
import ProfileExample from '../components/ProfileExample';
import { PAGE_DOMAIN } from '../data/myPage';
import './MyPageReveal.css';

// ------------------------------------------------------------
// The end of setup: their page, built from their answers and
// already live, with the ways to share it.
// ------------------------------------------------------------
export default function MyPageReveal({ handle, onEdit }) {
  const link = `${PAGE_DOMAIN}/${handle}`;
  const url = `https://${link}`;
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

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`You can book a time with me here: ${url}`)}`;

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

        <div className="mpr__actions">
          <a className="mpr__btn mpr__btn--whatsapp" href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> Share on WhatsApp
          </a>
          {/* Stand-in for their live address until pages are hosted */}
          <a className="mpr__btn" href="?mock=profile&source=mine" target="_blank" rel="noreferrer">
            <ExternalLink size={18} aria-hidden="true" /> View my page
          </a>
        </div>

        <p className="mpr__later">
          Webinars, Priority DMs and courses are on their way. You’ll be able to add them here.
        </p>
        <button type="button" className="mpr__edit" onClick={onEdit}>
          Change my answers
        </button>
      </div>

      <aside className="mpr__aside">
        <ProfileExample mine link={link} tall />
      </aside>
    </div>
  );
}