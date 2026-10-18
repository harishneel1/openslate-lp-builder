import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import CallDetailsInput, { ShortDescriptionField } from '../components/CallDetailsInput';
import CallAboutInput from '../components/CallAboutInput';
import { MY_CALL_ID } from '../data/myProfile';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { CALL_DEFAULTS, callAboutOf, callDescriptionOf, callDetailsComplete } from '../data/callDetails';
import '../components/QuestionInput.css'; // field styles the call details use
import './EditService.css';

// The call's answers this screen edits. Anything else in the answers is left alone.
const FIELDS = [
  'callTitle',
  'callDuration',
  'callFormat',
  'callPricing',
  'callPrice',
  'callComparePrice',
  'callDescription',
  'callAbout',
];

// ------------------------------------------------------------
// Editing one offering, opened from its card on the offerings home:
// Basics (name, length, format, price) and Descriptions (short and long).
// Changes stay on this screen until Save, so a half-typed price never
// reaches the live page. Leaving with unsaved changes asks first.
//
// serviceId null: "Add a new offering" (a placeholder for now).
// onSave(changes): merges the changed answers into the saved ones.
// ------------------------------------------------------------
export default function EditService({ answers, serviceId, onBack, onSave }) {
  if (!serviceId) return <AddOfferingSoon onBack={onBack} />;
  return <EditCall answers={answers} onBack={onBack} onSave={onSave} />;
}

function EditCall({ answers, onBack, onSave }) {
  // What's saved, with the starting choices filled in, so the form opens unchanged.
  // The short description is fixed to what's on the page now: during setup it
  // follows the name, but renaming a live call shouldn't rewrite its description.
  const saved = useMemo(
    () => ({ ...CALL_DEFAULTS, ...answers, callDescription: callDescriptionOf(answers) }),
    [answers],
  );
  const [edits, setEdits] = useState({}); // only what they've changed since the last save
  const [formKey, setFormKey] = useState(0); // bumped on Discard, so the form starts afresh
  const [justSaved, setJustSaved] = useState(false);
  const [leaving, setLeaving] = useState(false); // "Leave without saving?" showing
  const savedTimer = useRef(null);

  const draft = useMemo(() => ({ ...saved, ...edits }), [saved, edits]);
  const changed = FIELDS.filter((id) => id in edits && edits[id] !== saved[id]);
  const dirty = changed.length > 0;
  // What's stopping a save, if anything
  const problem = !callDetailsComplete(draft)
    ? 'Add a name and a price (or make it free) to save'
    : callAboutOf(draft).trim() === ''
      ? 'Add a long description to save'
      : null;
  const valid = !problem;

  // Closing the tab with unsaved changes: the browser asks first
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const handleChange = (value, id) => {
    if (!FIELDS.includes(id)) return;
    setEdits((prev) => ({ ...prev, [id]: value }));
    setJustSaved(false);
    setLeaving(false);
  };

  const save = () => {
    if (!dirty || !valid) return;
    const changes = Object.fromEntries(changed.map((id) => [id, edits[id]]));
    // Still following the name? Keep the text that's showing, so a rename doesn't change it
    if (answers.callDescription === undefined && !('callDescription' in changes)) {
      changes.callDescription = saved.callDescription;
    }
    onSave(changes);
    setEdits({});
    setJustSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 3000);
  };

  const discard = () => {
    setEdits({});
    setFormKey((k) => k + 1);
    setLeaving(false);
  };

  const back = () => (dirty ? setLeaving(true) : onBack());

  return (
    <div className="es">
      <div className="es__content">
        <button type="button" className="es__back" onClick={back}>
          <ArrowLeft size={16} aria-hidden="true" /> Your offerings page
        </button>
        <h1 className="es__title">{saved.callTitle || 'Your call'}</h1>
        <p className="es__sub">Changes show up on your page once you save them.</p>

        {/* Back pressed with unsaved changes */}
        {leaving && (
          <div className="es__leave" role="alert">
            <p>
              <strong>You have unsaved changes.</strong> Leave without saving them?
            </p>
            <div className="es__leave-actions">
              <button type="button" className="es__btn es__btn--quiet" onClick={() => setLeaving(false)}>
                Keep editing
              </button>
              <button type="button" className="es__btn es__btn--danger" onClick={onBack}>
                Leave without saving
              </button>
            </div>
          </div>
        )}

        <section className="es__panel" aria-labelledby="es-basics">
          <div className="es__panel-head">
            <h2 className="es__panel-title" id="es-basics">
              Basics
            </h2>
            <p className="es__panel-sub">The name, length, format and price people see before they book.</p>
          </div>
          <div className="es__panel-body">
            <CallDetailsInput key={formKey} answers={draft} onChange={handleChange} showDescription={false} />
          </div>
        </section>

        <section className="es__panel" aria-labelledby="es-descriptions">
          <div className="es__panel-head">
            <h2 className="es__panel-title" id="es-descriptions">
              Descriptions
            </h2>
            <p className="es__panel-sub">What people read about your call before they book.</p>
          </div>
          <div className="es__panel-body es__fields" key={formKey}>
            <ShortDescriptionField
              answers={draft}
              onChange={handleChange}
              note={
                <WhereItShows
                  text="Shows on your call’s card at"
                  href={pageUrl(saved.handle)}
                  label={`${PAGE_DOMAIN}/${saved.handle}`}
                />
              }
            />
            <CallAboutInput
              answers={draft}
              onChange={handleChange}
              label="Long description"
              showNote={false}
              note={<WhereItShows text="Shows on" href={BOOKING_HREF} label="your booking page" />}
            />
          </div>
        </section>
      </div>

      {/* ---------- Save bar: full width, pinned to the bottom of the window ---------- */}
      <div className="es__bar">
        <div className="es__bar-inner">
          <p className="es__status" aria-live="polite">
            {dirty && problem}
            {dirty && valid && 'You have unsaved changes'}
            {!dirty && justSaved && (
              <span className="es__saved">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> Changes saved. They’re on your page now.
              </span>
            )}
          </p>
          <div className="es__bar-actions">
            {dirty && (
              <button type="button" className="es__btn es__btn--quiet" onClick={discard}>
                Discard changes
              </button>
            )}
            <button type="button" className="es__btn es__btn--primary" onClick={save} disabled={!dirty || !valid}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Their call's booking page (the same link as Preview on the offerings home)
const BOOKING_HREF = `?mock=book&service=${MY_CALL_ID}`;

// One line under a description: where it shows, with a link to see it.
// The link opens the live page, so it shows what's saved.
function WhereItShows({ text, href, label }) {
  return (
    <span className="es__where">
      {text}{' '}
      <a href={href} target="_blank" rel="noopener">
        {label}
        <ExternalLink size={13} aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </span>
  );
}

// "Add a new offering": only 1:1 calls exist so far
function AddOfferingSoon({ onBack }) {
  return (
    <div className="es">
      <div className="es__content">
        <button type="button" className="es__back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Your offerings page
        </button>
        <h1 className="es__title">Add a new offering</h1>
        <p className="es__sub">Adding offerings from here is on its way.</p>
      </div>
    </div>
  );
}