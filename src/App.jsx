import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AppLayout from './components/AppLayout';
import FunnelTypePicker from './screens/FunnelTypePicker';
import FunnelOverview from './screens/FunnelOverview';
import QuestionFlow from './screens/QuestionFlow';
import Checkpoint from './screens/Checkpoint';
import SectionProgress from './components/SectionProgress';
import PagePreview from './components/PagePreview';
import { funnelTypes } from './data/funnelTypes';
import { aboutQuestions, landingQuestions } from './data/webinarQuestions';
import Transition from './screens/Transition';
import DesignStep from './screens/DesignStep';
import LandingEditor from './screens/LandingEditor';
import { loadSaved, saveProgress, createFunnel } from './utils/storage';
import { editGroup } from './utils/answerSummary';
import ExamplePreview from './components/ExamplePreview';
import './App.css';
import { funnelName } from './utils/funnelName';

const STEPS = ['overview', 'review', 'review-edit', 'about', 'checkpoint', 'edit', 'transition', 'landing', 'design', 'registration'];

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

  return {
    id: f.id,
    type: f.type,
    createdAt: Number(f.createdAt) || Date.now(),
    updatedAt: Number(f.updatedAt) || Date.now(),
    step,
    answers: isObject(f.answers) ? f.answers : {},
    themeId: typeof f.themeId === 'string' ? f.themeId : null,
    donePages: Array.isArray(f.donePages) ? f.donePages : [],
    resumeAtEnd: f.resumeAtEnd === true,
    landingAtEnd: f.landingAtEnd === true,
    // Screen they're on in each flow: { about: { at, furthest }, landing: { at, furthest } }
    positions: isObject(f.positions) ? f.positions : {},
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

  const step = current?.step ?? 'overview'; // 'overview' | 'review' | 'review-edit' | 'about' | 'checkpoint' | 'edit' | 'transition' | 'landing' | 'design' | 'registration'
  const answers = current?.answers ?? NO_ANSWERS;
  const themeId = current?.themeId ?? null;       // design they picked; null = the one recommended for their topic
  const donePages = current?.donePages ?? NO_PAGES; // pages they've finished, e.g. ['landing']
  const resumeAtEnd = current?.resumeAtEnd ?? false;   // Back from checkpoint → last about screen
  const landingAtEnd = current?.landingAtEnd ?? false; // Back from the design step → last landing screen
  const positions = current?.positions ?? NO_POSITIONS; // saved screen in each flow

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


  // Delete from the "Your funnels" cards (only on the picker, so never the open funnel)
  const deleteFunnel = (id) => {
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  };



  const handleNavigate = (id) => {
    setActiveNav(id);
    closeFunnel();
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
          onBack={closeFunnel}
          previewHref={`?preview=${encodeURIComponent(openId)}`}
          onPreview={saveNow}
          onEdit={() => updateOpen({ step: 'review' }, { touch: false })}
          onStart={() => {
            // Landing page done → go on to the next page
            if (donePages.includes('landing')) {
              setStep('registration');
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
            asideWidth={previewMode === 'desktop' ? 'wide' : 'narrow'}
            renderAside={({ question }) => (
              <PagePreview
                answers={answers}
                currentSection={question.section}
                mode={previewMode}
                onModeChange={setPreviewMode}
              />
            )}
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
          mode={previewMode}
          onModeChange={setPreviewMode}
          onEdit={(id) => {
            setEditingId(id);
            updateOpen({ step: 'review-edit' }, { touch: false });
          }}
          onDone={() => updateOpen({ step: 'overview' }, { touch: false })}
        />
      );
    }

    if (step === 'about') {
      return (
        <QuestionFlow
          key="about"
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

    if (step === 'design') {
      return (
        <DesignStep
          answers={answers}
          themeId={themeId}
          onThemeChange={(id) => updateOpen({ themeId: id })}
          mode={previewMode}
          onModeChange={setPreviewMode}
          onBack={() => updateOpen({ landingAtEnd: true, step: 'landing' })}
          onUse={(id) =>
            updateOpen((f) => ({
              themeId: id,
              donePages: f.donePages.includes('landing') ? f.donePages : [...f.donePages, 'landing'],
              step: 'overview',
            }))
          }
        />
      );
    }

    // Placeholder until the registration page is built
    if (step === 'registration') {
      return (
        <div className="transition">
          <h1 className="transition__title">Next: your registration page</h1>
          <p className="transition__text">This page isn't built yet.</p>
          <div className="transition__nav">
            <button type="button" className="flow__back" onClick={() => setStep('design')}>
              Back to your design
            </button>
          </div>
        </div>
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
        questions={landingQuestions}
        answers={answers}
        onAnswer={handleAnswer}
        onExit={() => setStep('transition')}
        startAtEnd={landingAtEnd}
        startAt={positions.landing?.at}
        startFurthest={positions.landing?.furthest}
        onPositionChange={savePosition('landing')}
        onComplete={() => setStep('design')}
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
      focus={
        activeNav === 'page-builder' && funnel
          ? { title: funnelName(current, funnel), onExit: closeFunnel, saveFailed }
          : null
      }
    >
        {activeNav === 'page-builder' ? (
        renderPageBuilder()
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Dummy page. Click <strong>Page Builder</strong> in the sidebar.
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