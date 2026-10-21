import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AppLayout from './components/AppLayout';
import FunnelTypePicker from './screens/FunnelTypePicker';
import FunnelOverview from './screens/FunnelOverview';
import QuestionFlow from './screens/QuestionFlow';
import Checkpoint from './screens/Checkpoint';
import SectionProgress from './components/SectionProgress';
import { funnelTypes } from './data/funnelTypes';
import { aboutQuestions, landingQuestions } from './data/webinarQuestions';
import Transition from './screens/Transition';
import DesignStep from './screens/DesignStep';
import BuildingStep from './screens/BuildingStep';
import LandingEditor from './screens/LandingEditor';
import ServicePicker from './screens/ServicePicker';
import { getService } from './data/mockServices';
import { thankYouQuestions, groupLinkMissing } from './data/thankYouQuestions';
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

// ('design' is only kept so old saves on the removed creation-time picker restore cleanly)
const STEPS = ['overview', 'review', 'review-edit', 'about', 'checkpoint', 'edit', 'transition', 'landing', 'design', 'building', 'review-design', 'registration', 'thank-you', 'thank-you-building'];

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
  };
}

// The whole save → safe starting values
function restore(saved) {
  const funnels = (Array.isArray(saved.funnels) ? saved.funnels : [])
    .map(restoreFunnel)
    .filter(Boolean);
  const openId = funnels.some((f) => f.id === saved.openId) ? saved.openId : null;

  return {
    activeNav: typeof saved.activeNav === 'string' ? saved.activeNav : 'get-started',
    previewMode: saved.previewMode === 'desktop' ? 'desktop' : 'mobile',
    openId,
    // Drop empty funnels left behind, except the one that's open
    funnels: funnels.filter((f) => f.id === openId || !isEmptyFunnel(f)),
  };
}

function App() {
  // Read the save once, on first load
  const [initial] = useState(() => restore(loadSaved()));

  const [activeNav, setActiveNav] = useState(initial.activeNav);
  const [previewMode, setPreviewMode] = useState(initial.previewMode); // live preview: 'desktop' | 'mobile' (same for every funnel)
  const [funnels, setFunnels] = useState(initial.funnels); // every funnel they've started, newest first
  const [openId, setOpenId] = useState(initial.openId);    // the funnel being worked on; null = on the picker
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
  const updateOpen = (change, { touch = true } = {}) => {
    setFunnels((prev) =>
      prev.map((f) =>
        f.id === openId
          ? {
              ...f,
              ...(typeof change === 'function' ? change(f) : change),
              ...(touch ? { updatedAt: Date.now() } : {}),
            }
          : f,
      ),
    );
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

  // Delete from the "Your funnels" cards (only on the picker, so never the open funnel)
  const deleteFunnel = (id) => {
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  };



  // Publish the open funnel. The slug is made once, from the headline, and
  // kept after that, so editing the headline never breaks a link they've shared.
  const publishFunnel = () => {
    const taken = funnels.filter((f) => f.id !== openId && f.slug).map((f) => f.slug);
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
        <FunnelTypePicker
          onSelect={startFunnel}
          savedFunnels={funnels}
          onOpen={setOpenId}
          onDelete={deleteFunnel}
        />
      );
    }

    if (step === 'overview') {
      return (
        <FunnelOverview
          funnel={funnel}
          done={donePages}
          answers={answers}
          themeId={themeId}
          publishedAt={publishedAt}
          onPublish={publishFunnel}
          previewHref={`?preview=${encodeURIComponent(openId)}`}
          onPreview={saveNow}
          onEdit={() => updateOpen({ step: 'review' }, { touch: false })}
          service={getService(serviceId)}
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
    if (step === 'review-edit') {
      const backToReview = () => updateOpen({ step: 'review' }, { touch: false });
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
          onDone={() => updateOpen({ step: 'overview' }, { touch: false })}
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
          onContinue={() => setStep('overview')}
        />
      );
    }

    // Registration page: pick one of their services. Picking one marks the
    // page done and goes back to the overview; Back changes nothing.
    if (step === 'registration') {
      return (
        <ServicePicker
          key={serviceId ?? 'none'}
          selectedId={serviceId}
          onBack={() => updateOpen({ step: 'overview' }, { touch: false })}
          onUse={(id) =>
            updateOpen((f) => ({
              serviceId: id,
              donePages: f.donePages.includes('registration') ? f.donePages : [...f.donePages, 'registration'],
              step: 'overview',
            }))
          }
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
          /* "Add link" on the overview opens straight on the link screen */
          startAt={donePages.includes('thank-you') && groupLinkMissing(answers) ? 'groupLink' : null}
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
      onNavigate={handleNavigate}
      onOpenBooking={openBooking}
      focus={
        activeNav === 'page-builder' && funnel
          ? { title: funnelName(current, funnel), onExit: closeFunnel, saveFailed }
          : null
      }
    >
        {activeNav === 'page-builder' ? (
        renderPageBuilder()
      ) : activeNav === 'my-page' ? (
        <MyPageSetup />
      ) : activeNav === 'calls' ? (
        <CallsPage />
      ) : activeNav === 'services' ? (
        <ContractsPage onGoToOfferings={() => handleNavigate('calls')} onOpenWebinar={openFunnelFrom} />
      ) : activeNav === 'bookings' ? (
        <BookingsPage onNavigate={handleNavigate} openRequest={bookingRequest} />
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Dummy page. Click <strong>Funnels</strong> in the sidebar.
        </p>
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