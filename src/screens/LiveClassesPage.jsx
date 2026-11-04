import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Link2, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import CreateBatchFlow from './CreateBatchFlow';
import BatchOverview from './BatchOverview';
import EditBatch from './EditBatch';
import BatchAnnounce from './BatchAnnounce';
import { EditPlaceholder } from './EditFrame';
import { useCopy } from './OfferingsHome';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { cancelClass, classDay, deleteBatch, feeLine, getBatch, loadBatches, onBatchesChange, scheduleLine } from '../data/batches';
import { deleteMembersOf, everJoined, memberCount, membersOf, onMembersChange, pendingLine, pendingOf, statusCounts } from '../data/batchMembers';
import { appNow } from '../utils/testClock';
import { deleteService } from '../data/mockServices';
import { accountHandle, mockAccount, offeringUrl } from '../data/myPage';
import './OfferingsHome.css'; // the same panels, rows and buttons as 1:1 calls
import './CallsPage.css';
import './LiveClassesPage.css';

// ------------------------------------------------------------
// The Live classes tab: a coach's batches, the classes that meet on the
// same days every week ("Morning Yoga, Mon–Sat, 6:30 am"). Laid out like
// 1:1 calls:
//
//   Live classes
//   Classes that meet every week. People join by paying a monthly fee.
//   ┌ Your batches 2                                [+ Create a batch] ┐
//   │ Morning Yoga        [Copy link] [Edit] [↗ View live page] [⋯] │
//   │ Mon–Sat · 6:30–7:30 am · ₹2,000/month · 18 members             │
//   └────────────────────────────────────────────────────────────────┘
//
// A click on a row opens the batch's page (BatchOverview.jsx): Members and
// Classes. Edit opens its editor (EditBatch.jsx). Create a batch is the
// guided flow (CreateBatchFlow.jsx). ⋯ holds Delete, only for a batch
// nobody has ever joined: its contract holds their payments, removed
// members' too, so it stays.
//
// Under each row, who's in and who needs the coach (batchMembers.js):
//   18 members · 2 payments pending (1 for over 5 days)
//
// Each batch's link sits under the account's link, like a 1:1 call's:
// /<account link>/<batch id>, which opens its join page (BatchPage.jsx).
//
// The way back, as for 1:1 calls: a batch's page and its editor put the
// app in focus mode (onFocus, App.jsx):
//   the batch's page   ← All batches   (to this list)
//   its editor         ← Your batch    (to its page; asks first about unsaved changes)
//   cancelling a class ← Your batch   (BatchAnnounce.jsx; asks first if the email changed)
//
// openRequest: { id, tab, n } from elsewhere (the bell, a batch's contract
//   on Contracts): open that batch's page on that tab. n opens it again
//   on a second click of the same one.
// onFocus(focus | null): sets the focus bar (AppLayout's FocusBar)
// ------------------------------------------------------------

function useBatches() {
  const read = () =>
    loadBatches().map((b) => ({ ...b, members: memberCount(b.id), ever: everJoined(b.id), counts: statusCounts(b, appNow()) }));
  const [batches, setBatches] = useState(read);
  useEffect(() => {
    const refresh = () => setBatches(read());
    const stopBatches = onBatchesChange(refresh);
    const stopMembers = onMembersChange(refresh);
    return () => {
      stopBatches();
      stopMembers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return batches;
}

export default function LiveClassesPage({ openRequest = null, onFocus }) {
  const batches = useBatches();
  // 'list' ↔ 'details' (a batch's page) ↔ 'edit' (its editor), or 'new'
  const [view, setView] = useState(openRequest ? 'details' : 'list');
  const [openId, setOpenId] = useState(openRequest?.id ?? null);
  const [tab, setTab] = useState(openRequest?.tab ?? 'classes'); // Classes is the first tab
  const [justAddedId, setJustAddedId] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [deleting, setDeleting] = useState(null); // the batch while the pop-up asks
  const [said, setSaid] = useState('');
  const editExitRef = useRef(null);
  const announceExitRef = useRef(null);
  // The class being cancelled: { kind: 'cancel', date }
  const [announce, setAnnounce] = useState(null);
  // A line on the Classes tab after one's sent ("Class on Thu 13 Nov cancelled…")
  const [classNotice, setClassNotice] = useState(null);

  const handle = accountHandle();
  const urlOf = (id) => offeringUrl(handle, id);

  // Asked to open a batch (the bell, Contracts): its page, on that tab
  useEffect(() => {
    if (!openRequest) return;
    setOpenId(openRequest.id);
    setTab(openRequest.tab ?? 'classes');
    setView('details');
  }, [openRequest?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'list') document.title = 'Live classes';
  }, [view]);

  const open = batches.find((b) => b.id === openId) ?? null;

  // ---------- The focus bar, while a batch is open ----------
  const openTitle = open?.title ?? null;
  useEffect(() => {
    if (!onFocus) return;
    const toList = () => setView('list');
    if (view === 'details') {
      onFocus({ title: openTitle ?? 'Batch', minimal: true, exitLabel: 'All batches', onExit: toList });
    } else if (view === 'announce') {
      onFocus({
        title: openTitle ?? 'Batch',
        minimal: true,
        exitLabel: 'Your batch',
        onExit: () => {
          if (announceExitRef.current && announceExitRef.current() === false) return;
          setView('details');
        },
      });
    } else if (view === 'edit') {
      onFocus({
        title: openTitle ?? 'Edit batch',
        status: false, // the editor saves with its own button
        exitLabel: 'Your batch',
        onExit: () => (editExitRef.current ? editExitRef.current() : setView('details')),
      });
    } else {
      // The list, and Create a batch (which has its own way back, as Create a 1:1 call does)
      onFocus(null);
    }
  }, [view, openTitle, onFocus]);
  // Leaving Live classes: no focus bar left behind
  useEffect(() => () => onFocus?.(null), [onFocus]);

  const openBatch = (id, next) => {
    setClassNotice(null);
    setOpenId(id);
    setJustAddedId(null);
    setTab('classes');
    setView(next);
  };

  if (view === 'new') {
    return (
      <CreateBatchFlow
        url={urlOf}
        onExit={() => setView('list')}
        onDone={(id) => {
          setJustAddedId(id);
          setOpenId(id);
          setTab('classes');
          setView('details');
        }}
      />
    );
  }

  if ((view === 'details' || view === 'edit' || view === 'announce') && !open) {
    return (
      <EditPlaceholder
        title="This batch isn’t here"
        sub="It may have been deleted. Go back to see your batches."
        backLabel="Live classes"
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'announce' && announce) {
    const now = appNow();
    const members = membersOf(open, now).filter((m) => m.status !== 'removed');
    const back = () => {
      setTab('classes');
      setView('details');
    };
    return (
      <BatchAnnounce
        key={JSON.stringify(announce)}
        batch={open}
        change={announce}
        members={members}
        hostName={mockAccount.name}
        now={now}
        guardRef={announceExitRef}
        onClose={back}
        onConfirm={(told) => {
          const fresh = getBatch(open.id) ?? open;
          const ok = cancelClass(fresh, announce.date, told, now);
          const who = told.email > 0 ? ` ${told.email} ${told.email === 1 ? 'member was' : 'members were'} told.` : '';
          setClassNotice(
            ok ? `The class on ${classDay(announce.date, null)} is cancelled.${who}` : 'That couldn’t be saved. Try again.',
          );
          back();
        }}
      />
    );
  }

  if (view === 'edit') {
    return <EditBatch key={open.id} batch={open} exitRef={editExitRef} onBack={() => setView('details')} />;
  }

  if (view === 'details') {
    return (
      <BatchOverview
        key={open.id}
        batch={open}
        url={urlOf(open.id)}
        tab={tab}
        onTab={(t) => {
          setClassNotice(null);
          setTab(t);
        }}
        onEdit={() => setView('edit')}
        onAnnounce={(change) => {
          setClassNotice(null);
          setAnnounce(change);
          setView('announce');
        }}
        classNotice={tab === 'classes' ? classNotice : null}
      />
    );
  }

  const create = () => {
    setJustAddedId(null);
    setView('new');
  };

  const confirmDelete = () => {
    const { id, title, contractId } = deleting;
    deleteBatch(id);
    deleteMembersOf(id);
    if (contractId) deleteService(contractId); // its own contract; nobody holds it
    setDeleting(null);
    setSaid(`${title} deleted.`);
  };

  return (
    <div className="oh calls lc">
      <h1 className="oh__title">Live classes</h1>
      <p className="calls__lead">Classes that meet every week. People join by paying a monthly fee.</p>

      <section className="oh__panel" aria-labelledby="lc-title">
        <div className="oh__panel-head oh__panel-head--split">
          <div>
            <h2 className="oh__panel-title" id="lc-title">
              Your batches {batches.length > 0 && <span className="oh__count">{batches.length}</span>}
            </h2>
          </div>
          {batches.length > 0 && (
            <button type="button" className="oh__add" onClick={create}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a batch
            </button>
          )}
        </div>

        <div className="oh__panel-body">
          {batches.length === 0 ? (
            <div className="calls__empty">
              <span className="calls__empty-icon" aria-hidden="true">
                <Repeat size={22} />
              </span>
              <h3 className="calls__empty-title">Create your first batch</h3>
              <p className="calls__empty-text">
                Set the days, time and monthly fee once. People join from its link and pay every month.
              </p>
              <button type="button" className="oh__add" onClick={create}>
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a batch
              </button>
            </div>
          ) : (
            <ul className="oh__rows">
              {batches.map((b) => (
                <BatchRow
                  key={b.id}
                  batch={b}
                  url={urlOf(b.id)}
                  isNew={b.id === justAddedId}
                  menuOpen={menuFor === b.id}
                  onMenu={(isOpen) => setMenuFor(isOpen ? b.id : null)}
                  onOpen={() => openBatch(b.id, 'details')}
                  onEdit={() => openBatch(b.id, 'edit')}
                  onDelete={() => {
                    setMenuFor(null);
                    setDeleting(b);
                  }}
                />
              ))}
            </ul>
          )}
          <p className="oh__sr-only" aria-live="polite">
            {said}
          </p>
        </div>
      </section>

      {deleting && (
        <ConfirmDialog
          title="Delete this batch?"
          confirmLabel="Delete batch"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>“{deleting.title}”</strong> and its contract will be deleted, and its link will stop working. This
            can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// One batch, as a full-width row like a 1:1 call's. Clicking the row
// anywhere but its buttons opens the batch's page.
function BatchRow({ batch, url, isNew, menuOpen, onMenu, onOpen, onEdit, onDelete }) {
  const [copy, copyLink] = useCopy();
  const members = batch.members;
  const pending = pendingOf(batch.counts);
  return (
    <li
      className={`oh-row calls__row ${isNew ? 'oh-row--new' : ''} ${menuOpen ? 'oh-row--menu' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button, a, [role="menu"], [role="dialog"]')) return;
        onOpen();
      }}
    >
      <div className="oh-row__text">
        {isNew && <span className="oh-card__new">Just created</span>}
        <h3 className="oh-row__name">
          <button type="button" className="calls__open" onClick={onOpen}>
            {batch.title}
          </button>
        </h3>
        <p className="oh-row__detail">
          {scheduleLine(batch)} · <span className="oh-row__price">{feeLine(batch)}</span>
        </p>
        <p className="lc__members">
          {members === 0 && batch.ever === 0 ? (
            'Nobody has joined yet'
          ) : (
            <>
              {`${members} ${members === 1 ? 'member' : 'members'}`}
              {pending.pending > 0 && (
                <span className={`lc__due ${pending.late > 0 ? 'lc__due--late' : ''}`}> · {pendingLine(pending)}</span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="oh-row__actions">
        <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${batch.title}`}>
          {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copy === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="oh__edit oh-card__edit" onClick={onEdit} aria-label={`Edit ${batch.title}`}>
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        <a
          className="oh__edit oh-card__edit calls__live"
          href={url}
          target="_blank"
          rel="noopener"
          aria-label={`View the live page for ${batch.title} (opens in a new tab)`}
        >
          <ExternalLink size={15} aria-hidden="true" /> View live page
        </a>
        <RowMenu
          title={batch.title}
          open={menuOpen}
          onOpenChange={onMenu}
          items={[
            {
              label: 'Delete',
              icon: Trash2,
              danger: true,
              onSelect: onDelete,
              disabled: batch.ever > 0,
              hint: batch.ever > 0 ? 'People have joined, so it can’t be deleted.' : undefined,
            },
          ]}
        />
      </div>

      <span className="oh__sr-only" aria-live="polite">
        {copy === 'copied' && `Link to ${batch.title} copied`}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error oh-row__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
        </p>
      )}
    </li>
  );
}