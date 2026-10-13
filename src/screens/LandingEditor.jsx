import { useMemo } from 'react';
import { AlertCircle, ArrowLeft, Check, Pencil, Plus } from 'lucide-react';
import { buildPageJson } from '../data/buildPageJson';
import { getTheme, recommendedThemeId } from '../data/themes';
import { landingQuestions } from '../data/webinarQuestions';
import { answerSummary, needsAnswer } from '../utils/answerSummary';
import './QuestionFlow.css'; // reuses .flow__back, .flow__next
import './LandingEditor.css';

// Rows are grouped by where they sit on the page (landingSections ids)
const GROUPS = [
  { title: 'Top of the page', sections: ['hero', 'event', 'cta'] },
  { title: 'Rest of the page', sections: ['learn', 'audience', 'host', 'proof', 'faq'] },
];

// One screen's row: its label, what it says now, and Edit (or Add when empty)
function Row({ question, answers, page, onEdit }) {
  const label = question.reviewLabel ?? question.question;
  const summary = answerSummary(question, answers, page);
  const missing = needsAnswer(question, answers);
  const action = summary ? 'Edit' : 'Add';

  return (
    <li className="editor__row">
      <div className="editor__row-text">
        <span className="editor__label">{label}</span>
        {missing ? (
          <span className="editor__summary editor__summary--missing">
            <AlertCircle size={14} /> {summary ? "Something's missing" : 'Needs an answer'}
          </span>
        ) : (
          <span className={`editor__summary ${summary ? '' : 'editor__summary--empty'}`}>
            {summary ?? 'Not added yet'}
          </span>
        )}
      </div>
      <button
        type="button"
        className="editor__edit"
        aria-label={`${action} ${label.toLowerCase()}`}
        onClick={() => onEdit?.(question.id)}
      >
        {summary ? <Pencil size={14} /> : <Plus size={14} />} {action}
      </button>
    </li>
  );
}

// "Edit your landing page": one row per question screen (the same screens
// they filled in), grouped by where they sit on the page. No preview while editing.
// onEdit(questionId): open that screen. onChangeDesign: open the design step.
// Answers save as they type, so there's no Cancel: Done just goes back.
export default function LandingEditor({
  answers,
  themeId,
  onEdit,
  onChangeDesign,
  onDone,
}) {
  // The design they chose (falls back to the one recommended for their topic)
  const resolvedId = themeId ?? recommendedThemeId(String(answers.category ?? '').trim());
  const theme = getTheme(resolvedId);
  const page = useMemo(() => buildPageJson(answers, resolvedId), [answers, resolvedId]);

  // Only screens they'd see (Price and Crossed-out price only when Paid)
  const visible = landingQuestions.filter(
    (q) => !q.showIf || answers[q.showIf.field] === q.showIf.equals,
  );

  return (
    <div className="editor">
      <div className="editor__intro">
        <button type="button" className="flow__back flow__back--top" onClick={onDone}>
          <ArrowLeft size={16} /> Overview
        </button>

        <h1 className="editor__title">Edit your landing page</h1>
        <p className="editor__subtitle">
          Pick anything to change it. Your changes save as you go.
        </p>

        {GROUPS.map((group) => {
          const questions = visible.filter((q) => group.sections.includes(q.section));
          if (questions.length === 0) return null;
          return (
            <section key={group.title} className="editor__group">
              <h2 className="editor__group-title">{group.title}</h2>
              <ul className="editor__rows">
                {questions.map((q) => (
                  <Row key={q.id} question={q} answers={answers} page={page} onEdit={onEdit} />
                ))}
              </ul>
            </section>
          );
        })}

        <section className="editor__group">
          <h2 className="editor__group-title">Design</h2>
          <ul className="editor__rows">
            <li className="editor__row">
              {/* Same sample as the design step: its band colour with its button colour */}
              <span
                className="editor__swatch"
                aria-hidden="true"
                style={{
                  '--swatch-bg': theme.tokens['hero-bg'],
                  '--swatch-accent': theme.tokens.accent,
                }}
              />
              <div className="editor__row-text">
                <span className="editor__label">Theme</span>
                <span className="editor__summary">{theme.name}</span>
              </div>
              <button
                type="button"
                className="editor__edit"
                aria-label="Change design"
                onClick={() => onChangeDesign?.()}
              >
                <Pencil size={14} /> Change
              </button>
            </li>
          </ul>
        </section>

        <div className="editor__actions">
          <button type="button" className="flow__next" onClick={onDone}>
            <Check size={18} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}