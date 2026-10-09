import { Fragment } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Pencil } from 'lucide-react';
import './QuestionFlow.css'; // reuses .flow__nav, .flow__back, .flow__next
import './Checkpoint.css';

// Drop trailing full stops the creator typed, so we don't get ".."
const clean = (text) => String(text ?? '').trim().replace(/[.\s]+$/, '');

// Rebuilds a sentence question from its leads + answers.
// A full stop goes before any lead that starts with a capital ("By the end...").
function Sentence({ parts, answers }) {
  return parts.map((part, i) => {
    const next = parts[i + 1];
    const endsSentence = !next || /^[A-Z]/.test(next.lead);
    return (
      <Fragment key={part.id}>
        {i > 0 && ' '}
        {part.lead} <strong>{clean(answers[part.id])}</strong>
        {endsSentence && '.'}
      </Fragment>
    );
  });
}

export default function Checkpoint({ questions, answers, onEdit, onBack, onContinue }) {
  return (
    <div className="checkpoint">
            <p className="checkpoint__done">
        <CheckCircle2 size={18} /> First part done
      </p>
      <h1 className="checkpoint__title">Check your answers</h1>
      <p className="checkpoint__subtitle">Our AI uses them to draft your page.</p>

      <div className="checkpoint__cards">
        {questions.map((q) => (
          <div key={q.id} className="checkpoint__card">
            <div className="checkpoint__card-head">
              <span className="checkpoint__label">{q.reviewLabel ?? q.question}</span>
              <button type="button" className="checkpoint__edit" onClick={() => onEdit(q.id)}>
                <Pencil size={14} /> Edit
              </button>
            </div>
            <p className="checkpoint__text">
              {q.type === 'sentence'
                ? <Sentence parts={q.parts} answers={answers} />
                : <strong>{answers[q.id]}</strong>}
            </p>
          </div>
        ))}
      </div>

      <div className="flow__nav">
        <button type="button" className="flow__back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="button" className="flow__next" onClick={onContinue}>
          Looks right <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}