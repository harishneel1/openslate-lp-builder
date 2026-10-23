import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ClipboardList, Clock, ExternalLink, FileText, Lock, SlidersHorizontal } from 'lucide-react';
import EditFrame, { EditPlaceholder, EditSection, useEditDraft } from './EditFrame';
import CallDetailsInput, { ShortDescriptionField } from '../components/CallDetailsInput';
import CallAboutInput from '../components/CallAboutInput';
import ServicePickInput from '../components/ServicePickInput';
import QuestionsInput from '../components/QuestionsInput';
import { DEFAULT_QUESTIONS, cleanQuestions, questionsOf, questionsProblem, questionsSummary, sameQuestions } from '../data/callQuestions';
import { callAnswersOf, newCallId } from '../data/myProfile';
import { createMockService, getService, servicePrice } from '../data/mockServices';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { CALL_DEFAULTS, callAboutOf, callDescriptionOf, callDetailsProblem, newCallAbout, readMeetingLink } from '../data/callDetails';
import { DEFAULT_HOURS, loadCallHours, saveCallHours, sameHours } from '../data/availabilityStore';
import { BOOKING_RULES } from '../data/bookingRules';
import HoursDrawer from '../components/HoursDrawer';
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
  'callQuestions', // what checkout asks after name, email and phone (callQuestions.js)
  'meetingLink', // shared by all their video calls: saved on the setup answers (see myProfile.js)
];

// The call's hours ({ timeZone, weekly, ...booking rules }). Edited here like
// the answers above, but saved apart from them, as the call's own hours
// (availabilityStore.js), where the booking page reads them.
const EDIT_FIELDS = [...FIELDS, 'callHours'];

// A new call's fields. Its contract isn't one of them: one is always created
// for it from its name and price when it's added (see ContractCard).
const NEW_FIELDS = EDIT_FIELDS;

// Which answers belong to which section, for its "Edited" tag
const SECTION_FIELDS = {
  basics: [
    'callTitle', 'callAbout', 'callDescription', 'callDuration', 'callFormat',
    'callPricing', 'callPrice', 'callComparePrice', 'meetingLink',
  ],
  questions: ['callQuestions'],
  service: ['serviceId'],
  when: ['callHours'],
};

const strip = ({ saved, ...rest }) => rest; // eslint-disable-line no-unused-vars

// ------------------------------------------------------------
// Editing one offering, opened from its card on the offerings home,
// or making a new one ("Add a new offering", after picking its kind).
// Four sections, each closed to a one-line summary until opened, one open at a time:
//   Basics                name, then its description (what the booking page
//                         shows under the name), length, format, price.
//                         Opened from the offerings page, also the line on
//                         the call's card there (callDescription): that card
//                         is the only place it shows, so from the 1:1 calls
//                         tab it isn't asked for.
//   When people can book  this call's own hours, changed in a panel from
//                         the right (HoursDrawer.jsx)
//   Booking questions     what checkout asks: name, email and phone, then
//                         this call's questions (QuestionsInput.jsx, callQuestions.js)
//   Contract              the checkout page people book and pay through.
//                         Shown, never swapped (ContractCard): a new call's
//                         is created for it from its name and price when
//                         it's added; an existing call keeps its own, with
//                         View contract to edit its title and details. Only
//                         an existing call whose contract can't be found
//                         gets the picker, to link one.
// Changes stay on this screen until Save (see EditFrame.jsx), hours too.
// The call's price and the contract's price are kept separately, as set.
//
// A new call opens with Basics open (the one thing to fill in), its
// descriptions written from its name, a contract made for it (always),
// and the default hours (weekdays 9–5).
// "Add to your page" puts it live.
//
// serviceId: the offering to edit, or null for a new one
// kind: a new one's kind (only 'call' can be made so far)
// onSave(changes): merges an edited offering's changed answers into the saved ones
// onCreate(call): adds a new call (its answers, with its id and service)
// from: where it was opened. 'offerings' (My offerings: a new call goes on
//   the page) or 'calls' (the 1:1 calls tab: a new call is just created,
//   and they choose there whether it's on the page). Changes the wording only.
// ------------------------------------------------------------
const FROM = {
  offerings: {
    cardLine: true,
    back: 'Your offerings page',
    create: 'Add to your page',
    saved: 'Changes show up on your page once you save them.',
    gone: 'It may have been removed. Go back to see what’s on your page.',
  },
  calls: {
    cardLine: false, // the card line is the offerings page's: not asked for here
    back: '1:1 calls',
    create: 'Create call',
    saved: 'Changes show up wherever people book this call once you save them.',
    gone: 'It may have been removed. Go back to see your calls.',
  },
};

export default function EditService({ answers, serviceId, kind, onBack, onSave, onCreate, from = 'offerings' }) {
  const words = FROM[from] ?? FROM.offerings;
  if (!serviceId) {
    if (kind === 'call') {
      return (
        <EditCall handle={answers.handle} meetingLink={answers.meetingLink} words={words} onBack={onBack} onCreate={onCreate} />
      );
    }
    return (
      <EditPlaceholder
        title="Add a new offering"
        sub="Adding this kind of offering is on its way."
        backLabel={words.back}
        onBack={onBack}
      />
    );
  }

  const call = callAnswersOf(answers, serviceId);
  if (!call) {
    return <EditPlaceholder title="This offering isn’t here" sub={words.gone} backLabel={words.back} onBack={onBack} />;
  }
  return (
    <EditCall
      id={serviceId}
      call={call}
      handle={answers.handle}
      meetingLink={answers.meetingLink}
      words={words}
      onBack={onBack}
      onSave={onSave}
    />
  );
}

// id/call: the call being edited and its answers. No call: a new one.
// meetingLink: the link all their video calls share (from the setup answers)
// words: the back link, Create button and subtitle for where it was opened (FROM)
function EditCall({ id = null, call = null, handle, meetingLink, words = FROM.offerings, onBack, onSave, onCreate }) {
  const isNew = call === null;

  // What's saved, with the starting choices filled in, so the form opens unchanged.
  // The short description is fixed to what's on the page now: during setup it
  // follows the name, but renaming a live call shouldn't rewrite its description.
  // A new call starts empty, with its descriptions following its name.
  // Hours are read from where they're saved; hoursVersion reads them again after a save.
  const [hoursVersion, setHoursVersion] = useState(0);
  const saved = useMemo(
    () =>
      isNew
        ? {
            ...CALL_DEFAULTS,
            handle,
            meetingLink,
            serviceId: null,
            callQuestions: structuredClone(DEFAULT_QUESTIONS),
            callHours: structuredClone(DEFAULT_HOURS),
          }
        : {
            ...CALL_DEFAULTS,
            ...call,
            handle,
            meetingLink,
            callDescription: callDescriptionOf(call),
            callQuestions: questionsOf(call),
            callHours: strip(loadCallHours(id)),
          },
    [isNew, id, call, handle, meetingLink, hoursVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const edit = useEditDraft(saved, isNew ? NEW_FIELDS : EDIT_FIELDS);
  const { handleChange } = edit;
  // A new call's long description starts from its own details, and follows them until edited
  const draft = isNew ? { ...edit.draft, aboutStart: newCallAbout(edit.draft) } : edit.draft;
  const formKey = edit.formKey;
  const [createFailed, setCreateFailed] = useState(false);
  const [hoursFailed, setHoursFailed] = useState(false); // the hours didn't save
  const [hoursOpen, setHoursOpen] = useState(false); // the hours panel

  // One section open at a time: opening one closes the other. Every section
  // starts closed (a new call's Basics opens itself, below). Closing a section
  // keeps its changes; it shows "Edited" until they're saved or discarded.
  const [openSection, setOpenSection] = useState(null);
  const toggle = (section) => setOpenSection((cur) => (cur === section ? null : section));
  const open = openSection ? { [openSection]: true } : {};
  // Unsaved changes in a section. Not shown on a new call: everything is new.
  const edited = (section) => !isNew && SECTION_FIELDS[section].some((f) => draft[f] !== saved[f]);

  // What's stopping a save, if anything, and which section it's in
  const verb = isNew ? 'add it' : 'save';
  const detailsProblem = callDetailsProblem(draft);
  const questionProblem = questionsProblem(draft.callQuestions);
  const blocker = detailsProblem === 'basics'
    ? { section: 'basics', text: `Add a name and a price (or make it free) to ${verb}` }
    : callAboutOf(draft).trim() === ''
      ? { section: 'basics', text: `Add a description to ${verb}` }
      : questionProblem
        ? { section: 'questions', text: questionProblem.text }
        : null;
  const problem = blocker?.text ?? null;

  // A new problem opens its section, so what needs fixing is in view.
  // They can still close it; it opens again only if the problem changes.
  const blockedSection = blocker?.section ?? null;
  useEffect(() => {
    if (blockedSection) setOpenSection(blockedSection);
  }, [blockedSection]);

  const save = () => {
    if (!edit.dirty || problem) return;
    const { callHours, ...changes } = edit.changes();
    // Hours first: if they don't save, nothing does, so the draft stays as it was
    setHoursFailed(false);
    if (callHours && !saveCallHours(id, callHours)) {
      setHoursFailed(true);
      return;
    }
    // Still following the name? Keep the text that's showing, so a rename doesn't change it
    if (call.callDescription === undefined && !('callDescription' in changes)) {
      changes.callDescription = saved.callDescription;
    }
    if (changes.callQuestions) changes.callQuestions = cleanQuestions(changes.callQuestions);
    if (Object.keys(changes).length > 0) onSave(changes);
    if (callHours) setHoursVersion((v) => v + 1);
    edit.saved();
  };

  // A new call: make its service if they left that to us, then put it on the page.
  // Its descriptions are fixed to what's showing, so they no longer follow the name.
  const create = () => {
    if (problem) return;
    // Its hours are saved under its id before anything else is made.
    // (A failed try leaves them under an id nobody uses; the next try gets a new one.)
    const callId = newCallId();
    setHoursFailed(false);
    if (!saveCallHours(callId, draft.callHours)) {
      setHoursFailed(true);
      return;
    }
    // Its contract: always created for it, from its name and price
    const free = draft.callPricing === 'free';
    const made = createMockService({
      title: draft.callTitle.trim(),
      price: free ? 0 : Number(draft.callPrice) || 0,
    });
    if (!made) {
      setCreateFailed(true);
      return;
    }
    const serviceId = made.id;
    onCreate({
      id: callId,
      createdAt: new Date().toISOString(),
      ...Object.fromEntries(FIELDS.map((f) => [f, draft[f]])),
      callTitle: draft.callTitle.trim(),
      callDescription: callDescriptionOf(draft),
      callAbout: callAboutOf(draft),
      callQuestions: cleanQuestions(draft.callQuestions),
      serviceId,
    });
  };

  const hours = hoursAtAGlance(draft.callHours, Number(draft.callDuration));

  // Hours from the panel go into the draft. Back to what's saved: the saved
  // hours themselves, so the section isn't marked as edited.
  const applyHours = (next) => {
    handleChange(sameHours(next, saved.callHours) ? saved.callHours : next, 'callHours');
    setHoursFailed(false);
    setHoursOpen(false);
  };
  // Questions edited back to what's saved: the saved list itself, so the section isn't marked as edited
  const changeQuestions = (next) => handleChange(sameQuestions(next, saved.callQuestions) ? saved.callQuestions : next, 'callQuestions');

  const bookingHref = isNew ? null : `?mock=book&service=${encodeURIComponent(id)}`;
  const linkedContract = isNew ? null : getService(saved.serviceId);
  const checkoutHref = isNew ? null : `?mock=checkout&service=${encodeURIComponent(id)}&preview=1`;

  return (
    <EditFrame
      edit={edit}
      title={isNew ? 'New 1:1 call' : saved.callTitle || 'Your call'}
      sub={
        isNew ? 'Fill in the basics. We’ll create the contract for you.' : words.saved
      }
      backLabel={words.back}
      onBack={onBack}
      onSave={isNew ? create : save}
      problem={problem}
      message={
        hoursFailed
          ? 'We couldn’t save your hours just now. Try again.'
          : createFailed
            ? 'We couldn’t create the contract just now. Try again.'
            : null
      }
      viewHref={saved.handle ? pageUrl(saved.handle) : null}
      createLabel={isNew ? words.create : null}
    >
      <EditSection
        id="es-basics"
        icon={SlidersHorizontal}
        title="Basics"
        sub="The name, description, length and price people see before they book."
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
          // Under the name, as on the booking page
          afterName={
            <>
              <CallAboutInput
                key={`about-${formKey}`}
                answers={draft}
                onChange={handleChange}
                label="Description"
                showNote={isNew}
                note={
                  isNew ? 'Shows on its booking page.' : <WhereItShows text="Shows on" href={bookingHref} label="its booking page" />
                }
              />
              {words.cardLine && (
                <ShortDescriptionField
                  key={`short-${formKey}`}
                  answers={draft}
                  onChange={handleChange}
                  label="Line on your page’s card"
                  note={
                    isNew || !saved.handle ? (
                      'Shows under its name on your offerings page.'
                    ) : (
                      <WhereItShows
                        text="Shows under its name at"
                        href={pageUrl(saved.handle)}
                        label={`${PAGE_DOMAIN}/${saved.handle}`}
                      />
                    )
                  }
                />
              )}
            </>
          }
        />
      </EditSection>

      <EditSection
        id="es-when"
        icon={CalendarClock}
        title="Availability & booking rules"
        sub="Your weekly hours and booking rules for this call."
        summary={hours.warning ? hours.short : hours.text}
        warn={Boolean(hours.warning)}
        edited={edited('when')}
        open={Boolean(open.when)}
        onToggle={() => toggle('when')}
      >
        <HoursSummary schedule={draft.callHours} warning={hours.warning} onEdit={() => setHoursOpen(true)} />
      </EditSection>

      <EditSection
        id="es-questions"
        icon={ClipboardList}
        title="Booking questions"
        sub="What people fill in on checkout when they book this call."
        summary={blocker?.section === 'questions' ? blocker.text : questionsSummary(draft.callQuestions)}
        warn={blocker?.section === 'questions'}
        edited={edited('questions')}
        open={Boolean(open.questions)}
        onToggle={() => toggle('questions')}
      >
        <QuestionsInput
          key={`questions-${formKey}`}
          value={draft.callQuestions}
          onChange={changeQuestions}
          note={
            isNew ? (
              'Shows on checkout when people book this call.'
            ) : (
              <WhereItShows text="Shows on" href={checkoutHref} label="checkout" />
            )
          }
        />
      </EditSection>

      <EditSection
        id="es-service"
        icon={FileText}
        title="Contract"
        sub="The checkout page people fill in, and pay on, when they book this call."
        summary={isNew ? `${String(draft.callTitle ?? '').trim() || '1:1 call'} · ${priceLabel(draft)}` : serviceSummary(draft.serviceId)}
        edited={edited('service')}
        open={Boolean(open.service)}
        onToggle={() => toggle('service')}
        className="es-service"
      >
        {/* Shown, not swapped: a new call's is created for it; an existing call keeps its own.
            The picker shows only for an existing call with no contract it can find. */}
        {isNew || linkedContract ? (
          <ContractCard contract={isNew ? null : linkedContract} draft={draft} liveHref={checkoutHref} />
        ) : (
          <ServicePickInput
            key={`service-${formKey}`}
            value={draft.serviceId ?? null}
            onChange={(serviceId) => handleChange(serviceId, 'serviceId')}
          />
        )}
      </EditSection>

      {hoursOpen && (
        <HoursDrawer
          value={draft.callHours}
          callName={String(draft.callTitle ?? '').trim()}
          callLength={durationLabel(Number(draft.callDuration))}
          onApply={applyHours}
          onClose={() => setHoursOpen(false)}
        />
      )}
    </EditFrame>
  );
}

const PAYMENT_TYPES = { onetime: 'One-time payment', subscription: 'Monthly subscription', free: 'Free' };

// The call's contract: the checkout people book and pay through. Shown,
// never swapped here: a new call's is created for it when it's added; an
// existing call keeps the one it's linked to. Its title and details are
// edited in Sidebar → Contracts. View contract opens it live, as people see
// it: this call's checkout page, in preview (liveHref), not the editor.
//
//   contract: the linked contract (an existing call), or null (a new call:
//             shows the one that will be created, from Basics as they type)
function ContractCard({ contract, draft, liveHref = null }) {
  const free = contract ? contract.type === 'free' || contract.price === 0 : draft.callPricing === 'free';
  const name = contract ? contract.title : String(draft.callTitle ?? '').trim() || '1:1 call';
  const price = contract ? servicePrice(contract) : priceLabel(draft);
  const type = contract ? PAYMENT_TYPES[contract.type] ?? 'One-time payment' : free ? 'Free' : 'One-time payment';

  return (
    <div className="es-contract">
      <div className="es-contract__card">
        <span className="es-contract__icon" aria-hidden="true">
          <FileText size={18} />
        </span>
        <div className="es-contract__text">
          <p className="es-contract__name">
            {name}
            <span className="es-contract__tag">Default</span>
          </p>
          <p className="es-contract__meta">
            <span className={free ? 'es-contract__price es-contract__price--free' : 'es-contract__price'}>{price}</span>
            {!free && <span>{type}</span>}
          </p>
        </div>
        {contract && liveHref ? (
          <a className="es-contract__view" href={liveHref} target="_blank" rel="noopener">
            View contract
            <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          // Not there yet: looks off and does nothing, with a tooltip saying why.
          // aria-disabled (not disabled) so it can still be hovered and focused.
          <button
            type="button"
            className="es-contract__view"
            aria-disabled="true"
            aria-describedby="es-contract-later"
            data-tip="Available once you add this offering"
            data-tip-align="end"
            onClick={(e) => e.preventDefault()}
          >
            View contract
          </button>
        )}
      </div>
      <p className="es-contract__note">
        <Lock size={14} aria-hidden="true" />
        <span>
          {contract
            ? 'This contract is linked to this 1:1 call and can’t be changed. You can edit its title and details from Sidebar -> contract.'
            : 'This contract will be linked to this 1:1 call and can’t be changed.'}
          {!contract && (
            <span id="es-contract-later" className="es-contract__later">
              {' '}You can view and edit it once you create this offering.
            </span>
          )}
        </span>
      </p>
    </div>
  );
}

// ---------- One-line summaries, shown while a section is closed ----------

// 'Free', '₹1,500', or 'No price yet'
function priceLabel(draft) {
  if (draft.callPricing === 'free') return 'Free';
  return Number(draft.callPrice) > 0 ? `₹${Number(draft.callPrice).toLocaleString('en-IN')}` : 'No price yet';
}

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

// This call's weekly hours, day by day, and the button that opens the panel to change them.
// warning: why nobody can book this call, if so (from hoursAtAGlance).
function HoursSummary({ schedule, warning, onEdit }) {
  const { open, closed } = weekSummary(schedule.weekly);
  const zone = timeZones.find((z) => z.id === schedule.timeZone)?.name ?? schedule.timeZone;

  return (
    <div className="es-hours">
      <h3 className="es-hours__subtitle">Weekly hours</h3>
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

      {/* Booking rules: shown here too, so it's clear they live in this section */}
      <div className="es-hours__rules">
        <h3 className="es-hours__subtitle">Booking rules</h3>
        <dl className="es-hours__list">
          {BOOKING_RULES.map(({ key, label, options }) => (
            <div key={key} className="es-hours__row">
              <dt>{label}</dt>
              <dd>{ruleLabel(options, schedule[key])}</dd>
            </div>
          ))}
        </dl>
      </div>

      {warning && (
        <p className="es-hours__warning" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{warning}</span>
        </p>
      )}

      <div className="es-hours__foot">
        <span>Times are in {zone} time.</span>
        <button type="button" className="es-hours__edit" onClick={onEdit}>
          <Clock size={15} aria-hidden="true" />
          Edit hours &amp; rules
        </button>
      </div>
    </div>
  );
}

// A booking rule's value as its label ("15 minutes"), or the raw value
// if it's no longer one of the choices
function ruleLabel(options, value) {
  if (value == null) return '—';
  return options.find(([v]) => v === value)?.[1] ?? String(value);
}