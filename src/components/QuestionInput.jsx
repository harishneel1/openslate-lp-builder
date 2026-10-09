import { useRef } from 'react';
import './QuestionInput.css';
import SuggestionPicker from './SuggestionPicker';


function TextInput({ question, value, onChange, onSubmit }) {
  const { maxLength, example } = question;

  return (
    <div className="qinput">
      <input
        autoFocus
        className="qinput__text"
        value={value}
        maxLength={maxLength}
        placeholder={example ? `e.g. ${example}` : ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
      {maxLength && (
        <span className="qinput__count">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function ChoiceInput({ question, value, onChange }) {
  return (
    <div className="qinput qinput__choices">
      {question.options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={`qinput__choice ${value === option ? 'qinput__choice--selected' : ''}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function SentenceInput({ question, answers, onChange, onSubmit }) {
  const refs = useRef([]);

  // Enter moves to the next blank; on the last one it goes to the next question
  const handleKeyDown = (e, i) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = refs.current[i + 1];
    next ? next.focus() : onSubmit();
  };

  return (
    <div className="qinput qinput__sentence">
      {question.parts.map((part, i) => (
        <label key={part.id} className="qinput__part">
          <span className="qinput__lead">{part.lead}</span>
          <textarea
            ref={(el) => (refs.current[i] = el)}
            autoFocus={i === 0}
            rows={1}
            className="qinput__text qinput__blank"
            value={answers[part.id] ?? ''}
            maxLength={part.maxLength}
            onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '), part.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          />
          <span className="qinput__example">e.g. {part.example}</span>
        </label>
      ))}
    </div>
  );
}

export default function QuestionInput(props) {

    // AI-suggested text answers: pick one of a few drafts
  const { suggest, type } = props.question;
  if (suggest && (type === 'text' || type === 'textarea')) {
    return <SuggestionPicker {...props} />;
  }

  
  switch (props.question.type) {
    case 'text':
      return <TextInput {...props} />;
    case 'choice':
      return <ChoiceInput {...props} />;
    case 'sentence':
      return <SentenceInput {...props} />;
    default:
      return (
        <p className="qinput__todo">
          The "{props.question.type}" input is coming in a later step.
        </p>
      );
  }
}