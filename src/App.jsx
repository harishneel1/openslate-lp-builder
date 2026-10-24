import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AppLayout from './components/AppLayout';
import WebinarsPage from './screens/WebinarsPage';
import FunnelOverview from './screens/FunnelOverview';
import WebinarDetails from './screens/WebinarDetails';
import { deleteSignupsOf, peopleOf } from './data/webinarSignups';
import QuestionFlow from './screens/QuestionFlow';
import Checkpoint from './screens/Checkpoint';
import SectionProgress from './components/SectionProgress';
import { funnelTypes } from './data/funnelTypes';
import { aboutQuestions, landingQuestions } from './data/webinarQuestions';
import Transition from './screens/Transition';
import DesignStep from './screens/DesignStep';
import BuildingStep from './screens/BuildingStep';
import LandingEditor from './screens/LandingEditor';
import SignupStep from './screens/SignupStep';
import { deleteService, getService, saveWebinarContract } from './data/mockServices';
import { thankYouQuestions, firstMissing } from './data/thankYouQuestions';
import { contractKey, currentRun, laterRuns, ownContract, seriesIdOf, upcomingSiblings, withSharedChanges, webinarContractFields, webinarStatus, webinarWhen, withSeriesIds } from './data/webinar';
import RunAgainDialog from './components/RunAgainDialog';
import ReminderEditor from './screens/ReminderEditor';
import { withEmail, withOn } from './data/reminders';
import { loadSaved, saveProgress, createFunnel } from './utils/storage';
import { editGroup } from './utils/answerSummary';
import ExamplePreview from './components/ExamplePreview';
import MyPageSetup from './screens/MyPageSetup';
import BookingsPage from './screens/BookingsPage';
import ContractsPage from './screens/ContractsPage';
import CallsPage from './screens/CallsPage';
import './App.css';
import { funnelName } from './utils/funnelName';
import { recommendedThemeId } from './data/themes';
import { makeSlug } from './utils/publish';
import { accountHandle } from './data/myPage';
import { getMockProfile } from './data/mockProfile';
import { EDIT_REQUEST_KEY, editRequestId, takeEditParam } from './utils/editRequest';

// ('design' is only kept so old saves on the removed creation-time picker restore cleanly)
const STEPS = ['details', 'reminder-edit', 'overview', 'review', 'review-edit', 'about', 'checkpoint', 'edit', 'transition', 'landing', 'design', 'building', 'review-design', 'registration', 'thank-you', 'thank-you-building'];

// Stable empty values, so screens that memoise on answers don't recompute for nothing
const NO_ANSWERS = {};
const NO_PAGES = [];
const NO_POSITIONS = {};

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Nothing entered and nothing finished: not worth keeping
const isEmptyFunnel = (f) => Object.keys(f.answers).length === 0 && f.donePages.length === 0;

// One saved funnel → safe values. Returns null if it can't be used.
function restoreFunnel(f) {
  if (!isObject(f) || typeof f.id !== 'string') return null;
  if (!funnelTypes.some((t) => t.id === f.type)) return null;

  let step = STEPS.includes(f.step) ? f.step : 'overview';
  if (step === 'details' && !Number.isFinite(f.publishedAt)) step = 'overview'; // only published ones have a details page
  if (step === 'reminder-edit') step = 'details'; // an email being edited → back to the webinar (unsaved changes are gone)
  if (step === 'edit') step = 'checkpoint'; // editing one answer → back to the checkpoint
  if (step === 'review-edit') step = 'review'; // editing one screen → back to "Edit your landing page"
  if (step === 'review-design') step = 'review'; // changing the style from there → back to it
  // The style picker no longer runs during creation: send them back to the
  // last landing screen, where Finish builds the page with the best-match style
  const fromOldPicker = step === 'design';
  if (fromOldPicker) step = 'landing';

  return {
    id: f.id,
    type: f.type,
    createdAt: Number(f.createdAt) || Date.now(),
    updatedAt: Number(f.updatedAt) || Date.now(),
    step,
    answers: isObject(f.answers) ? f.answers : {},
    themeId: typeof f.themeId === 'string' ? f.themeId : null,
    serviceId: typeof f.serviceId === 'string' ? f.serviceId : null, // registration page
    donePages: Array.isArray(f.donePages) ? f.donePages : [],
    resumeAtEnd: f.resumeAtEnd === true,
    landingAtEnd: fromOldPicker || f.landingAtEnd === true,
    // Screen they're on in each flow: { about: { at, furthest }, landing: { at, furthest } }
    positions: isObject(f.positions) ? f.positions : {},
    // Saves from before publishing existed have neither: not live yet
    publishedAt: Number.isFinite(f.publishedAt) ? f.publishedAt : null,
    slug: typeof f.slug === 'string' && f.slug ? f.slug : null,
    // The series it belongs to: every run of one webinar shares it and its
    // link (data/webinar.js). Older saves get it in restore().
    seriesId: typeof f.seriesId === 'string' && f.seriesId ? f.seriesId : null,
    // The webinar this one was run again from: history only. Older
    // saves' `sessions` (runs kept inside one webinar) are dropped.
    copiedFrom: typeof f.copiedFrom === 'string' ? f.copiedFrom : null,
    // Been to its webinar page: its pages screen is then just for editing
    // the pages (no link card, no Join, no "Go to your webinar")
    seenDetails: f.seenDetails === true,
    // Reminder emails: on/off and the coach's own text (data/reminders.js)
    reminders: isObject(f.reminders) ? f.reminders : {},
  };
}

// The whole save → safe starting values
function restore(saved) {
  // Saves from before series existed: each run joins the series of the
  // first run up its copiedFrom chain
  const withSeries = withSeriesIds(
    (Array.isArray(saved.funnels) ? saved.funnels : [])
      .map(restoreFunnel)
      .filter(Boolean),
  );
  // Runs copied before series existed got their own slug ('…-2'): every run
  // takes its series' first slug, so they all show the one shared address
  const firstSlug = new Map();
  [...withSeries]
    .sort((x, y) => x.createdAt - y.createdAt)
    .forEach((f) => f.slug && !firstSlug.has(f.seriesId) && firstSlug.set(f.seriesId, f.slug));
  const funnels = withSeries.map((f) => (firstSlug.has(f.seriesId) ? { ...f, slug: firstSlug.get(f.seriesId) } : f));
  const openId = funnels.some((f) => f.id === saved.openId) ? saved.openId : null;

  return {
    activeNav: typeof saved.activeNav === 'string' ? saved.activeNav : 'get-started',
    previewMode: saved.previewMode === 'desktop' ? 'desktop' : 'mobile',
    openId,
    // Drop empty funnels left behind, except the one that's open
    funnels: funnels.filter((f) => f.id === openId || !isEmptyFunnel(f)),
  };
}

// Addresses a webinar's slug can't take: the creators' own pages
// (localhost:5173/<handle>), which main.jsx checks first
const takenByPages = () => [accountHandle(), getMockProfile().creator.handle];

function App() {
  // Read the save once, on first load
  const [initial] = useState(() => restore(loadSaved()));

  const [activeNav, setActiveNav] = useState(initial.activeNav);
  const [previewMode, setPreviewMode] = useState(initial.previewMode); // live preview: 'desktop' | 'mobile' (same for every funnel)
  const [funnels, setFunnels] = useState(initial.funnels); // every funnel they've started, newest first
  const [openId, setOpenId] = useState(initial.openId);    // the funnel being worked on; null = on the picker
  // The email editor's "any unsaved changes?" check, for the top bar's ← Reminders
  const leaveGuard = useRef(null);
  const [editingId, setEditingId] = useState(null);         // which screen is being edited, about or landing (not saved)
  const [saveFailed, setSaveFailed] = useState(false);      // shows the "couldn't save" notice

  // ---------- The open funnel ----------
  const current = funnels.find((f) => f.id === openId) ?? null;
  const funnel = current ? funnelTypes.find((t) => t.id === current.type) : null;

  const step = current?.step ?? 'overview'; // 'overview' | 'review' | 'review-edit' | 'about' | 'checkpoint' | 'edit' | 'transition' | 'landing' | 'building' | 'review-design' | 'registration' | 'thank-you' | 'thank-you-building'
  const answers = current?.answers ?? NO_ANSWERS;
  const themeId = current?.themeId ?? null;       // design they picked; null = the one recommended for their topic
  const donePages = current?.donePages ?? NO_PAGES; // pages they've finished, e.g. ['landing']
  const resumeAtEnd = current?.resumeAtEnd ?? false;   // Back from checkpoint → last about screen
  const landingAtEnd = current?.landingAtEnd ?? false; // reopen the landing flow on its last screen
  const positions = current?.positions ?? NO_POSITIONS; // saved screen in each flow
  const serviceId = current?.serviceId ?? null;         // service used as the registration page
  const publishedAt = current?.publishedAt ?? null;     // when it went live; null = not yet

  // Change the open funnel. Pass an object, or a function of the funnel
  // (use the function form when the change depends on what's already there).
  // touch: false → doesn't count as an edit ("Edited 5 min ago" stays the same).
  // A change to the pages, price or emails of a published session also
  // goes to the webinar's other sessions still to come (withSharedChanges,
  // data/webinar.js), so the coach edits once. Its date stays its own.
  const updateOpen = (change, { touch = true } = {}) => updateRun(openId, change, { touch });

  // The same, for any session by id (the Emails tab works on the next session)
  const updateRun = (id, change, { touch = true } = {}) => {
    setFunnels((prev) => {
      const before = prev.find((f) => f.id === id);
      if (!before) return prev;
      const after = {
        ...before,
        ...(typeof change === 'function' ? change(before) : change),
        ...(touch ? { updatedAt: Date.now() } : {}),
      };
      return withSharedChanges(prev, before, after);
    });
  };

  const setStep = (next) => updateOpen({ step: next });

  const handleAnswer = (id, value) => {
    updateOpen((f) => ({ answers: { ...f.answers, [id]: value } }));
  };

  // Remembers which screen they're on in a flow ('about' or 'landing').
  // Moving between screens isn't an edit, so it doesn't touch updatedAt.
  const savePosition = (flow) => (pos) => {
    const prev = positions[flow];
    if (prev && prev.at === pos.at && prev.furthest === pos.furthest) return;
    updateOpen((f) => ({ positions: { ...(f.positions ?? {}), [flow]: pos } }), { touch: false });
  };

  // "Start" on a funnel card: always a new, empty funnel
  const startFunnel = (type) => {
    const created = createFunnel(type);
    setFunnels((prev) => [created, ...prev]);
    setOpenId(created.id);
  };

  // Back to the picker. A funnel they opened but never filled in isn't kept.
  const closeFunnel = () => {
    setFunnels((prev) => prev.filter((f) => f.id !== openId || !isEmptyFunnel(f)));
    setOpenId(null);
  };


  // From the Contracts page (a contract a webinar is using): open that
  // funnel on its overview, where its contract can be changed
  const openFunnelFrom = (id) => {
    if (!funnels.some((f) => f.id === id)) return;
    setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, step: 'overview' } : f)));
    setActiveNav('page-builder');
    setOpenId(id);
  };

  // "Edit page" in a landing page's preview tab: open that webinar's
  // landing page editor here (see utils/editRequest.js)
  const openLandingEditor = (id) => {
    setFunnels((prev) => {
      if (!prev.some((f) => f.id === id)) return prev;
      return prev.map((f) => (f.id === id ? { ...f, step: 'review', returnTo: undefined } : f));
    });
    setActiveNav('page-builder');
    setOpenId((open) => (funnels.some((f) => f.id === id) ? id : open));
  };
  const openEditorRef = useRef(openLandingEditor);
  openEditorRef.current = openLandingEditor;
  useEffect(() => {
    // Opened at ?edit=<id> (the preview tab couldn't close itself)
    const fromAddress = takeEditParam();
    if (fromAddress) openEditorRef.current(fromAddress);
    // Asked from a preview tab while this one is open
    const onStorage = (e) => {
      if (e.key !== EDIT_REQUEST_KEY || !e.newValue) return;
      const id = editRequestId(e.newValue);
      if (id) openEditorRef.current(id);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Delete from the Webinars list (so never the open one). Its sign-up
  // page was made for it alone, so that contract goes too; one picked by
  // hand on an older webinar stays in Contracts.
  const deleteFunnel = (id) => {
    const gone = funnels.find((f) => f.id === id);
    const own = gone ? ownContract(gone) : null;
    if (own) deleteService(own.id);
    deleteSignupsOf(id); // its people go with it
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  };

  // ---------- The sign-up page (its contract) ----------
  // Made from the event details and price, never picked. Confirming the
  // sign-up page makes it (or swaps an older webinar's hand-picked one for it).
  const saveContract = (f) =>
    saveWebinarContract({
      webinarId: f.id,
      contractId: ownContract(f)?.id ?? null,
      fields: webinarContractFields(f.answers),
      startDate: f.answers.date,
    });

  // Makes (or updates) the webinar's own contract and links it. Called as
  // the sign-up page's build starts; returns false if it couldn't save.
  const createSignup = () => {
    const id = saveContract(current);
    if (!id) {
      setSaveFailed(true);
      return false;
    }
    updateOpen({ serviceId: id });
    return true;
  };

  // At the reveal: the sign-up page counts as done
  const markSignupDone = () =>
    updateOpen((f) => ({
      donePages: f.donePages.includes('registration') ? f.donePages : [...f.donePages, 'registration'],
    }));

  // Opening a webinar (a click on its row, "Ran again on …", Go to <date>):
  // its details page once it's published, the setup screen (the three
  // page cards) while it's a draft
  const openWebinar = (id) => {
    setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, step: f.publishedAt ? 'details' : 'overview' } : f)));
    setActiveNav('page-builder');
    setOpenId(id);
  };

  // Edit webinar pages: the three page cards, where each page is edited
  const openPages = (id) => {
    setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, step: 'overview' } : f)));
    setOpenId(id);
  };

  // The newest run made from this webinar, or null
  const latestRun = (f) => laterRuns(f, funnels)[0]?.webinar ?? null;

  // ---------- Run again on a new date ----------
  // Makes a new webinar: a full copy on the new date, with its own pages,
  // sign-up page (contract) and Zoom meeting. It joins the same series, so
  // it shares the earlier one's link: that link opens whichever run is
  // current (data/webinar.js). The earlier one stays exactly as it was,
  // with its own people. The copy is ready to share
  // straight away (its pages are already done) and opens on its details page.
  // Asked in a pop-up, from the list or the webinar's overview.
  const [runAgainId, setRunAgainId] = useState(null);
  const runningAgain = funnels.find((f) => f.id === runAgainId) ?? null;

  const runAgain = ({ date, time }) => {
    const f = runningAgain;
    if (!f) return;
    const now = Date.now();
    const series = seriesIdOf(f, funnels);
    const taken = [...takenByPages(), ...funnels.filter((item) => item.slug && seriesIdOf(item, funnels) !== series).map((item) => item.slug)];
    const copy = {
      ...createFunnel(f.type), // new id, so a new Zoom meeting and its own people
      step: 'details',
      answers: { ...f.answers, date, time },
      themeId: f.themeId,
      donePages: [...f.donePages],
      positions: f.positions ?? {},
      publishedAt: now,
      seriesId: series, // the same link as the earlier run
      slug: f.slug ?? makeSlug(f.answers.headline, taken),
      copiedFrom: f.id,
      seenDetails: true, // they're adding it from the webinar page
      reminders: f.reminders ?? {}, // the same emails and switches; dates fill in fresh
    };
    // Its own sign-up page, starting from the earlier one's settings
    const contractId = saveWebinarContract({
      webinarId: copy.id,
      contractId: null,
      fields: webinarContractFields(copy.answers),
      startDate: date,
      copyOf: ownContract(f)?.id ?? null,
    });
    if (!contractId) {
      setSaveFailed(true);
      return;
    }
    setFunnels((prev) => [{ ...copy, serviceId: contractId }, ...prev]);
    setRunAgainId(null);
    setActiveNav('page-builder');
    setOpenId(copy.id);
  };

  // The first visit to a published webinar's page: remember it, so its
  // pages screen turns into just the pages (FunnelOverview's editing)
  useEffect(() => {
    if (current && step === 'details' && publishedAt && !current.seenDetails) {
      updateOpen({ seenDetails: true }, { touch: false });
    }
  }, [current?.id, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // After that it follows the landing page: a new headline, date or price
  // updates the contract a moment later. Only the webinar's own contract,
  // and those of its other sessions still to come, which just got the same
  // headline and price (each keeps its own date).
  const syncKey =
    current && current.donePages.includes('registration') ? `${current.id}|${contractKey(current.answers)}` : null;
  useEffect(() => {
    if (!syncKey || !current || !ownContract(current)) return undefined;
    const timer = setTimeout(() => {
      saveContract(current);
      upcomingSiblings(current, funnels).forEach((f) => {
        if (f.donePages.includes('registration') && ownContract(f)) saveContract(f);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [syncKey]); // eslint-disable-line react-hooks/exhaustive-deps



  // Publish the open funnel. The slug is made once, from the headline, and
  // kept after that, so editing the headline never breaks a link they've shared.
  // Runs of the same series share a slug, so only other series' count as taken.
  const publishFunnel = () => {
    const series = current ? seriesIdOf(current, funnels) : null;
    const taken = [
      ...takenByPages(),
      ...funnels.filter((f) => f.id !== openId && f.slug && seriesIdOf(f, funnels) !== series).map((f) => f.slug),
    ];
    updateOpen((f) => ({
      publishedAt: Date.now(),
      slug: f.slug ?? makeSlug(f.answers.headline, taken),
    }));
  };

  const handleNavigate = (id) => {
    setActiveNav(id);
    closeFunnel();
  };

  // From the bell: go to Bookings with that call open. n makes a second
  // click on the same update open it again.
  const [bookingRequest, setBookingRequest] = useState(null);
  const openBooking = (id) => {
    handleNavigate('bookings');
    setBookingRequest({ id, n: Date.now() });
  };

  // From a call's contract on the Contracts page: go to 1:1 calls with
  // that call's editor open, since the call is where its contract changes.
  // Cleared on the way to 1:1 calls from the sidebar, so that opens the list.
  const [callRequest, setCallRequest] = useState(null);
  const openCall = (id) => {
    handleNavigate('calls');
    setCallRequest({ id, n: Date.now() });
  };
  const navigateFromSidebar = (id) => {
    setCallRequest(null);
    handleNavigate(id);
  };

  // ---------- Saving ----------
  // Save a moment after every change (not on every keystroke)
  const latest = useRef(null);
  useEffect(() => {
    const snapshot = { activeNav, previewMode, openId, funnels };
    latest.current = snapshot;
    const timer = setTimeout(() => setSaveFailed(!saveProgress(snapshot)), 300);
    return () => clearTimeout(timer);
  }, [activeNav, previewMode, openId, funnels]);

  // If they close or refresh within that moment, save right away
  useEffect(() => {
    const flush = () => {
      if (latest.current) saveProgress(latest.current);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // Save right now, without waiting for the moment above
  // (before a preview opens in a new tab, so it shows the latest changes)
  const saveNow = () => {
    if (latest.current) setSaveFailed(!saveProgress(latest.current));
  };

  // Each QuestionFlow has its own `key` so its screen index resets
  // when we switch between about / edit / landing.
  const renderPageBuilder = () => {
    if (!funnel) {
      return (
        <WebinarsPage
          webinars={funnels.filter((f) => f.type === 'webinar')}
          onCreate={() => startFunnel('webinar')}
          onOpen={setOpenId}
          // A click on the row: straight to its overview (the three page cards)
          onOpenOverview={openWebinar}
          onEditPages={openPages}
          onRunAgain={setRunAgainId}
          // A row is a whole webinar: every one of its dates goes
          onDelete={(ids) => [].concat(ids).forEach(deleteFunnel)}
        />
      );
    }

    // A published webinar's own page: its header, then People
    if (step === 'details' && publishedAt) {
      return (
        <WebinarDetails
          key={openId}
          webinar={current}
          webinars={funnels.filter((f) => f.type === 'webinar')}
          tab={current.detailsTab === 'reminders' ? 'reminders' : 'sessions'}
          onTab={(detailsTab) => updateOpen({ detailsTab }, { touch: false })}
          // Emails: the session the page names (the next one), not always the open one
          onToggleReminder={(runId, id, on) => updateRun(runId, (f) => ({ reminders: withOn(f.reminders, id, on) }))}
          onEditReminder={(runId, id) => {
            setFunnels((prev) => prev.map((f) => (f.id === runId ? { ...f, step: 'reminder-edit', editingReminder: id } : f)));
            setOpenId(runId);
          }}
          onEditPages={(id) => openPages(id ?? openId)}
          // From a session's side panel: just that session's event details, then back here
          onChangeDate={(id) => {
            setEditingId('eventDetails');
            setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, step: 'review-edit', editReturn: 'details' } : f)));
            setOpenId(id);
          }}
          // "Add another session": a copy of the session it names (the latest)
          onRunAgain={(id) => setRunAgainId(id ?? openId)}
          // Delete one session (its side panel). If it's the one open, stay on
          // the webinar through another session; the list when none is left.
          onDelete={(id) => {
            const rest = funnels.filter((f) => f.id !== id && f.type === 'webinar');
            const other = currentRun(seriesIdOf(current, funnels), rest);
            deleteFunnel(id);
            if (id !== openId) return;
            if (other) openWebinar(other.id);
            else setOpenId(null);
          }}
          // Delete webinar (the page's own ⋯): every session, then back to the list
          onDeleteWebinar={(ids) => {
            setOpenId(null);
            ids.forEach(deleteFunnel);
          }}
        />
      );
    }

    // One reminder's email, in the full-page editor. Save keeps the
    // coach's version (or none, if it matches the template) and goes back
    // to the Reminders tab; so does ← Reminders, after asking about changes.
    if (step === 'reminder-edit' && publishedAt && current.editingReminder) {
      const id = current.editingReminder;
      const now = Date.now();
      const ended = webinarStatus(current, now) === 'past';
      const back = () => updateOpen({ step: 'details', editingReminder: undefined, detailsTab: 'reminders' }, { touch: false });
      return (
        <ReminderEditor
          key={`${openId}-${id}`}
          webinar={current}
          id={id}
          people={peopleOf(openId)}
          hostName={answers.hostName}
          now={now}
          ended={ended}
          guardRef={leaveGuard}
          onSave={(email) => {
            updateOpen((f) => ({ reminders: withEmail(f.reminders, id, email) }));
            back();
          }}
          onClose={back}
        />
      );
    }

    if (step === 'overview' || step === 'details') {
      return (
        <FunnelOverview
          funnel={funnel}
          webinarId={openId}
          webinarSlug={current.slug}
          // Any session of it counts: sessions added before this was remembered don't have it
          editing={
            Boolean(publishedAt) &&
            funnels.some((f) => f.seenDetails && seriesIdOf(f, funnels) === seriesIdOf(current, funnels))
          }
          onOpenDetails={() => updateOpen({ step: 'details', returnTo: undefined, editReturn: undefined }, { touch: false })}
          // The newer run of this one, once it's been run again ("Ran again on …")
          nextRun={latestRun(current)}
          onOpenRun={openWebinar}
          onRunAgain={() => setRunAgainId(openId)}
          done={donePages}
          answers={answers}
          themeId={themeId}
          publishedAt={publishedAt}
          onPublish={publishFunnel}
          previewHref={`?preview=${encodeURIComponent(openId)}`}
          onPreview={saveNow}
          onEdit={() => updateOpen({ step: 'review', returnTo: undefined }, { touch: false })}
          // "Change" by the date: just the event details screen, then back here
          onChangeDate={() => {
            setEditingId('eventDetails');
            updateOpen({ step: 'review-edit', editReturn: 'overview' }, { touch: false });
          }}
          service={getService(serviceId)}
          serviceIsOwn={Boolean(ownContract(current))}
          onChangeService={() => updateOpen({ step: 'registration' }, { touch: false })}
          onEditThankYou={() => updateOpen({ step: 'thank-you' }, { touch: false })}
          /* pageId: the card they clicked (always the next page to build) */
          onStart={(pageId) => {
            if (pageId === 'registration') {
              setStep('registration');
              return;
            }
            if (pageId === 'thank-you') {
              setStep('thank-you');
              return;
            }
            updateOpen({ resumeAtEnd: false, step: 'about' });
          }}
        />
      );
    }

    // One row of "Edit your landing page": that screen only (Free or paid also
    // brings Price and Crossed-out price when Paid), then back to the list.
    // Answers save as they type, so Save and Back both just return.
    // From the overview's "Change" by the date (editReturn), back to the overview.
    if (step === 'review-edit') {
      const backToReview = () =>
        updateOpen((f) => ({ step: f.editReturn ?? 'review', editReturn: undefined }), { touch: false });
      const screens = editGroup(editingId);
      if (screens.length > 0) {
        return (
          <QuestionFlow
            key={`review-edit-${editingId}`}
            questions={screens}
            answers={answers}
            onAnswer={handleAnswer}
            hideProgress
            finishLabel="Save"
            onExit={backToReview}
            onComplete={backToReview}
          />
        );
      }
    }

    // "Edit your landing page" (after it's done): one row per screen.
    // Opening and leaving it isn't an edit, so "Edited … ago" stays the same.
    // (Also shown if the screen being edited can't be found.)
    if (step === 'review' || step === 'review-edit') {
      return (
        <LandingEditor
          answers={answers}
          themeId={themeId}
          onEdit={(id) => {
            setEditingId(id);
            updateOpen({ step: 'review-edit' }, { touch: false });
          }}
          onChangeDesign={() =>
            // Remember the current style, so Back can undo what they tried
            updateOpen((f) => ({ themeBefore: f.themeId, step: 'review-design' }), { touch: false })
          }
          // Back to where they came from: the sign-up page when they opened it there
          onDone={() => updateOpen((f) => ({ step: f.returnTo ?? 'overview', returnTo: undefined }), { touch: false })}
        />
      );
    }

    if (step === 'about') {
      return (
        <QuestionFlow
          key="about"
          backAtTop
          backLabel="Previous"
          pageName="About your webinar"
          questions={aboutQuestions}
          answers={answers}
          onAnswer={handleAnswer}
          startAtEnd={resumeAtEnd}
          startAt={positions.about?.at}
          startFurthest={positions.about?.furthest}
          onPositionChange={savePosition('about')}
          finishLabel="Continue"
          onExit={() => setStep('overview')}
          onComplete={() => setStep('checkpoint')}
          wide
          renderProgress={({ index, visible, furthest, goTo }) => (
            <SectionProgress
              current={index}
              questions={visible}
              furthest={furthest}
              onJump={goTo}
            />
          )}
        />
      );
    }

    if (step === 'checkpoint') {
      return (
        <Checkpoint
          questions={aboutQuestions}
          answers={answers}
          onEdit={(id) => {
            setEditingId(id);
            setStep('edit');
          }}
          onBack={() => updateOpen({ resumeAtEnd: true, step: 'about' })}
          onContinue={() => setStep('transition')}
        />
      );
    }

    // "Change" on the style row of "Edit your landing page": the same picker,
    // but Back undoes what they tried and both buttons return to the list
    // (no "page is ready" moment; the page is already done).
    if (step === 'review-design') {
      return (
        <DesignStep
          answers={answers}
          themeId={themeId}
          savedThemeId={current.themeBefore ?? null}
          onThemeChange={(id) => updateOpen({ themeId: id })}
          mode={previewMode}
          onModeChange={setPreviewMode}
          onBack={() =>
            updateOpen((f) => ({ themeId: f.themeBefore ?? f.themeId, themeBefore: undefined, step: 'review' }))
          }
          onUse={(id) => updateOpen({ themeId: id, themeBefore: undefined, step: 'review' })}
        />
      );
    }

    // Right after picking a style: the page "builds", then Preview / Continue.
    // The landing page is already marked done, so the preview tab shows it.
    if (step === 'building') {
      return (
        <BuildingStep
          answers={answers}
          themeId={themeId}
          previewHref={`?preview=${encodeURIComponent(openId)}`}
          onPreview={saveNow}
          /* "Next: Sign-up page" goes back to the overview (the three page cards),
             where the sign-up page card is next */
          nextLabel={donePages.includes('registration') ? 'Back to overview' : undefined}
          onContinue={() => setStep('overview')}
        />
      );
    }

    // Sign-up page: nothing to fill in or change. It's made from the event
    // details (a short build), shown, and Done goes back to the overview.
    // Coming back via Review: already made, so it's shown straight away.
    if (step === 'registration') {
      const own = ownContract(current);
      const picked = getService(serviceId);
      return (
        <SignupStep
          key={openId}
          answers={answers}
          made={Boolean(own) && donePages.includes('registration')}
          legacy={picked && !own ? picked : null}
          previewHref={`?preview=${encodeURIComponent(openId)}&page=signup`}
          onPreview={saveNow}
          onCreate={createSignup}
          onReady={markSignupDone}
          onDone={() => updateOpen({ step: 'overview' }, { touch: false })}
        />
      );
    }

    // Thank you page: how people get the webinar link. Finishing marks the
    // page done and goes back to the overview. Answers save as they go.
    if (step === 'thank-you') {
      return (
        <QuestionFlow
          key="thank-you"
          backAtTop
          pageName="Thank you page"
          /* "Add meeting link" / "Add community link" on the overview opens straight on that screen */
          startAt={donePages.includes('thank-you') ? firstMissing(answers) : null}
          questions={thankYouQuestions}
          answers={answers}
          onAnswer={handleAnswer}
          finishLabel="Done"
          onExit={() => updateOpen({ step: 'overview' }, { touch: false })}
          /* Done or "I'll add it later". The first time, their page "builds" with
             Preview; after an edit, straight back to the overview. */
          onComplete={() =>
            updateOpen((f) => {
              const firstTime = !f.donePages.includes('thank-you');
              return {
                donePages: firstTime ? [...f.donePages, 'thank-you'] : f.donePages,
                step: firstTime ? 'thank-you-building' : 'overview',
              };
            })
          }
        />
      );
    }

    // Right after finishing the thank you page: it "builds", then Preview / Continue
    if (step === 'thank-you-building') {
      return (
        <BuildingStep
          key="thank-you-building"
          page="thank-you"
          answers={answers}
          themeId={themeId}
          previewHref={`?preview=${encodeURIComponent(openId)}&page=thank-you`}
          onPreview={saveNow}
          onContinue={() => setStep('overview')}
        />
      );
    }

    if (step === 'edit') {
      return (
        <QuestionFlow
          key={`edit-${editingId}`}
          questions={aboutQuestions.filter((q) => q.id === editingId)}
          answers={answers}
          onAnswer={handleAnswer}
          hideProgress
          finishLabel="Save"
          onExit={() => setStep('checkpoint')}
          onComplete={() => setStep('checkpoint')}
        />
      );
    }

    if (step === 'transition') {
      return (
        <Transition
          onBack={() => setStep('checkpoint')}
          onContinue={() => updateOpen({ landingAtEnd: false, step: 'landing' })}
        />
      );
    }

    return (
      <QuestionFlow
        key="landing"
        backAtTop
        backLabel="Previous"
        questions={landingQuestions}
        answers={answers}
        onAnswer={handleAnswer}
        onExit={() => setStep('transition')}
        startAtEnd={landingAtEnd}
        startAt={positions.landing?.at}
        startFurthest={positions.landing?.furthest}
        onPositionChange={savePosition('landing')}
        /* Finish: pick the style for their topic behind the scenes and build the
           page straight away. A style they chose earlier (in the editor) is kept. */
        onComplete={() =>
          updateOpen((f) => ({
            themeId: f.themeId ?? recommendedThemeId(f.answers.category),
            donePages: f.donePages.includes('landing') ? f.donePages : [...f.donePages, 'landing'],
            step: 'building', // the "page is ready" moment, then the overview
          }))
        }
        asideWidth="half"
        renderProgress={({ index, visible, furthest, goTo }) => (
          <SectionProgress
            current={index}
            questions={visible}
            furthest={furthest}
            onJump={goTo}
          />
        )}
        renderAside={({ question }) => (
          <ExamplePreview questionId={question.id} />
        )}
      />
    );
  };

  return (
    <AppLayout
      activeNav={activeNav}
      onNavigate={navigateFromSidebar}
      onOpenBooking={openBooking}
      focus={
        activeNav === 'page-builder' && funnel
          ? {
              title: funnelName(current, funnel),
              saveFailed,
              // Its details page shows the title big already, and edits nothing;
              // the email editor has its own heading and Save
              minimal: (step === 'details' || step === 'reminder-edit') && Boolean(publishedAt),
              // Editing an automatic email: back to the Emails tab, asking first about changes.
              // Editing a published webinar's pages: back to its details page. Otherwise the list.
              ...(publishedAt && step === 'reminder-edit'
                ? {
                    exitLabel: 'Emails',
                    // Which webinar this email belongs to: its title and date, centred
                    when: webinarWhen(current.answers)?.line ?? null,
                    onExit: () => {
                      if (leaveGuard.current && leaveGuard.current() === false) return;
                      updateOpen({ step: 'details', editingReminder: undefined, detailsTab: 'reminders' }, { touch: false });
                    },
                  }
                : publishedAt && step !== 'details'
                ? {
                    exitLabel: 'Your webinar',
                    onExit: () => updateOpen({ step: 'details', returnTo: undefined, editReturn: undefined }, { touch: false }),
                  }
                : { onExit: closeFunnel }),
            }
          : null
      }
    >
        {activeNav === 'page-builder' ? (
        renderPageBuilder()
      ) : activeNav === 'my-page' ? (
        <MyPageSetup />
      ) : activeNav === 'calls' ? (
        <CallsPage openRequest={callRequest} />
      ) : activeNav === 'services' ? (
        <ContractsPage onGoToOfferings={() => handleNavigate('calls')} onOpenWebinar={openFunnelFrom} onOpenCall={openCall} />
      ) : activeNav === 'bookings' ? (
        <BookingsPage onNavigate={handleNavigate} openRequest={bookingRequest} />
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Dummy page. Click <strong>Webinars</strong> in the sidebar.
        </p>
      )}

      {runningAgain && (
        <RunAgainDialog
          key={runningAgain.id}
          name={funnelName(runningAgain, funnelTypes.find((t) => t.id === runningAgain.type))}
          answers={runningAgain.answers}
          onCancel={() => setRunAgainId(null)}
          onSchedule={runAgain}
        />
      )}

      {saveFailed && (
        <p className="save-notice" role="alert">
          <AlertTriangle size={18} />
          We couldn't save your latest changes, so they'll be lost if you close or refresh this page.
        </p>
      )}
    </AppLayout>
  );
}

export default App;