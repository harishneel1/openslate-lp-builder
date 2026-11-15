import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import ContractEditor from './ContractEditor';
import { livePageOf } from '../data/contractCheckout';
import { copyText } from '../utils/copyText';
import './ContractEditor.css';
import './ContractCreated.css';

// ------------------------------------------------------------
// The contract screen in its own tab, at ?mock=create-service
// (add &service=<id> to change one). Opened from the call and webinar
// pickers' "Create a new contract", and a 1:1 call's "View contract".
// The tab they came from picks up the new or changed contract when they
// switch back to it, so this one only needs to say it's done, with the
// new contract's link to share (its own checkout, contractCheckout.js).
// Replaces the old stand-in (MockCreateService).
// ------------------------------------------------------------

// Tabs a page opened can close themselves; if this one can't, go to the app
function closeTab() {
  window.close();
  setTimeout(() => {
    if (!window.closed) window.location.href = '/';
  }, 200);
}

export default function ContractEditorTab({ serviceId = null }) {
  const [created, setCreated] = useState(null);

  useEffect(() => {
    document.title = created ? 'Contract created' : serviceId ? 'Edit contract' : 'New contract';
  }, [serviceId, created]);

  return (
    <div className="ce-tab">
      {created ? (
        <div className="ce-tab__done" role="status">
          <span className="ce-tab__tick" aria-hidden="true">
            <Check size={28} strokeWidth={3} />
          </span>
          <h1 className="ce-tab__title">Contract created</h1>
          <p className="ce-tab__text">
            <strong>{created.title}</strong> is ready. Go back to the tab you came from and it’ll be there to pick.
          </p>
          <CreatedLink contract={created} />
          <button type="button" className="ce-tab__close" onClick={closeTab}>
            Close this tab
          </button>
        </div>
      ) : (
        <ContractEditor contractId={serviceId} backLabel="Close" onBack={closeTab} onCreated={setCreated} />
      )}
    </div>
  );
}

// The new contract's link: Copy link and Open live page
function CreatedLink({ contract }) {
  const { view, share } = livePageOf(contract);
  const [copied, setCopied] = useState(null); // 'ok' | 'failed' | null
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    setCopied((await copyText(share)) ? 'ok' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2500);
  };
  return (
    <div className="ct-created__link">
      <span className="ct-created__url">{share}</span>
      <span className="ct-created__actions">
        <button type="button" className="ct-created__open" onClick={copy}>
          {copied === 'ok' ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied === 'ok' ? 'Link copied' : 'Copy link'}
        </button>
        <a className="ct-created__open" href={view} target="_blank" rel="noopener">
          Open live page
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </span>
      {copied === 'failed' && (
        <span role="alert" className="ct-created__error">
          We couldn’t copy it. Select the link above and copy it instead.
        </span>
      )}
    </div>
  );
}