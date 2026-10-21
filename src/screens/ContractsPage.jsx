import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  CREATE_SERVICE_URL,
  contractEditUrl,
  deleteService,
  getAllServices,
  serviceDate,
} from '../data/mockServices';
import { tiedTo } from '../data/tiedProducts';
import { SETUP_CHANGED_EVENT } from '../data/myPage';
import './ContractsPage.css';

// ------------------------------------------------------------
// Contracts: the pages people sign up and pay on. 1:1 calls, webinars and
// courses each use one. A contract stands on its own; only 1:1 calls and
// webinars are tied to theirs, so it can't be deleted while one uses it
// (tiedProducts.js). Rows don't show what uses a contract: one contract
// can be used by many products.
//
//   ┌────────────────────────────────────────────────────────┐
//   │ Contracts                        [+ Create new contract]│
//   │ The checkout pages people sign up and pay on.           │
//   │ ┌────────────────────────────────────────────────────┐ │
//   │ │ [Search by name                    ]  All  Paid  Free │ │
//   │ │ Contract                    Price      Start date      │ │
//   │ │ (▣) Career clarity call     ₹1,500     30 Apr 2026  [Edit] [⋯]
//   │ │                             One-time                   │ │
//   │ └────────────────────────────────────────────────────┘ │
//   └────────────────────────────────────────────────────────┘
//
// One visible action per row (Edit); the rest live in ⋯ with words, not
// icons. Delete always asks first. When a 1:1 call or webinar is tied to the
// contract, the pop-up says which one, and that it has to be deleted first.
//
// onGoToOfferings(): to the offerings page, where their 1:1 calls are
// onOpenWebinar(id): opens that webinar's funnel
// The list reads the data fresh when they come back to the tab (a contract
// made in the create tab shows straight away), so there's no Refresh button.
// ------------------------------------------------------------

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'paid', label: 'Paid', test: (c) => !isFree(c) },
  { id: 'free', label: 'Free', test: (c) => isFree(c) },
];

const PAYMENT_TYPES = { onetime: 'One-time', subscription: 'Monthly' };

const isFree = (c) => c.type === 'free' || !(Number(c.price) > 0);
const amountLabel = (c) => (isFree(c) ? 'Free' : `₹${Number(c.price).toLocaleString('en-IN')}`);

// Copies text, with a fallback where the Clipboard API isn't allowed
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

// The contracts, read again whenever they might have changed: back on this
// tab, a change in another tab, or the offerings setup saving.
function useContracts() {
  const read = () => getAllServices();
  const [data, setData] = useState(read);
  const refresh = () => setData(read());

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(SETUP_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(SETUP_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [data, refresh];
}

export default function ContractsPage({ onGoToOfferings, onOpenWebinar }) {
  const [contracts, refresh] = useContracts();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [menuFor, setMenuFor] = useState(null); // the row whose ⋯ menu is open
  // The delete pop-up: { contract, tied } (tied: the 1:1 calls and webinars holding it, if any)
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState(null); // { text, tone } shown at the bottom for a moment

  // A short note at the bottom of the screen after an action
  const noticeTimer = useRef(null);
  const tell = (text, tone = 'ok') => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  };
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    document.title = 'Contracts';
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, contracts.filter(f.test).length])),
    [contracts],
  );

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.id === filter)?.test ?? (() => true);
    return contracts.filter(
      (c) => test(c) && (!words || c.title.toLowerCase().includes(words) || c.id.toLowerCase().includes(words)),
    );
  }, [contracts, query, filter]);

  // ---------- Actions ----------
  const copyId = async (contract) => {
    setMenuFor(null);
    const ok = await copyText(contract.id);
    tell(ok ? 'Contract ID copied' : 'We couldn’t copy it. Select the ID and copy it instead.', ok ? 'ok' : 'error');
  };

  // Delete: what's tied to it is read fresh, so the pop-up is never out of date
  const askDelete = (contract) => {
    setMenuFor(null);
    setDeleting({ contract, tied: tiedTo(contract.id) });
  };

  const confirmDelete = () => {
    const contract = deleting?.contract;
    if (!contract) return;
    // Checked again: a call or webinar may have started using it while the pop-up was open
    const tied = tiedTo(contract.id);
    if (tied.length > 0) {
      setDeleting({ contract, tied });
      return;
    }
    setDeleting(null);
    if (!deleteService(contract.id)) {
      tell('We couldn’t delete it just now. Try again.', 'error');
      return;
    }
    refresh();
    tell('Contract deleted');
  };

  const clearSearch = () => {
    setQuery('');
    setFilter('all');
  };

  return (
    <div className="ct">
      <header className="ct__head">
        <div className="ct__head-text">
          <h1 className="ct__title">Contracts</h1>
          <p className="ct__sub">Contract pages are the checkout pages customers sign up and pay on. Your 1:1 calls, webinars and courses each use a contract.</p>
        </div>
        {contracts.length > 0 && <CreateButton />}
      </header>

      {contracts.length === 0 ? (
        <section className="ct__panel ct__empty">
          <span className="ct__empty-icon" aria-hidden="true">
            <FileText size={26} />
          </span>
          <h2 className="ct__empty-title">No contracts yet</h2>
          <p className="ct__empty-text">
            A contract is the page people sign up on, and pay on when it’s paid. Make one, then use it for a 1:1 call, a webinar or a course.
          </p>
          <CreateButton />
        </section>
      ) : (
        <section className="ct__panel" aria-labelledby="ct-list-title">
          <h2 className="sr-only" id="ct-list-title">
            Your contracts
          </h2>

          {/* ---------- Search and filters ---------- */}
          <div className="ct__tools">
            <label className="ct__search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search contracts</span>
              <input
                type="search"
                value={query}
                placeholder="Search by contract name"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="ct__filters" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`ct__filter ${filter === f.id ? 'ct__filter--on' : ''}`}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="ct__filter-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ---------- The list ---------- */}
          {shown.length === 0 ? (
            <div className="ct__none">
              <p>
                {query.trim()
                  ? `No contracts match “${query.trim()}”.`
                  : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} contracts.`}
              </p>
              <button type="button" className="ct-btn ct-btn--quiet" onClick={clearSearch}>
                Show all contracts
              </button>
            </div>
          ) : (
            <>
              <div className="ct__cols" aria-hidden="true">
                <span>Contract</span>
                <span>Price</span>
                <span>Start date</span>
                <span />
              </div>
              <ul className="ct__list">
                {shown.map((c) => (
                  <ContractRow
                    key={c.id}
                    contract={c}
                    menuOpen={menuFor === c.id}
                    onMenu={(open) => setMenuFor(open ? c.id : null)}
                    onCopyId={() => copyId(c)}
                    onDelete={() => askDelete(c)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {deleting && (
        <DeleteDialog
          contract={deleting.contract}
          tied={deleting.tied}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
          onGoToOfferings={() => {
            setDeleting(null);
            onGoToOfferings?.();
          }}
          onOpenWebinar={(id) => {
            setDeleting(null);
            onOpenWebinar?.(id);
          }}
        />
      )}

      <div className="ct__notice-wrap" aria-live="polite">
        {notice && (
          <p className={`ct__notice ${notice.tone === 'error' ? 'ct__notice--error' : ''}`}>
            {notice.tone === 'error' ? <X size={16} aria-hidden="true" /> : <Check size={16} strokeWidth={3} aria-hidden="true" />}
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

// Opens the create page in a new tab; the list picks the new one up when they come back
function CreateButton() {
  return (
    <a className="ct-btn ct-btn--primary" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
      <Plus size={18} aria-hidden="true" />
      Create new contract
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// One contract: name, price, start date, Edit and ⋯
function ContractRow({ contract, menuOpen, onMenu, onCopyId, onDelete }) {
  const free = isFree(contract);
  const editHref = contractEditUrl(contract.id);

  return (
    <li className={`ct-row ${menuOpen ? 'ct-row--menu' : ''}`}>
      <div className="ct-row__main">
        <span className="ct-row__icon" aria-hidden="true">
          <FileText size={20} />
        </span>
        {/* The name is the row's link; the whole row is clickable through it */}
        <a className="ct-row__title" href={editHref} target="_blank" rel="noopener">
          {contract.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <div className="ct-row__price">
        <span className="sr-only">Price: </span>
        <span className={`ct-row__amount ${free ? 'ct-row__amount--free' : ''}`}>{amountLabel(contract)}</span>
        {!free && <span className="ct-row__type">{PAYMENT_TYPES[contract.type] ?? 'One-time'}</span>}
      </div>

      <div className="ct-row__date">
        <span className="sr-only">Starts </span>
        {serviceDate(contract)}
      </div>

      <div className="ct-row__actions">
        <a className="ct-btn ct-btn--quiet ct-btn--small" href={editHref} target="_blank" rel="noopener">
          <Pencil size={15} aria-hidden="true" />
          Edit
          <span className="sr-only"> {contract.title} (opens in a new tab)</span>
        </a>
        <RowMenu
          title={contract.title}
          open={menuOpen}
          onOpenChange={onMenu}
          onCopyId={onCopyId}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

// ⋯ : the less common actions, in words. Closes on a click outside or Escape.
// Delete always opens the pop-up, which says if something is holding the contract.
function RowMenu({ title, open, onOpenChange, onCopyId, onDelete }) {
  const wrap = useRef(null);
  const button = useRef(null);
  const menuId = useRef(`ct-menu-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Focus the first item, so the keyboard can carry on from here
    wrap.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Up and down move between items
  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...wrap.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="ct-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="ct-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        <span className="sr-only">More for {title}</span>
      </button>

      {open && (
        <div className="ct-menu__list" id={menuId} role="menu" aria-label={`More for ${title}`} onKeyDown={onMenuKey}>
          <button type="button" role="menuitem" className="ct-menu__item" onClick={onCopyId}>
            <Copy size={16} aria-hidden="true" />
            Copy contract ID
          </button>
          <div className="ct-menu__divider" role="separator" />
          <button type="button" role="menuitem" className="ct-menu__item ct-menu__item--danger" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// How each tied product is named in the pop-up
const KINDS = {
  call: { noun: '1:1 consultation', go: 'Go to 1:1 consultation' },
  webinar: { noun: 'webinar', go: 'Go to webinar' },
};

// Delete, in one of two forms:
//   nothing tied:  "Delete this contract?" with Cancel and Delete contract
//   tied:          "You can't delete this contract yet", then plainly what's
//                  using it ("the 1:1 consultation called …") and that
//                  deleting that comes first, with a button to go there
// The browser's own <dialog>: dims the page, keeps the keyboard inside, Escape
// closes. The safe button has focus first, so Enter by habit deletes nothing.
function DeleteDialog({ contract, tied, onCancel, onConfirm, onGoToOfferings, onOpenWebinar }) {
  const ref = useRef(null);
  const blocked = tied.length > 0;
  const only = tied[0];
  const goTo = (t) => (t.kind === 'call' ? onGoToOfferings() : onOpenWebinar(t.id));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="ct-dialog"
      aria-labelledby="ct-dialog-title"
      aria-describedby="ct-dialog-body"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
    >
      {blocked ? (
        <>
          <h2 className="ct-dialog__title" id="ct-dialog-title">
            You can’t delete this contract yet
          </h2>
          {tied.length === 1 ? (
            <>
              <p className="ct-dialog__body" id="ct-dialog-body">
                This contract is being used by the {KINDS[only.kind].noun} called <strong>“{only.name}”</strong>. To
                delete this contract, first delete that {KINDS[only.kind].noun}.
              </p>
              <div className="ct-dialog__actions">
                <button type="button" className="ct-btn ct-btn--quiet" onClick={() => goTo(only)}>
                  {KINDS[only.kind].go}
                </button>
                <button type="button" className="ct-btn ct-btn--primary" onClick={onCancel} autoFocus>
                  Got it
                </button>
              </div>
            </>
          ) : (
            <>
              <div id="ct-dialog-body">
                <p className="ct-dialog__body">This contract is being used by:</p>
                <ul className="ct-dialog__uses">
                  {tied.map((t) => (
                    <li key={`${t.kind}-${t.id}`} className="ct-dialog__use">
                      <span>
                        the {KINDS[t.kind].noun} called <strong>“{t.name}”</strong>
                      </span>
                      <button type="button" className="ct-dialog__go" onClick={() => goTo(t)}>
                        {KINDS[t.kind].go}
                        <span className="sr-only">: {t.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="ct-dialog__body">To delete this contract, first delete these.</p>
              </div>
              <div className="ct-dialog__actions">
                <button type="button" className="ct-btn ct-btn--primary" onClick={onCancel} autoFocus>
                  Got it
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <h2 className="ct-dialog__title" id="ct-dialog-title">
            Delete this contract?
          </h2>
          <p className="ct-dialog__body" id="ct-dialog-body">
            <strong>{contract.title}</strong> will be deleted. This can’t be undone.
          </p>
          <div className="ct-dialog__actions">
            <button type="button" className="ct-btn ct-btn--quiet" onClick={onCancel} autoFocus>
              Cancel
            </button>
            <button type="button" className="ct-btn ct-btn--danger" onClick={onConfirm}>
              Delete contract
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}