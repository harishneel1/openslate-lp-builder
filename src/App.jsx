import { useState } from 'react';
import AppLayout from './components/AppLayout';
import FunnelTypePicker from './screens/FunnelTypePicker';
import FunnelOverview from './screens/FunnelOverview';
import QuestionFlow from './screens/QuestionFlow';
import Checkpoint from './screens/Checkpoint';
import { funnelTypes } from './data/funnelTypes';
import { aboutQuestions, landingQuestions } from './data/webinarQuestions';

function App() {
  const [activeNav, setActiveNav] = useState('get-started');
  const [funnelId, setFunnelId] = useState(null);
  const [step, setStep] = useState('overview'); // 'overview' | 'about' | 'checkpoint' | 'edit' | 'landing'
  const [answers, setAnswers] = useState({});
  const [editingId, setEditingId] = useState(null);    // which about screen is being edited
  const [resumeAtEnd, setResumeAtEnd] = useState(false); // Back from checkpoint → last about screen

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
          onContinue={() => setStep('landing')}
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

    return (
      <QuestionFlow
        key="landing"
        pageName="Landing page"
        questions={landingQuestions}
        answers={answers}
        onAnswer={handleAnswer}
        onExit={() => setStep('checkpoint')}
        onComplete={() => alert(JSON.stringify(answers, null, 2))}
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