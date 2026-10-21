import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import ContractEditor from './ContractEditor';
import './ContractEditor.css';

// ------------------------------------------------------------
// The contract screen in its own tab, at ?mock=create-service
// (add &service=<id> to change one). Opened from the call and webinar
// pickers' "Create a new contract", and a 1:1 call's "View contract".
// The tab they came from picks up the new or changed contract when they
// switch back to it, so this one only needs to say it's done.
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