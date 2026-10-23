import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Link2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import EditService from './EditService';
import CreateCallFlow from './CreateCallFlow';
import { useCopy } from './OfferingsHome';
import CalendarRow from '../components/CalendarPanel';
import DaysOffRow from '../components/DaysOffRow';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { markCalendarLost } from '../data/calendarStore';
import { buildProfileJson } from '../data/buildProfileJson';
import { getMyProfile, isOnPage, myCallIds, withAddedCall, withCallChanges, withoutCall } from '../data/myProfile';
import { loadCallHours } from '../data/availabilityStore';
import { weekSummary } from '../utils/weeklyHours';
import { accountHandle, offeringUrl } from '../data/myPage';
import { useSetupAnswers } from '../utils/useSetupAnswers';
import './OfferingsHome.css'; // the same panels, cards and buttons as My offerings
import './CallsPage.css';

// ------------------------------------------------------------
// The 1:1 calls tab: where calls are made and managed, and nothing
// else. It never talks about the offerings page: which calls show there
// is chosen on My offerings.
//
//   ┌ Calendar   G harish@…  ● Connected                    [Manage] ┐
//   └ Days off   26–28 Oct, 2 Nov                         [Manage] ┘
//   ┌ Your calls 3                                [+ Create a 1:1 call] ┐
//   │ Discovery call      [Copy link] [Edit] [↗ View live page] [⋯]  │
//   │ Video call · 30 min · Free                                     │
//   │ Mon–Fri, 9 am – 5 pm                                           │
//   └ (one full-width row per call, like Calendly's event types)     ┘
//
// ⋯ holds Delete, which always asks first (ConfirmDialog).
//
// Create a 1:1 call is guided, every time (CreateCallFlow.jsx): one
// question per screen beside its booking page, then "It's ready". Edit (or
// a click on the row) opens the full editor (EditService.jsx), for changing
// one thing fast.
// A call made here isn't put on the offerings page; back on the list
// it's marked "Just created". It can be booked from its link either way.
// Each call stands on its own, like a Calendly event: its link is
// /<account link>/<call> (accountHandle in myPage.js), so it works
// whether or not they've set up an offerings page, and every card always
// has Copy link, Edit and View live page.
//
// Add ?calendar=lost to the address to see the calendar as if Google
// had stopped letting us in (only when one is connected).
// ------------------------------------------------------------
export default function CallsPage() {
  const [answers, setAnswers] = useSetupAnswers();
  // 'list' ↔ 'edit' (one call, in the editor: its Edit button, or a click
  // anywhere on its row) or 'new' (the guided flow)
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);
  const [said, setSaid] = useState(''); // for screen readers: what just changed
  const [menuFor, setMenuFor] = useState(null); // the call whose ⋯ menu is open
  const [deleting, setDeleting] = useState(null); // { id, title, onPage } while the pop-up asks

  // Every call's link sits under their account's link, page or no page
  const handle = answers.handle || accountHandle();

  // Every call, newest first, in the same shape My offerings shows
  const calls = useMemo(() => {
    const ids = myCallIds(answers);
    const all = buildProfileJson(getMyProfile(answers)).services;
    return ids.map((id) => all.find((s) => s.id === id)).filter(Boolean);
  }, [answers]);

  useEffect(() => {
    document.title = '1:1 calls';
    if (new URLSearchParams(window.location.search).get('calendar') === 'lost') markCalendarLost();
  }, []);

  if (view === 'new') {
    return (
      <CreateCallFlow
        handle={handle}
        hasLinks
        onExit={() => setView('list')}
        // Made here: created, not put on the offerings page (that's chosen there)
        onCreate={(call) => setAnswers((prev) => withAddedCall(prev, call, { onPage: false }))}
        onDone={(id) => {
          setJustAddedId(id);
          setSaid('Your new call is created.');
          setView('list');
        }}
      />
    );
  }

  if (view === 'edit') {
    return (
      <EditService
        key={editingId}
        from="calls"
        answers={answers}
        serviceId={editingId}
        kind="call"
        onBack={() => setView('list')}
        onSave={(changes) => setAnswers((prev) => withCallChanges(prev, editingId, changes))}
      />
    );
  }

  const create = () => {
    setJustAddedId(null);
    setView('new');
  };

  // Delete: asked first, then gone from here, the offerings page and its link
  const confirmDelete = () => {
    const { id, title } = deleting;
    setAnswers((prev) => withoutCall(prev, id));
    if (justAddedId === id) setJustAddedId(null);
    setDeleting(null);
    setSaid(`${title} deleted.`);
  };

  return (
    <div className="oh calls">
      <h1 className="oh__title">1:1 calls</h1>
      <p className="calls__lead">Schedule your 1:1 meetings here.</p>

      {/* Settings for every call: the calendar they book into, and days away */}
      <section className="oh__panel calls__settings" aria-label="Calendar and days off">
        <CalendarRow />
        <DaysOffRow />
      </section>

      <section className="oh__panel" aria-labelledby="calls-title">
        <div className="oh__panel-head oh__panel-head--split">
          <div>
            <h2 className="oh__panel-title" id="calls-title">
              Your calls {calls.length > 0 && <span className="oh__count">{calls.length}</span>}
            </h2>
          </div>
          {calls.length > 0 && (
            <button type="button" className="oh__add" onClick={create}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a 1:1 call
            </button>
          )}
        </div>

        <div className="oh__panel-body">
          {calls.length === 0 ? (
            <div className="calls__empty">
              <span className="calls__empty-icon" aria-hidden="true">
                <Users size={22} />
              </span>
              <h3 className="calls__empty-title">No 1:1 calls yet</h3>
              <p className="calls__empty-text">Create your first one. It can be free or paid.</p>
              <button type="button" className="oh__add" onClick={create}>
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a 1:1 call
              </button>
            </div>
          ) : (
            <ul className="oh__rows">
              {calls.map((c) => (
                <CallRow
                  key={c.id}
                  call={c}
                  url={offeringUrl(handle, c.id)}
                  isNew={c.id === justAddedId}
                  menuOpen={menuFor === c.id}
                  onMenu={(open) => setMenuFor(open ? c.id : null)}
                  onEdit={() => {
                    setEditingId(c.id);
                    setJustAddedId(null);
                    setView('edit');
                  }}
                  onDelete={() => {
                    setMenuFor(null);
                    // Only worth saying when there's a live page it would come off
                    setDeleting({ id: c.id, title: c.title, onPage: Boolean(answers.publishedAt) && isOnPage(answers, c.id) });
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

      {/* Delete: always asked first. Says what deleting does: its link stops
          working, it comes off the offerings page (when it's on a live one),
          bookings already made stay. */}
      {deleting && (
        <ConfirmDialog
          title="Delete this call?"
          confirmLabel="Delete call"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>“{deleting.title}”</strong> will be deleted and its link will stop working
            {deleting.onPage ? ', and it will come off your storefront' : ''}. Calls already booked aren’t affected.
            This can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// When it can be booked, in a few words: "Mon–Fri, 9 am – 5 pm", with
// "+ 1 more" when days have different hours. From the call's own hours.
function hoursLine(id) {
  const { open } = weekSummary(loadCallHours(id).weekly);
  if (open.length === 0) return 'No hours set';
  const first = `${open[0].days}, ${open[0].hours}`;
  return open.length > 1 ? `${first} + ${open.length - 1} more` : first;
}

// One call, as a full-width row: what it is on the left (name, details with
// the price, when it can be booked), what you can do on the right
// (Copy link · Edit · View live page · ⋯). On a narrow screen the actions go
// under. Clicking the row anywhere else opens the editor, like Edit.
// url: its own link, to share or open
function CallRow({ call, url, isNew, menuOpen, onMenu, onEdit, onDelete }) {
  const details = call.facts.map((f) => f.text).join(' · ');
  const [copy, copyLink] = useCopy();
  const hours = useMemo(() => hoursLine(call.id), [call.id]);

  return (
    <li
      className={`oh-row calls__row ${isNew ? 'oh-row--new' : ''} ${menuOpen ? 'oh-row--menu' : ''}`}
      // Anywhere on the row opens it in the editor, like its Edit button,
      // except its own buttons and links
      onClick={(e) => {
        if (e.target.closest('button, a, [role="menu"], [role="dialog"]')) return;
        onEdit();
      }}
    >
      <div className="oh-row__text">
        {isNew && <span className="oh-card__new">Just created</span>}
        <h3 className="oh-row__name">
          {/* The name is the row's control for keyboards and screen readers */}
          <button type="button" className="calls__open" onClick={onEdit}>
            {call.title}
          </button>
        </h3>
        <p className="oh-row__detail">
          {details} ·{' '}
          <span className={call.price.isFree ? 'oh-row__price oh-row__price--free' : 'oh-row__price'}>
            {call.price.label}
          </span>
        </p>
        <p className="oh-row__hours">{hours}</p>
      </div>

      <div className="oh-row__actions">
        <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${call.title}`}>
          {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copy === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="oh__edit oh-card__edit" onClick={onEdit} aria-label={`Edit ${call.title}`}>
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        <a
          className="oh__edit oh-card__edit calls__live"
          href={url}
          target="_blank"
          rel="noopener"
          aria-label={`View the live page for ${call.title} (opens in a new tab)`}
        >
          <ExternalLink size={15} aria-hidden="true" /> View live page
        </a>
        <RowMenu
          title={call.title}
          open={menuOpen}
          onOpenChange={onMenu}
          items={[{ label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete }]}
        />
      </div>

      <span className="oh__sr-only" aria-live="polite">
        {copy === 'copied' && `Link to ${call.title} copied`}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error oh-row__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
        </p>
      )}
    </li>
  );
}