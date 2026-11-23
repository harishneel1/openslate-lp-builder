import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Link2, Trash2 } from 'lucide-react';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { CREATE_SERVICE_URL, contractEditUrl, contractOf, getAllServices, getServices, servicePrice } from '../data/mockServices';
import { signupCounts } from '../data/contractSignups';
import { livePageOf } from '../data/contractCheckout';
import { saveBatch } from '../data/batches';
import { copyText } from '../utils/copyText';
import '../components/ContractPicker.css'; // the ticked list (.cpk__option), as when creating a class

// ------------------------------------------------------------
// A class's Contracts tab (BatchOverview.jsx): the contracts people buy
// to join it, each with its link to share, so the coach never has to go
// to the Contracts page to find one. Laid out like the Classes tab.
//
//   Contract                         Price          Sign-ups
//   (▣) Yoga monthly                 ₹2,000         12     [🔗 Share link] [⋯]
//   (▣) Yoga 6 months                ₹10,000        3      [🔗 Share link] [⋯]
//
// Share link copies the contract's checkout page (what people buy on),
//   and says "✓ Link copied" in green for 3 seconds, as Share Zoom link.
// ⋯: Open contract (its own screen, in a new tab, to change it) and
//   Remove from this class. Removing asks first, saying how many students
//   joined only through it, as they lose the class. The last one can't be
//   removed: a class needs one so people can join.
// + Link contract (top right, beside the tabs; BatchOverview.jsx) opens
//   LinkContractsDialog: the active contracts not linked yet, to tick, with
//   Create a new contract ↗ at the bottom.
// Contracts are also linked on Edit, as before.
//
// ContractsTab: batch, students (studentsOf(batch)), onLink(), onSaid(line)
// LinkContractsDialog: batch, onDone(line), onClose()
// ------------------------------------------------------------

const COPIED_MS = 3000;
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

// The class's contracts that still exist, in the order linked
function linkedOf(batch) {
  const all = new Map(getAllServices().map((c) => [c.id, c]));
  return (batch.contractIds ?? []).map((id) => all.get(id)).filter(Boolean);
}

export function ContractsTab({ batch, students, onLink, onSaid }) {
  const contracts = linkedOf(batch);
  const counts = useMemo(() => signupCounts(contracts), [batch.contractIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const [menuFor, setMenuFor] = useState(null);
  const [removing, setRemoving] = useState(null); // the contract to remove
  const [failed, setFailed] = useState(false);

  if (contracts.length === 0) {
    return (
      <div className="bov-cc__empty">
        <p className="bov-cc__empty-text">No contracts yet. Students join this class by buying one.</p>
        <button type="button" className="oh__add" onClick={onLink}>
          <Link2 size={16} aria-hidden="true" /> Link contract
        </button>
      </div>
    );
  }

  // Students who'd lose the class: the ones in through this contract alone
  const losing = (id) => students.filter((s) => s.contracts.length === 1 && s.contracts[0].id === id).length;
  const remove = () => {
    const ok = saveBatch({ ...batch, contractIds: batch.contractIds.filter((id) => id !== removing.id) });
    if (!ok) {
      setFailed(true);
      return;
    }
    onSaid(`Removed “${removing.title}” from this class.`);
    setRemoving(null);
  };

  return (
    <>
      <div className="wd__st bov-cc">
        <div className="wd__st-row wd__st-row--head" aria-hidden="true">
          <span>Contract</span>
          <span>Price</span>
          <span>Sign-ups</span>
          <span />
        </div>
        <ul className="wd__st-list">
          {contracts.map((c) => (
            <ContractRow
              key={c.id}
              contract={c}
              signups={counts[c.id] ?? 0}
              last={contracts.length === 1}
              menuOpen={menuFor === c.id}
              onMenu={(open) => setMenuFor(open ? c.id : null)}
              onRemove={() => {
                setMenuFor(null);
                setFailed(false);
                setRemoving(c);
              }}
            />
          ))}
        </ul>
      </div>

      {removing && (
        <ConfirmDialog
          title="Remove this contract?"
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        >
          <p>
            {losing(removing.id) > 0
              ? `${plural(losing(removing.id), 'student')} joined through “${removing.title}” and will lose access to this class.`
              : `People who buy “${removing.title}” won’t get into this class any more.`}{' '}
            The contract itself stays on your Contracts page.
          </p>
          {failed && (
            <p className="qinput__error" role="alert">
              We couldn’t save in this browser. Free up some space and try again.
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

function ContractRow({ contract, signups, last, menuOpen, onMenu, onRemove }) {
  const [copied, setCopied] = useState(false);
  const cover = contractOf(contract).cover;
  const share = async () => {
    if (await copyText(livePageOf(contract).share)) {
      setCopied(true);
      window.clearTimeout(share.t);
      share.t = window.setTimeout(() => setCopied(false), COPIED_MS);
    }
  };
  return (
    <li>
      <div className="wd__st-row">
        <span className="bov-cc__name">
          {cover ? (
            <img className="bov-cc__cover" src={cover} alt="" />
          ) : (
            <span className="bov-cc__cover bov-cc__cover--none" aria-hidden="true">
              {contract.title.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <span className="bov-cc__title">{contract.title}</span>
        </span>
        <span className="bov-cc__cell">
          {servicePrice(contract)}
          <span className="bov-cc__phone" aria-hidden="true">
            {' '}
            ·
          </span>
        </span>
        <span className="bov-cc__cell">
          {signups.toLocaleString('en-IN')}
          <span className="bov-cc__phone"> {signups === 1 ? 'sign-up' : 'sign-ups'}</span>
        </span>
        <span className="bov-cc__actions">
          <button
            type="button"
            className={`bov-cc__share ${copied ? 'bov-cc__share--done' : ''}`}
            onClick={share}
            aria-label={`Share link to ${contract.title}`}
          >
            {/* Both labels share one spot, so the button keeps its width */}
            <span className="bov__share-label" aria-hidden={copied}>
              <Link2 size={15} aria-hidden="true" /> Share link
            </span>
            <span className="bov__share-label" aria-hidden={!copied}>
              <Check size={15} aria-hidden="true" /> Link copied
            </span>
          </button>
          <span className="oh__sr-only" aria-live="polite">
            {copied ? 'Link copied' : ''}
          </span>
          <RowMenu
            title={`More for ${contract.title}`}
            open={menuOpen}
            onOpenChange={onMenu}
            items={[
              {
                label: 'Open contract',
                icon: ExternalLink,
                onSelect: () => {
                  onMenu(false);
                  window.open(contractEditUrl(contract.id), '_blank', 'noopener');
                },
              },
              {
                label: 'Remove from this class',
                icon: Trash2,
                danger: true,
                disabled: last,
                hint: last ? 'A class needs one contract, so people can join.' : undefined,
                onSelect: onRemove,
              },
            ]}
          />
        </span>
      </div>
    </li>
  );
}

// + Link contract: the contracts not linked yet, as a plain ticked list
// (the same rows as the contract picker in Create a class, always open,
// so nothing moves under the pointer). Read again when the window gets
// focus, so one made with Create a new contract shows straight away.
function useUnlinked(batch) {
  const read = () => getServices().filter((c) => !(batch.contractIds ?? []).includes(c.id));
  const [list, setList] = useState(read);
  useEffect(() => {
    const refresh = () => setList(read());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return list;
}

export function LinkContractsDialog({ batch, onDone, onClose }) {
  const contracts = useUnlinked(batch);
  const counts = useMemo(() => signupCounts(contracts), [contracts]);
  const [ids, setIds] = useState([]);
  const [failed, setFailed] = useState(false);
  const toggle = (id) => setIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const save = () => {
    const ok = saveBatch({ ...batch, contractIds: [...(batch.contractIds ?? []), ...ids] });
    if (!ok) {
      setFailed(true);
      return;
    }
    onDone(ids.length === 1 ? 'Contract linked.' : `${ids.length} contracts linked.`);
  };
  return (
    <ConfirmDialog
      title="Link contracts"
      confirmLabel={ids.length > 1 ? `Link ${ids.length} contracts` : 'Link contract'}
      confirmDisabled={ids.length === 0}
      form
      closeButton
      onCancel={onClose}
      onConfirm={save}
    >
      <p className="bov-cc__lead">People who buy any of these can join this class.</p>
      <div className="cpk__panel bov-cc__pick">
        {contracts.length === 0 ? (
          <p className="cpk__none">All your contracts are linked already. Make a new one to link it.</p>
        ) : (
          <ul className="cpk__list" role="group" aria-label="Contracts">
            {contracts.map((c) => {
              const on = ids.includes(c.id);
              const n = counts[c.id] ?? 0;
              return (
                <li key={c.id}>
                  <label className={`cpk__option ${on ? 'cpk__option--on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                    <span className="cpk__option-text">
                      <span className="cpk__option-title">{c.title}</span>
                      <span className="cpk__option-meta">
                        {servicePrice(c)} · {n === 0 ? 'No sign-ups yet' : plural(n, 'sign-up')}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <a className="cpk__create" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
          Create a new contract
          <ExternalLink size={14} aria-hidden="true" />
          <span className="oh__sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      {failed && (
        <p className="qinput__error" role="alert">
          We couldn’t save in this browser. Free up some space and try again.
        </p>
      )}
    </ConfirmDialog>
  );
}
