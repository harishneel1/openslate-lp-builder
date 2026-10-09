import { useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import PreviewFrame from '../components/PreviewFrame';
import SimpleDesign from '../components/designs/SimpleDesign';
import { buildPageJson } from '../data/buildPageJson';
import './QuestionFlow.css'; // reuses .flow__back, .flow__next
import './DesignStep.css';

// After Finish: their answers shown in a finished design.
// Later: 2–3 designs recommended from the category answer.
export default function DesignStep({ answers, mode, onModeChange, onBack, onUse }) {
  const page = useMemo(() => buildPageJson(answers), [answers]);

  return (
    <div className={`design design--${mode}`}>
      <div className="design__intro">
        <button type="button" className="flow__back flow__back--top" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="design__title">Here's your page</h1>
        <p className="design__subtitle">
          Your answers, laid out in a finished design. Check it on mobile and desktop.
        </p>
        <div className="design__actions">
          <button type="button" className="flow__next" onClick={onUse}>
            Use this design <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <PreviewFrame mode={mode} onModeChange={onModeChange} caption="Your landing page">
        <SimpleDesign page={page} />
      </PreviewFrame>
    </div>
  );
}