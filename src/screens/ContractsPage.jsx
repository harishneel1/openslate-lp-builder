import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteService,
  getAllServices,
  serviceDate,
} from '../data/mockServices';
import { lockedWords, ownerOf, tiedTo } from '../data/tiedProducts';
import { signupCounts } from '../data/contractSignups';
import { BOOKINGS_CHANGED_EVENT } from '../data/bookingsStore';
import { formatMoney } from '../data/contractPricing';
import ContractEditor from './ContractEditor';
import ConfirmDialog from '../components/ConfirmDialog';
import { runHref } from '../utils/publish';
import { SETUP_CHANGED_EVENT } from '../data/myPage';
import './ContractsPage.css';

// ------------------------------------------------------------
// Contracts: the pages people sign up and pay on. 1:1 calls, webinars and
// courses each use one. A contract stands on its own; only 1:1 calls and
// webinars are tied to theirs, so it can't be deleted while one uses it
// (tiedProducts.js). Rows don't list what uses a contract, since one can
// be used by many products; only a contract one product owns says so (below).
//
//   ┌────────────────────────────────────────────────────────┐
//   │ Contracts                        [+ Create new contract]│
//   │ The checkout pages people sign up and pay on.           │
//   │ ┌────────────────────────────────────────────────────┐ │
//   │ │ [Search by name                    ]  All  Paid  Free │ │
//   │ │ Contract                 Price     Sign-ups  Start date     │ │
//   │ │ (▣) Career clarity call  ₹1,500    24        30 Apr 2026 [Edit] [⋯]
//   │ │                          One-time                           │ │
//   │ └────────────────────────────────────────────────────┘ │
//   └────────────────────────────────────────────────────────┘
//
// Sign-ups: everyone who has signed up on the contract, paid or free,
// whether or not it has happened yet (contractSignups.js). "None yet"
// at zero. On narrow screens it sits under the price, in words.
//
// The ↗ button opens the contract's live page in a new tab: a 1:1 call's
// checkout, or a webinar's sign-up page. A contract with neither has no
// page of its own yet, so the button is greyed out with a hint saying so.
//
// Create new contract, Edit and a click on a row open the contract screen
// (ContractEditor.jsx) right here, with a back link to this list.
//
// One visible action per row (Edit); the rest live in ⋯ with words, not
// icons. Delete always asks first. When a 1:1 call or webinar is tied to the
// contract, the pop-up says which one, and that it has to be deleted first.
//
// A contract a 1:1 call or a webinar made for itself follows it
// (ownerOf in tiedProducts.js). Its row looks like any other, but Edit
// (the button, the ⋯ menu, or a click on its name) opens a pop-up that
// says it can't be edited, which call or webinar it's linked to, and what
// to change there, with a button straight to it.
// A 1:1 call's contract shows the call's own name, price and description
// (callContracts.js). Every other contract (courses, ones made here) is
// changed here as before.
//
// onGoToOfferings(): to the 1:1 calls tab, where their calls are made and changed
// onOpenWebinar(id): opens that webinar's funnel
// onOpenCall(id): opens that 1:1 call's editor
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
const amountLabel = (c) => (isFree(c) ? 'Free' : formatMoney(c.price, c.currency ?? 'INR'));

// "One-time", or "One-time · +2 currencies" when it has prices in others too
function typeLabel(c) {
  const type = PAYMENT_TYPES[c.type] ?? 'One-time';
  const more = (Array.isArray(c.prices) ? c.prices.length : 1) - 1;
  return more > 0 ? `${type} · +${more} ${more === 1 ? 'currency' : 'currencies'}` : type;
}

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
    window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh); // a new booking is a new sign-up
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(SETUP_CHANGED_EVENT, refresh);
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [data, refresh];
}

export default function ContractsPage({ onGoToOfferings, onOpenWebinar, onOpenCall }) {
  const [contracts, refresh] = useContracts();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [menuFor, setMenuFor] = useState(null); // the row whose ⋯ menu is open
  // The delete pop-up: { contract, tied } (tied: the 1:1 calls and webinars holding it, if any)
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState(null); // { text, tone } shown at the bottom for a moment
  // The contract screen, when it's open: { id } to change one, { id: null } for a new one
  const [editing, setEditing] = useState(null);
  // The "You can't edit this contract" pop-up: { contract, owner } (ownerOf)
  const [owned, setOwned] = useState(null);

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

  // Read with the list, so it's as fresh as the contracts are
  const signups = useMemo(() => signupCounts(contracts), [contracts]);

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

  // Edit: the contract screen, or, when a call or webinar owns it (read
  // fresh), the pop-up pointing there
  const edit = (contract) => {
    setMenuFor(null);
    const owner = ownerOf(contract);
    if (owner) setOwned({ contract, owner });
    else setEditing({ id: contract.id });
  };
  const openOwner = () => {
    const { owner } = owned;
    setOwned(null);
    if (owner.kind === 'call') onOpenCall?.(owner.id);
    else onOpenWebinar?.(owner.id);
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

  // The contract screen, in place of the list. Back here re-reads the list.
  if (editing) {
    const backToList = () => {
      setEditing(null);
      refresh();
    };
    return (
      <>
        <ContractEditor
          key={editing.id ?? 'new'}
          contractId={editing.id}
          backLabel="Contracts"
          onBack={backToList}
          onOpenCall={onOpenCall}
          onOpenWebinar={onOpenWebinar}
          onCreated={(made) => {
            backToList();
            tell(`“${made.title}” created`);
          }}
        />
        <Notice notice={notice} />
      </>
    );
  }

  return (
    <div className="ct">
      <header className="ct__head">
        <div className="ct__head-text">
          <h1 className="ct__title">Contracts</h1>
          <p className="ct__sub">The pages people sign up and pay on. Your 1:1 calls, webinars and courses each use a contract.</p>
        </div>
        {contracts.length > 0 && <CreateButton onClick={() => setEditing({ id: null })} />}
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
          <CreateButton onClick={() => setEditing({ id: null })} />
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
                <span>Sign-ups</span>
                <span>Start date</span>
                <span />
              </div>
              <ul className="ct__list">
                {shown.map((c) => (
                  <ContractRow
                    key={c.id}
                    contract={c}
                    signups={signups[c.id] ?? 0}
                    menuOpen={menuFor === c.id}
                    onMenu={(open) => setMenuFor(open ? c.id : null)}
                    onCopyId={() => copyId(c)}
                    onEdit={() => edit(c)}
                    onDelete={() => askDelete(c)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {owned && <OwnedDialog owner={owned.owner} onCancel={() => setOwned(null)} onConfirm={openOwner} />}

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

      <Notice notice={notice} />
    </div>
  );
}

// A short note at the bottom of the screen after an action
function Notice({ notice }) {
  return (
    <div className="ct__notice-wrap" aria-live="polite">
      {notice && (
        <p className={`ct__notice ${notice.tone === 'error' ? 'ct__notice--error' : ''}`}>
          {notice.tone === 'error' ? <X size={16} aria-hidden="true" /> : <Check size={16} strokeWidth={3} aria-hidden="true" />}
          {notice.text}
        </p>
      )}
    </div>
  );
}

function CreateButton({ onClick }) {
  return (
    <button type="button" className="ct-btn ct-btn--primary" onClick={onClick}>
      <Plus size={18} aria-hidden="true" />
      Create new contract
    </button>
  );
}

// "You can't edit this contract": a contract its call or webinar keeps
// matching itself. Says which one it's linked to, what to change there,
// and goes straight there (lockedWords in tiedProducts.js).
function OwnedDialog({ owner, onCancel, onConfirm }) {
  const w = lockedWords(owner);
  return (
    <ConfirmDialog title={w.title} confirmLabel={w.button} onCancel={onCancel} onConfirm={onConfirm}>
      <p>
        This contract is linked to your {w.kind} <strong>{w.name}</strong>. To change its {w.fields}, open {w.what} and
        edit it there.
      </p>
    </ConfirmDialog>
  );
}

// Where a contract can be seen live, in a new tab, or null when it has no
// page of its own (only calls' and webinars' contracts do, for now):
//   a 1:1 call's   its checkout, with no time picked (as "View contract" in the call)
//   a webinar's    its sign-up page
function liveLinkOf(contract) {
  const owner = ownerOf(contract);
  if (owner?.kind === 'call') {
    return `${window.location.pathname}?mock=checkout&service=${encodeURIComponent(owner.id)}&preview=1`;
  }
  // This run's own sign-up page (its contract is this date's alone)
  if (owner?.kind === 'webinar') return `${runHref({ id: owner.id })}&page=signup`;
  return null;
}

// One contract: name, price, sign-ups, start date, Edit, ↗ and ⋯. Every row
// looks the same; Edit decides (in the list) whether it opens the contract
// screen or the pop-up for one a call or webinar owns.
// signups: how many people have signed up on it
function ContractRow({ contract, signups = 0, menuOpen, onMenu, onCopyId, onEdit, onDelete }) {
  const free = isFree(contract);
  const live = liveLinkOf(contract);

  return (
    <li className={`ct-row ${menuOpen ? 'ct-row--menu' : ''}`}>
      <div className="ct-row__main">
        <span className="ct-row__icon" aria-hidden="true">
          <FileText size={20} />
        </span>
        {/* The name opens it; the whole row is clickable through it */}
        <span className="ct-row__name">
          <button type="button" className="ct-row__title" onClick={onEdit}>
            {contract.title}
          </button>
        </span>
      </div>

      <div className="ct-row__price">
        <span className="sr-only">Price: </span>
        <span className={`ct-row__amount ${free ? 'ct-row__amount--free' : ''}`}>{amountLabel(contract)}</span>
        {!free && <span className="ct-row__type">{typeLabel(contract)}</span>}
      </div>

      {/* The number under its heading; in words where the headings are hidden
          (narrow screens). Only one of the two shows, so it's read once. */}
      <div className="ct-row__signups">
        <span className={`ct-row__signups-short ${signups === 0 ? 'ct-row__signups--none' : ''}`}>
          <span className="sr-only">Sign-ups: </span>
          {signups === 0 ? 'None yet' : signups.toLocaleString('en-IN')}
        </span>
        <span className="ct-row__signups-long">
          {signups === 0 ? 'No sign-ups yet' : `${signups.toLocaleString('en-IN')} ${signups === 1 ? 'sign-up' : 'sign-ups'}`}
        </span>
      </div>

      <div className="ct-row__date">
        <span className="sr-only">Starts </span>
        {serviceDate(contract)}
      </div>

      <div className="ct-row__actions">
        <button type="button" className="ct-btn ct-btn--quiet ct-btn--small" onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" />
          Edit
          <span className="sr-only"> {contract.title}</span>
        </button>
        {live ? (
          <a
            className="ct-icon-btn"
            href={live}
            target="_blank"
            rel="noopener"
            aria-label={`View live page for ${contract.title} (opens in a new tab)`}
            data-tip="View live page"
            data-tip-align="end"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ) : (
          // Not there: looks off and does nothing, with a hint saying why.
          // aria-disabled (not disabled) so it can still be hovered and focused.
          <button
            type="button"
            className="ct-icon-btn"
            aria-disabled="true"
            aria-label={`No live page yet for ${contract.title}`}
            data-tip="No live page yet. Only 1:1 call and webinar contracts have one for now."
            data-tip-align="end"
            onClick={(e) => e.preventDefault()}
          >
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        )}
        <RowMenu
          title={contract.title}
          open={menuOpen}
          onOpenChange={onMenu}
          onEdit={onEdit}
          onCopyId={onCopyId}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

// ⋯ : Edit (as the button does), then the less common actions, in words.
// Closes on a click outside or Escape.
// Delete always opens the pop-up, which says if something is holding the contract.
function RowMenu({ title, open, onOpenChange, onEdit, onCopyId, onDelete }) {
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
          <button type="button" role="menuitem" className="ct-menu__item" onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" />
            Edit
          </button>
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