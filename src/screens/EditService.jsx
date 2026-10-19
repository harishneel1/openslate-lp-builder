import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import EditFrame, { EditPlaceholder, EditSection, useEditDraft } from './EditFrame';
import CallDetailsInput, { ShortDescriptionField } from '../components/CallDetailsInput';
import CallAboutInput from '../components/CallAboutInput';
import ServicePickInput from '../components/ServicePickInput';
import { callAnswersOf, newCallId } from '../data/myProfile';
import { createMockService, getService, servicePrice } from '../data/mockServices';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { CALL_DEFAULTS, callAboutOf, callDescriptionOf, callDetailsProblem, newCallAbout, readMeetingLink } from '../data/callDetails';
import { loadSchedule } from '../data/availabilityStore';
import { timeZones } from '../data/timeZones';
import { durationLabel } from '../data/serviceKinds';
import { longestBlock, weekSummary } from '../utils/weeklyHours';
import '../components/QuestionInput.css'; // field styles the call details use
import './QuestionFlow.css'; // the picker's "Create your first service" button
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
  'serviceId',
  'meetingLink', // shared by all their video calls: saved on the setup answers (see myProfile.js)
];

// A new call also chooses how it gets its service: 'auto' (made for it from
// its name and price when it's added) or 'pick' (one of theirs). Not saved.
const NEW_FIELDS = [...FIELDS, 'serviceMode'];

// Which answers belong to which section, for its "Edited" tag
const SECTION_FIELDS = {
  basics: ['callTitle', 'callDuration', 'callFormat', 'callPricing', 'callPrice', 'callComparePrice', 'meetingLink'],
  descriptions: ['callDescription', 'callAbout'],
  service: ['serviceId', 'serviceMode'],
};

// ------------------------------------------------------------
// Editing one offering, opened from its card on the offerings home,
// or making a new one ("Add a new offering", after picking its kind).
// Four sections, each closed to a one-line summary until opened:
//   Basics                name, length, format, price
//   Descriptions          short and long
//   When people can book  their hours (shared by all calls), with a link
//                         to the Availability screen to change them
//   Service               the checkout page people book and pay through,
//                         picked from their services (the same picker as
//                         the funnel builder and storefront setup)
// Changes stay on this screen until Save (see EditFrame.jsx). The call's
// price and the service's price are kept separately, as set.
//
// A new call opens with Basics open (the one thing to fill in), its
// descriptions written from its name, and a service made for it unless
// they pick one of theirs. "Add to your page" puts it live.
//
// serviceId: the offering to edit, or null for a new one
// kind: a new one's kind (only 'call' can be made so far)
// onSave(changes): merges an edited offering's changed answers into the saved ones
// onCreate(call): adds a new call (its answers, with its id and service)
// ------------------------------------------------------------
export default function EditService({ answers, serviceId, kind, onBack, onSave, onCreate }) {
  if (!serviceId) {
    if (kind === 'call') {
      return <EditCall handle={answers.handle} meetingLink={answers.meetingLink} onBack={onBack} onCreate={onCreate} />;
    }
    return <EditPlaceholder title="Add a new offering" sub="Adding this kind of offering is on its way." onBack={onBack} />;
  }

  const call = callAnswersOf(answers, serviceId);
  if (!call) {
    return <EditPlaceholder title="This offering isn’t here" sub="It may have been removed. Go back to see what’s on your page." onBack={onBack} />;
  }
  return (
    <EditCall
      id={serviceId}
      call={call}
      handle={answers.handle}
      meetingLink={answers.meetingLink}
      onBack={onBack}
      onSave={onSave}
    />
  );
}

// id/call: the call being edited and its answers. No call: a new one.
// meetingLink: the link all their video calls share (from the setup answers)
function EditCall({ id = null, call = null, handle, meetingLink, onBack, onSave, onCreate }) {
  const isNew = call === null;

  // What's saved, with the starting choices filled in, so the form opens unchanged.
  // The short description is fixed to what's on the page now: during setup it
  // follows the name, but renaming a live call shouldn't rewrite its description.
  // A new call starts empty, with its descriptions following its name.
  const saved = useMemo(
    () =>
      isNew
        ? { ...CALL_DEFAULTS, handle, meetingLink, serviceMode: 'auto', serviceId: null }
        : { ...CALL_DEFAULTS, ...call, handle, meetingLink, callDescription: callDescriptionOf(call) },
    [isNew, call, handle, meetingLink],
  );
  const edit = useEditDraft(saved, isNew ? NEW_FIELDS : FIELDS);
  const { handleChange } = edit;
  // A new call's long description starts from its own details, and follows them until edited
  const draft = isNew ? { ...edit.draft, aboutStart: newCallAbout(edit.draft) } : edit.draft;
  const formKey = edit.formKey;
  const schedule = useSchedule();
  const [createFailed, setCreateFailed] = useState(false);

  // Every section starts closed (a new call's Basics opens itself, below);
  // any number can be open at once
  const [open, setOpen] = useState({});
  const toggle = (section) => setOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  // Unsaved changes in a section. Not shown on a new call: everything is new.
  const edited = (section) => !isNew && SECTION_FIELDS[section].some((f) => draft[f] !== saved[f]);

  // What's stopping a save, if anything, and which section it's in
  const verb = isNew ? 'add it' : 'save';
  const detailsProblem = callDetailsProblem(draft);
  const blocker = detailsProblem === 'basics'
    ? { section: 'basics', text: `Add a name and a price (or make it free) to ${verb}` }
    : callAboutOf(draft).trim() === ''
      ? { section: 'descriptions', text: `Add a long description to ${verb}` }
      : isNew && draft.serviceMode === 'pick' && !getService(draft.serviceId)
        ? { section: 'service', text: 'Pick one of your services, or let us create one' }
        : null;
  const problem = blocker?.text ?? null;

  // A new problem opens its section, so what needs fixing is in view.
  // They can still close it; it opens again only if the problem changes.
  const blockedSection = blocker?.section ?? null;
  useEffect(() => {
    if (blockedSection) setOpen((prev) => ({ ...prev, [blockedSection]: true }));
  }, [blockedSection]);

  const save = () => {
    if (!edit.dirty || problem) return;
    const changes = edit.changes();
    // Still following the name? Keep the text that's showing, so a rename doesn't change it
    if (call.callDescription === undefined && !('callDescription' in changes)) {
      changes.callDescription = saved.callDescription;
    }
    onSave(changes);
    edit.saved();
  };

  // A new call: make its service if they left that to us, then put it on the page.
  // Its descriptions are fixed to what's showing, so they no longer follow the name.
  const create = () => {
    if (problem) return;
    let serviceId = draft.serviceId;
    if (draft.serviceMode === 'auto') {
      const free = draft.callPricing === 'free';
      const made = createMockService({
        title: draft.callTitle.trim(),
        price: free ? 0 : Number(draft.callPrice) || 0,
      });
      if (!made) {
        setCreateFailed(true);
        return;
      }
      serviceId = made.id;
    }
    onCreate({
      id: newCallId(),
      createdAt: new Date().toISOString(),
      ...Object.fromEntries(FIELDS.map((f) => [f, draft[f]])),
      callTitle: draft.callTitle.trim(),
      callDescription: callDescriptionOf(draft),
      callAbout: callAboutOf(draft),
      serviceId,
    });
  };

  const hours = hoursAtAGlance(schedule, Number(draft.callDuration));
  const shortDescription = callDescriptionOf(draft).trim();
  const aboutWrittenForThem = isNew && draft.callAbout === undefined;

  // The service picked from theirs (or none yet)
  const chooseService = (mode) => {
    setCreateFailed(false);
    handleChange(mode, 'serviceMode');
    // Back to "create one for me": forget the pick, so there's no doubt which applies
    if (mode === 'auto') handleChange(null, 'serviceId');
  };

  const bookingHref = isNew ? null : `?mock=book&service=${encodeURIComponent(id)}`;

  return (
    <EditFrame
      edit={edit}
      title={isNew ? 'New 1:1 call' : saved.callTitle || 'Your call'}
      sub={
        isNew
          ? draft.serviceMode === 'auto'
            ? 'Fill in the basics. We’ll create the service for you.'
            : 'Fill in the basics, then add it to your page.'
          : 'Changes show up on your page once you save them.'
      }
      onBack={onBack}
      onSave={isNew ? create : save}
      problem={problem}
      message={createFailed ? 'We couldn’t create the service just now. Try again, or pick one of yours.' : null}
      viewHref={pageUrl(saved.handle)}
      createLabel={isNew ? 'Add to your page' : null}
    >
      <EditSection
        id="es-basics"
        title="Basics"
        sub="The name, length and price people see before they book."
        summary={blocker?.section === 'basics' ? blocker.text : basicsSummary(draft)}
        warn={blocker?.section === 'basics'}
        edited={edited('basics')}
        open={Boolean(open.basics)}
        onToggle={() => toggle('basics')}
      >
        <CallDetailsInput
          key={formKey}
          answers={draft}
          onChange={handleChange}
          showDescription={false}
          grouped={false}
        />
      </EditSection>

      <EditSection
        id="es-descriptions"
        title="Descriptions"
        sub="What people read about your call before they book."
        summary={
          blocker?.section === 'descriptions'
            ? blocker.text
            : aboutWrittenForThem
              ? 'Written for you from the name. Open to make it yours.'
              : shortDescription || 'No short description'
        }
        warn={blocker?.section === 'descriptions'}
        edited={edited('descriptions')}
        open={Boolean(open.descriptions)}
        onToggle={() => toggle('descriptions')}
        className="es__fields"
      >
        <ShortDescriptionField
          key={`short-${formKey}`}
          answers={draft}
          onChange={handleChange}
          note={
            isNew ? (
              'Shows on your call’s card on your page.'
            ) : (
              <WhereItShows
                text="Shows on your call’s card at"
                href={pageUrl(saved.handle)}
                label={`${PAGE_DOMAIN}/${saved.handle}`}
              />
            )
          }
        />
        <CallAboutInput
          key={`about-${formKey}`}
          answers={draft}
          onChange={handleChange}
          label="Long description"
          showNote={isNew}
          note={
            isNew ? 'Shows on its booking page.' : <WhereItShows text="Shows on" href={bookingHref} label="its booking page" />
          }
        />
      </EditSection>

      <EditSection
        id="es-when"
        title="When people can book"
        sub="Your hours. They’re the same for all your 1:1 calls."
        summary={hours.warning ? hours.short : hours.text}
        warn={Boolean(hours.warning)}
        open={Boolean(open.when)}
        onToggle={() => toggle('when')}
      >
        <HoursSummary schedule={schedule} warning={hours.warning} />
      </EditSection>

      <EditSection
        id="es-service"
        title="Service"
        sub="The checkout page people fill in, and pay on, when they book this call."
        summary={
          blocker?.section === 'service'
            ? blocker.text
            : isNew && draft.serviceMode === 'auto'
              ? 'We’ll create one for you from the name and price'
              : serviceSummary(draft.serviceId)
        }
        warn={blocker?.section === 'service'}
        edited={edited('service')}
        open={Boolean(open.service)}
        onToggle={() => toggle('service')}
        className="es-service"
      >
        {isNew ? (
          <ServiceChoice
            mode={draft.serviceMode}
            onMode={chooseService}
            picker={
              <ServicePickInput
                key={`service-${formKey}`}
                value={draft.serviceId ?? null}
                onChange={(serviceId) => handleChange(serviceId, 'serviceId')}
              />
            }
          />
        ) : (
          <ServicePickInput
            key={`service-${formKey}`}
            value={draft.serviceId ?? null}
            onChange={(serviceId) => handleChange(serviceId, 'serviceId')}
          />
        )}
      </EditSection>
    </EditFrame>
  );
}

// A new call's service: made for them (the default, as in setup), or one of
// theirs. The picker shows only while "Use one of my services" is chosen.
function ServiceChoice({ mode, onMode, picker }) {
  const options = [
    {
      id: 'auto',
      name: 'Create a service for me',
      text: 'We’ll make it from this call’s name and price when you add it to your page.',
      tag: 'Recommended',
    },
    {
      id: 'pick',
      name: 'Use one of my services',
      text: 'Pick a checkout page you’ve already made.',
    },
  ];

  return (
    <div className="es-choice">
      <div className="es-choice__options" role="radiogroup" aria-label="Service">
        {options.map((o) => {
          const picked = mode === o.id;
          return (
            <label key={o.id} className={`es-choice__option ${picked ? 'es-choice__option--picked' : ''}`}>
              <input
                type="radio"
                name="service-mode"
                className="es-choice__radio"
                value={o.id}
                checked={picked}
                onChange={() => onMode(o.id)}
              />
              <span className="es-choice__mark" aria-hidden="true" />
              <span className="es-choice__text">
                <span className="es-choice__name">
                  {o.name}
                  {o.tag && <span className="es-choice__tag">{o.tag}</span>}
                </span>
                <span className="es-choice__blurb">{o.text}</span>
              </span>
            </label>
          );
        })}
      </div>
      {mode === 'pick' && <div className="es-choice__picker">{picker}</div>}
    </div>
  );
}

// ---------- One-line summaries, shown while a section is closed ----------

// "Career clarity call · 60 min · Video call · ₹1,500"
function basicsSummary(draft) {
  const name = String(draft.callTitle ?? '').trim() || 'No name yet';
  // "Video call on Zoom" once there's a link we can name
  const provider = readMeetingLink(draft.meetingLink).provider;
  const format = draft.callFormat === 'phone' ? 'Phone call' : provider ? `Video call on ${provider}` : 'Video call';
  const price =
    draft.callPricing === 'free'
      ? 'Free'
      : Number(draft.callPrice) > 0
        ? `₹${Number(draft.callPrice).toLocaleString('en-IN')}`
        : 'No price yet';
  return [name, durationLabel(draft.callDuration), format, price].join(' · ');
}

// "Career Clarity Call – Checkout · ₹1,500". Read fresh each render, so a
// service made in another tab and picked here shows straight away.
function serviceSummary(serviceId) {
  const service = getService(serviceId);
  if (!service) return 'No service picked yet';
  return `${service.title} · ${servicePrice(service)}`;
}

// Their hours, short: "Mon–Fri, 10 am – 6 pm", or the first group and
// "+ 2 more" when days have different hours. Also says when nobody can book.
// durationMins: this call's length, to warn when no block is long enough.
function hoursAtAGlance(schedule, durationMins) {
  const { open } = weekSummary(schedule.weekly);
  const longest = longestBlock(schedule.weekly);

  if (open.length === 0) {
    return {
      warning: 'You haven’t set any hours, so people can’t book this call.',
      short: 'No hours set, so people can’t book',
    };
  }

  const first = `${open[0].days}, ${open[0].hours}`;
  const text = open.length > 1 ? `${first} + ${open.length - 1} more` : first;

  if (durationMins > longest) {
    return {
      text,
      warning: `None of your hours are long enough for a ${durationLabel(durationMins)} call, so people won’t see any times. Add a longer block, or make the call shorter.`,
      short: `No hours long enough for a ${durationLabel(durationMins)} call`,
    };
  }
  return { text, warning: null };
}

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

// The Availability screen: for now, the stand-in opened in a new tab
// (like the service's Preview and Edit links)
const AVAILABILITY_HREF = '?mock=availability';

// Their weekly hours, read from where the Availability screen saves them.
// Read again whenever they come back to this tab, so it's up to date
// after changing hours there.
function useSchedule() {
  const [schedule, setSchedule] = useState(loadSchedule);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden') setSchedule(loadSchedule());
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return schedule;
}

// Their weekly hours, day by day.
// warning: why nobody can book this call, if so (from hoursAtAGlance).
function HoursSummary({ schedule, warning }) {
  const { open, closed } = weekSummary(schedule.weekly);
  const zone = timeZones.find((z) => z.id === schedule.timeZone)?.name ?? schedule.timeZone;

  return (
    <div className="es-hours">
      {open.length > 0 && (
        <dl className="es-hours__list">
          {open.map(({ days, hours }) => (
            <div key={days} className="es-hours__row">
              <dt>{days}</dt>
              <dd>{hours}</dd>
            </div>
          ))}
          {closed && (
            <div className="es-hours__row es-hours__row--off">
              <dt>{closed}</dt>
              <dd>Not available</dd>
            </div>
          )}
        </dl>
      )}

      {warning && (
        <p className="es-hours__warning" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{warning}</span>
        </p>
      )}

      <p className="es-hours__foot">
        <span>Times are in {zone} time.</span>
        <a href={AVAILABILITY_HREF} target="_blank" rel="noopener">
          Change your hours
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}