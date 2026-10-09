import { useState } from 'react';
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

function App() {
  const [activeNav, setActiveNav] = useState('get-started');
  const [funnelId, setFunnelId] = useState(null);
  const [step, setStep] = useState('overview'); // 'overview' | 'about' | 'checkpoint' | 'edit' | 'transition' | 'landing' | 'design' | 'registration'
  const [answers, setAnswers] = useState({});
  const [editingId, setEditingId] = useState(null);      // which about screen is being edited
  const [resumeAtEnd, setResumeAtEnd] = useState(false); // Back from checkpoint → last about screen
  const [previewMode, setPreviewMode] = useState('mobile'); // live preview: 'desktop' | 'mobile'
  const [landingAtEnd, setLandingAtEnd] = useState(false); // Back from the design step → last landing screen

  const funnel = funnelTypes.find((f) => f.id === funnelId);

  const handleNavigate = (id) => {
    setActiveNav(id);
    setFunnelId(null);
    setStep('overview');
  };

  const handleAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  // Each QuestionFlow has its own `key` so its screen index resets
  // when we switch between about / edit / landing.
  const renderPageBuilder = () => {
    if (!funnel) {
      return <FunnelTypePicker onSelect={setFunnelId} />;
    }

    if (step === 'overview') {
      return (
        <FunnelOverview
          funnel={funnel}
          onBack={() => setFunnelId(null)}
          onStart={() => {
            setResumeAtEnd(false);
            setStep('about');
          }}
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
          finishLabel="Continue"
          onExit={() => setStep('overview')}
          onComplete={() => setStep('checkpoint')}
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
          onBack={() => {
            setResumeAtEnd(true);
            setStep('about');
          }}
          onContinue={() => setStep('transition')}
        />
      );
    }

    if (step === 'design') {
      return (
        <DesignStep
          answers={answers}
          mode={previewMode}
          onModeChange={setPreviewMode}
          onBack={() => {
            setLandingAtEnd(true);
            setStep('landing');
          }}
          onUse={() => setStep('registration')}
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
          onContinue={() => {
            setLandingAtEnd(false);
            setStep('landing');
          }}
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
        onComplete={() => setStep('design')}
        asideWidth={previewMode === 'desktop' ? 'wide' : 'narrow'}
        
                renderProgress={({ question, visible, furthest, goTo }) => (
          <SectionProgress
            currentSection={question.section}
            questions={visible}
            furthest={furthest}
            onJump={goTo}
          />
        )}
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
  };

  return (
    <AppLayout activeNav={activeNav} onNavigate={handleNavigate}>
      {activeNav === 'page-builder' ? (
        renderPageBuilder()
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Dummy page. Click <strong>Page Builder</strong> in the sidebar.
        </p>
      )}
    </AppLayout>
  );
}

export default App;