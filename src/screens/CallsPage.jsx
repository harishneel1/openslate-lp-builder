import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Link2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import EditService from './EditService';
import CallOverview, { hoursOf } from './CallOverview';
import CreateCallFlow from './CreateCallFlow';
import { useCopy } from './OfferingsHome';
import CalendarRow from '../components/CalendarPanel';
import DaysOffRow from '../components/DaysOffRow';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { EditPlaceholder } from './EditFrame';
import HoursTip from '../components/HoursTip';
import { markCalendarLost } from '../data/calendarStore';
import { buildProfileJson } from '../data/buildProfileJson';
import {
  callAnswersOf,
  getMyProfile,
  isOnPage,
  myCallIds,
  withAddedCall,
  withCallChanges,
  withoutCall,
} from '../data/myProfile';
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
// question per screen beside its booking page, then "It's ready".
// A click on the row (or its name) opens the call's own page
// (CallOverview.jsx): who has booked it, upcoming, past and cancelled.
// Edit opens the full editor (EditService.jsx), for changing one thing
// fast. Wherever it's opened from, the editor's back button goes to the
// call's page, named after the call: list → call's page → editor, and
// back retraces that.
// A call made here isn't put on the offerings page; back on the list
// it's marked "Just created". It can be booked from its link either way.
// Each call stands on its own, like a Calendly event: its link is
// /<account link>/<call> (accountHandle in myPage.js), so it works
// whether or not they've set up an offerings page, and every card always
// has Copy link, Edit and View live page.
//
// Add ?calendar=lost to the address to see the calendar as if Google
// had stopped letting us in (only when one is connected).
//
// openRequest: { id, n } from elsewhere (a call's contract on the
// Contracts page): open that call's editor, since its contract is changed
// there. Its way back goes to the call's page. n opens it again on a
// second click of the same one.
//
// The way back: like an open webinar, a call's page and its editors put
// the app in focus mode (onFocus, App.jsx): the sidebar steps aside and
// the focus bar's exit goes back, a level at a time:
//   the call's page      ← All 1:1 calls     (to this list)
//   its editor           ← Your call         (to its page; asks first about unsaved changes)
//   a reminder's email   ← Emails            (to its page, on Emails; asks first too)
// None of those screens draws a back button of its own.
// onFocus(focus | null): sets the focus bar (AppLayout's FocusBar)
// ------------------------------------------------------------
export default function CallsPage({ openRequest = null, onFocus }) {
  const [answers, setAnswers] = useSetupAnswers();
  // 'list' ↔ 'details' (one call's page: a click on its row) ↔ 'edit'
  // (one call, in the editor: its Edit button) or 'new' (the guided flow)
  const [view, setView] = useState(openRequest ? 'edit' : 'list');
  const [editingId, setEditingId] = useState(openRequest?.id ?? null); // the call open on its page or in the editor
  // The call page's tab, 'bookings' or 'emails': kept here, so coming back
  // from the call's editor lands on the tab they left
  const [detailsTab, setDetailsTab] = useState('bookings');
  // The reminder open in the email editor, on the call's page, or null
  const [emailOpen, setEmailOpen] = useState(null);
  // The editors' own way back (with their unsaved-changes check), for the focus bar
  const editExitRef = useRef(null);
  const emailExitRef = useRef(null);

  // Asked to open a call: its editor, in place of the list
  useEffect(() => {
    if (!openRequest) return;
    setEditingId(openRequest.id);
    setView('edit');
  }, [openRequest?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const [justAddedId, setJustAddedId] = useState(null);
  const [said, setSaid] = useState(''); // for screen readers: what just changed
  const [menuFor, setMenuFor] = useState(null); // the call whose ⋯ menu is open
  const [deleting, setDeleting] = useState(null); // { id, title, onPage } while the pop-up asks

  // Opening a call's page or its editor from the list
  const openCall = (id, next) => {
    setEditingId(id);
    setJustAddedId(null);
    setDetailsTab('bookings');
    setEmailOpen(null);
    setView(next);
  };

  // Every call's link sits under their account's link, page or no page
  const handle = answers.handle || accountHandle();

  // Every call, newest first, in the same shape My offerings shows
  const calls = useMemo(() => {
    const ids = myCallIds(answers);
    const all = buildProfileJson(getMyProfile(answers)).services;
    return ids.map((id) => all.find((s) => s.id === id)).filter(Boolean);
  }, [answers]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('calendar') === 'lost') markCalendarLost();
  }, []);

  // Back on the list from a call's page, which names the tab after the call
  useEffect(() => {
    if (view === 'list') document.title = '1:1 calls';
  }, [view]);

  // ---------- The focus bar, while a call is open ----------
  const openCallItem = calls.find((c) => c.id === editingId) ?? null;
  const openTitle = openCallItem?.title ?? null;
  const openDetails = openCallItem ? openCallItem.facts.map((f) => f.text).join(' · ') : null;
  useEffect(() => {
    if (!onFocus) return;
    const toList = () => {
      setEmailOpen(null);
      setView('list');
    };
    if (view === 'details' && emailOpen && openTitle) {
      onFocus({
        title: openTitle,
        when: openDetails, // which call's email this is, as a webinar's email shows its date
        icon: Users,
        minimal: true,
        exitLabel: 'Emails',
        onExit: () => (emailExitRef.current ? emailExitRef.current() : setEmailOpen(null)),
      });
    } else if (view === 'details') {
      // Its page shows the name big already: only the way back
      onFocus({ title: openTitle ?? '1:1 call', minimal: true, exitLabel: 'All 1:1 calls', onExit: toList });
    } else if (view === 'edit' && openTitle) {
      onFocus({
        title: openTitle,
        status: false, // the editor saves with its own button, not as you type
        exitLabel: 'Your call',
        onExit: () => (editExitRef.current ? editExitRef.current() : setView('details')),
      });
    } else if (view === 'edit') {
      onFocus({ title: 'Edit call', status: false, exitLabel: 'All 1:1 calls', onExit: toList });
    } else {
      onFocus(null);
    }
  }, [view, emailOpen, openTitle, openDetails, onFocus]);
  // Leaving 1:1 calls (the sidebar, the bell): no focus bar left behind
  useEffect(() => () => onFocus?.(null), [onFocus]);

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
    // Back to the call's page; to the list only if the call is gone
    const backTo = calls.some((c) => c.id === editingId) ? 'details' : 'list';
    return (
      <EditService
        key={editingId}
        from="calls"
        answers={answers}
        serviceId={editingId}
        kind="call"
        // The focus bar's "← Your call" is the way back (asking first about unsaved changes)
        exitRef={editExitRef}
        onBack={() => setView(backTo)}
        onSave={(changes) => setAnswers((prev) => withCallChanges(prev, editingId, changes))}
      />
    );
  }

  if (view === 'details') {
    const call = calls.find((c) => c.id === editingId);
    // Deleted in another tab while it was open: back to the list
    if (!call) {
      return (
        <EditPlaceholder
          title="This call isn’t here"
          sub="It may have been deleted. Go back to see your calls."
          backLabel="1:1 calls"
          onBack={() => setView('list')}
        />
      );
    }
    return (
      <CallOverview
        key={call.id}
        call={call}
        callAnswers={callAnswersOf(answers, call.id)}
        hostName={getMyProfile(answers).creator.name}
        meetingLink={answers.meetingLink}
        url={offeringUrl(handle, call.id)}
        tab={detailsTab}
        onTab={setDetailsTab}
        onSaveCall={(changes) => setAnswers((prev) => withCallChanges(prev, call.id, changes))}
        onBack={() => setView('list')}
        onEdit={() => {
          setEmailOpen(null);
          setView('edit');
        }}
        emailOpen={emailOpen}
        onEmailOpen={setEmailOpen}
        emailExitRef={emailExitRef}
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
                  onOpen={() => openCall(c.id, 'details')}
                  onEdit={() => openCall(c.id, 'edit')}
                  onDelete={() => {
                    setMenuFor(null);
                    // Only worth saying when there's a live page it would come off
                    setDeleting({
                      id: c.id,
                      title: c.title,
                      onPage: Boolean(answers.publishedAt) && isOnPage(answers, c.id),
                    });
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

// One call, as a full-width row: what it is on the left (name, details with
// the price, when it can be booked), what you can do on the right
// (Copy link · Edit · View live page · ⋯). On a narrow screen the actions go
// under. Clicking the row anywhere else opens the call's page (onOpen);
// Edit goes straight to the editor.
// url: its own link, to share or open
function CallRow({ call, url, isNew, menuOpen, onMenu, onOpen, onEdit, onDelete }) {
  const details = call.facts.map((f) => f.text).join(' · ');
  const [copy, copyLink] = useCopy();
  const hours = useMemo(() => hoursOf(call.id).line, [call.id]);

  return (
    <li
      className={`oh-row calls__row ${isNew ? 'oh-row--new' : ''} ${menuOpen ? 'oh-row--menu' : ''}`}
      // Anywhere on the row opens the call's page, except its own buttons and links
      onClick={(e) => {
        if (e.target.closest('button, a, [role="menu"], [role="dialog"]')) return;
        onOpen();
      }}
    >
      <div className="oh-row__text">
        {isNew && <span className="oh-card__new">Just created</span>}
        <h3 className="oh-row__name">
          {/* The name is the row's control for keyboards and screen readers */}
          <button type="button" className="calls__open" onClick={onOpen}>
            {call.title}
          </button>
        </h3>
        <p className="oh-row__detail">
          {details} ·{' '}
          <span className={call.price.isFree ? 'oh-row__price oh-row__price--free' : 'oh-row__price'}>
            {call.price.label}
          </span>
        </p>
        <HoursTip callId={call.id} line={hours} className="oh-row__hours" />
      </div>

      <div className="oh-row__actions">
        <button
          type="button"
          className="oh-card__copy"
          onClick={() => copyLink(url)}
          aria-label={`Copy link to ${call.title}`}
        >
          {copy === 'copied' ? (
            <Check size={16} strokeWidth={3} aria-hidden="true" />
          ) : (
            <Link2 size={16} aria-hidden="true" />
          )}
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