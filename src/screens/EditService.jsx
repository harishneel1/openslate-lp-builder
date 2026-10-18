import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import EditFrame, { EditPlaceholder, EditSection, useEditDraft } from './EditFrame';
import CallDetailsInput, { ShortDescriptionField } from '../components/CallDetailsInput';
import CallAboutInput from '../components/CallAboutInput';
import ServicePickInput from '../components/ServicePickInput';
import { MY_CALL_ID } from '../data/myProfile';
import { getService, servicePrice } from '../data/mockServices';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { CALL_DEFAULTS, callAboutOf, callDescriptionOf, callDetailsComplete } from '../data/callDetails';
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
];

// Which answers belong to which section, for its "Edited" tag
const SECTION_FIELDS = {
  basics: ['callTitle', 'callDuration', 'callFormat', 'callPricing', 'callPrice', 'callComparePrice'],
  descriptions: ['callDescription', 'callAbout'],
  service: ['serviceId'],
};

// ------------------------------------------------------------
// Editing one offering, opened from its card on the offerings home.
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
// serviceId null: "Add a new offering" (a placeholder for now).
// onSave(changes): merges the changed answers into the saved ones.
// ------------------------------------------------------------
export default function EditService({ answers, serviceId, onBack, onSave }) {
  if (!serviceId) {
    return <EditPlaceholder title="Add a new offering" sub="Adding offerings from here is on its way." onBack={onBack} />;
  }
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
  const edit = useEditDraft(saved, FIELDS);
  const { draft, formKey, handleChange } = edit;
  const schedule = useSchedule();

  // Every section starts closed; any number can be open at once
  const [open, setOpen] = useState({});
  const toggle = (id) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const edited = (id) => SECTION_FIELDS[id].some((f) => draft[f] !== saved[f]);

  // What's stopping a save, if anything, and which section it's in
  const blocker = !callDetailsComplete(draft)
    ? { section: 'basics', text: 'Add a name and a price (or make it free) to save' }
    : callAboutOf(draft).trim() === ''
      ? { section: 'descriptions', text: 'Add a long description to save' }
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
    if (answers.callDescription === undefined && !('callDescription' in changes)) {
      changes.callDescription = saved.callDescription;
    }
    onSave(changes);
    edit.saved();
  };

  const hours = hoursAtAGlance(schedule, Number(draft.callDuration));
  const shortDescription = String(draft.callDescription ?? '').trim();

  return (
    <EditFrame
      edit={edit}
      title={saved.callTitle || 'Your call'}
      sub="Changes show up on your page once you save them."
      onBack={onBack}
      onSave={save}
      problem={problem}
      viewHref={pageUrl(saved.handle)}
    >
      <EditSection
        id="es-basics"
        title="Basics"
        sub="The name, length, format and price people see before they book."
        summary={blocker?.section === 'basics' ? blocker.text : basicsSummary(draft)}
        warn={blocker?.section === 'basics'}
        edited={edited('basics')}
        open={Boolean(open.basics)}
        onToggle={() => toggle('basics')}
      >
        <CallDetailsInput key={formKey} answers={draft} onChange={handleChange} showDescription={false} />
      </EditSection>

      <EditSection
        id="es-descriptions"
        title="Descriptions"
        sub="What people read about your call before they book."
        summary={
          blocker?.section === 'descriptions'
            ? blocker.text
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
            <WhereItShows
              text="Shows on your call’s card at"
              href={pageUrl(saved.handle)}
              label={`${PAGE_DOMAIN}/${saved.handle}`}
            />
          }
        />
        <CallAboutInput
          key={`about-${formKey}`}
          answers={draft}
          onChange={handleChange}
          label="Long description"
          showNote={false}
          note={<WhereItShows text="Shows on" href={BOOKING_HREF} label="your booking page" />}
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
        summary={serviceSummary(draft.serviceId)}
        edited={edited('service')}
        open={Boolean(open.service)}
        onToggle={() => toggle('service')}
        className="es-service"
      >
        <ServicePickInput
          key={`service-${formKey}`}
          value={draft.serviceId ?? null}
          onChange={(id) => handleChange(id, 'serviceId')}
        />
      </EditSection>
    </EditFrame>
  );
}

// ---------- One-line summaries, shown while a section is closed ----------

// "Career clarity call · 60 min · Video call · ₹1,500"
function basicsSummary(draft) {
  const name = String(draft.callTitle ?? '').trim() || 'No name yet';
  const format = draft.callFormat === 'phone' ? 'Phone call' : 'Video call';
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