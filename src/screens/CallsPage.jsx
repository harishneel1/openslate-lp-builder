import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Link2, Pencil, Plus, Users } from 'lucide-react';
import EditService from './EditService';
import CreateCallFlow from './CreateCallFlow';
import { useCopy } from './OfferingsHome';
import CalendarRow from '../components/CalendarPanel';
import { markCalendarLost } from '../data/calendarStore';
import { buildProfileJson } from '../data/buildProfileJson';
import { getMyProfile, myCallIds, withAddedCall, withCallChanges } from '../data/myProfile';
import { offeringUrl } from '../data/myPage';
import { useSetupAnswers } from '../utils/useSetupAnswers';
import './OfferingsHome.css'; // the same panels, cards and buttons as My offerings
import './CallsPage.css';

// ------------------------------------------------------------
// The 1:1 calls tab: where calls are made and managed, and nothing
// else. It never talks about the offerings page: which calls show there
// is chosen on My offerings.
//
//   ┌ Calendar   G harish@…  ● Connected                    [Manage] ┐
//   ┌ Your calls 3                                [+ Create a 1:1 call] ┐
//   │ [call] [call] [call]   each: name, price, details,            │
//   └                        Copy link · Edit · Preview              ┘
//
// Create a 1:1 call is guided, every time (CreateCallFlow.jsx): one
// question per screen beside its booking page, then "It's ready". Edit
// opens the full editor (EditService.jsx), for changing one thing fast.
// A call made here isn't put on the offerings page; back on the list
// it's marked "Just created". It can be booked from its link either way.
// A call's link is built from their page link (/<handle>/<call>), so
// before they've picked one, cards show Edit only, without saying why.
// The link works as soon as it's picked, before the rest of setup.
//
// Add ?calendar=lost to the address to see the calendar as if Google
// had stopped letting us in (only when one is connected).
// ------------------------------------------------------------
export default function CallsPage() {
  const [answers, setAnswers] = useSetupAnswers();
  // 'list' ↔ 'edit' (one call, in the editor) or 'new' (the guided flow)
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);
  const [said, setSaid] = useState(''); // for screen readers: what just changed

  // Calls have links as soon as there's a page link to build them from
  const hasLinks = Boolean(answers.handle);

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
        handle={answers.handle ?? null}
        hasLinks={hasLinks}
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

  return (
    <div className="oh calls">
      <h1 className="oh__title">1:1 calls</h1>
      <p className="calls__lead">Video calls people book with you, at a time that suits them.</p>

      {/* The calendar every call books into */}
      <section className="oh__panel calls__settings" aria-label="Calendar">
        <CalendarRow />
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
            <div className="oh__grid">
              {calls.map((c) => (
                <CallCard
                  key={c.id}
                  call={c}
                  url={hasLinks ? offeringUrl(answers.handle, c.id) : null}
                  isNew={c.id === justAddedId}
                  onEdit={() => {
                    setEditingId(c.id);
                    setJustAddedId(null);
                    setView('edit');
                  }}
                />
              ))}
            </div>
          )}
          <p className="oh__sr-only" aria-live="polite">
            {said}
          </p>
        </div>
      </section>
    </div>
  );
}

// One call: what it is, then Copy link · Edit · Preview.
// The same card as My offerings (OfferingCard).
// url: its own link, or null when there isn't one yet (Edit only)
function CallCard({ call, url, isNew, onEdit }) {
  const details = call.facts.map((f) => f.text).join(' · ');
  const [copy, copyLink] = useCopy();

  return (
    <article className={`oh-card ${isNew ? 'oh-card--new' : ''}`}>
      <div className="oh-card__head">
        {isNew && <span className="oh-card__new">Just created</span>}
        <div className="oh-card__title-row">
          <h3 className="oh-card__name">{call.title}</h3>
          <span className={`oh-card__price ${call.price.isFree ? 'oh-card__price--free' : ''}`}>{call.price.label}</span>
        </div>
        <p className="oh-card__detail">{details}</p>
      </div>

      <div className={`oh-card__actions ${url ? '' : 'calls-card__actions--edit-only'}`}>
        {url && (
          <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${call.title}`}>
            {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copy === 'copied' ? 'Copied' : 'Copy link'}
          </button>
        )}
        <button type="button" className="oh__edit oh-card__edit" onClick={onEdit} aria-label={`Edit ${call.title}`}>
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        {url && (
          <a
            className="oh__edit oh-card__preview"
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={`Preview the booking page for ${call.title} (opens in a new tab)`}
            data-tip="Preview"
            data-tip-align="end"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        )}
      </div>

      <span className="oh__sr-only" aria-live="polite">
        {copy === 'copied' && `Link to ${call.title} copied`}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error oh-card__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
        </p>
      )}
    </article>
  );
}