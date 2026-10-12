import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Mic, Pencil, RotateCcw, Sparkles } from 'lucide-react';
import { summariseAnswer } from '../data/mockSummaries';
import { joinWords, useSpeechToText } from '../utils/useSpeechToText';
import './RambleInput.css';

const isFilled = (v) => String(v ?? '').trim() !== '';
const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

// 0:07, 1:42
const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Grows the box with its text (up to the max height in CSS).
// Also re-measures when the box gets narrower, since the text wraps onto more lines.
function useAutoGrow(ref, text) {
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(fit, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let width = el.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === width) return; // only width changes matter
      width = el.offsetWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// "Ramble" questions, on one screen:
//   left:  they write (or speak) as much as they like, then press Tidy it up
//   right: the AI summary slides in; they press Use this and continue,
//          or tell us what to change
//
// question.intro: the line under the question
//
// Saved answers:
//   answers[question.id]          the approved summary
//   answers[`${question.id}Raw`]  everything they wrote, kept for the AI drafts later
//
// Summary panel states:
//   closed   not tidied yet: the box takes the full width
//   reading  "Reading your answer…" while the summary is made
//   review   the summary, with Use this and continue / Change something
//   error    the summary failed, with Try again
export default function RambleInput({ question, value, answers, onChange, onSubmit }) {
  const rawKey = `${question.id}Raw`;
  const raw = answers[rawKey] ?? '';
  const hasSaved = isFilled(value);

  // Coming back to an answered question: both halves show straight away
  const [panel, setPanel] = useState(hasSaved ? 'review' : 'closed');
  const [summary, setSummary] = useState(hasSaved ? value : '');
  const [tidiedText, setTidiedText] = useState(hasSaved ? raw : null); // the text the summary was made from
  const [attempt, setAttempt] = useState(0);
  const [askingChange, setAskingChange] = useState(false);
  const [feedback, setFeedback] = useState('');

  // ---------- Voice ----------
  const speech = useSpeechToText({ lang: 'en-IN' });
  const baseRef = useRef(null); // what was in the box when they started speaking
  const spoken = joinWords(speech.finalText, speech.interimText);
  // While they speak, the box shows their text plus the words so far
  const shown = speech.listening && baseRef.current !== null ? joinWords(baseRef.current, spoken) : raw;

  const boxRef = useRef(null);
  useAutoGrow(boxRef, shown);

  // Ignore a summary that arrives after they've left the screen
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Saves what they wrote. Changing it means the saved summary no longer fits.
  const saveRaw = (text) => {
    onChange(text, rawKey);
    if (isFilled(value)) onChange('', question.id);
  };

  // Words the browser is sure about are saved as they arrive
  useEffect(() => {
    if (baseRef.current === null || !speech.finalText) return;
    saveRaw(joinWords(baseRef.current, speech.finalText));
  }, [speech.finalText]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSpeaking = () => {
    baseRef.current = raw;
    speech.start();
  };

  // ---------- Summary ----------
  const isOpen = panel !== 'closed';
  const reading = panel === 'reading';
  // Their text has changed since the summary was made
  const outOfDate = tidiedText !== null && !same(tidiedText, raw);

  const summarise = ({ nextAttempt = 0, change = '' } = {}) => {
    const text = raw;
    setPanel('reading');
    setAskingChange(false);
    setAttempt(nextAttempt);
    setTidiedText(text);
    summariseAnswer(question.id, text, { attempt: nextAttempt, feedback: change })
      .then((result) => {
        if (!alive.current) return;
        setSummary(result);
        setPanel('review');
      })
      .catch(() => {
        if (alive.current) setPanel('error');
      });
  };

  // Tidy it up: only when there's something new to tidy
  const canTidy = isFilled(raw) && !speech.listening && !reading && (panel === 'closed' || outOfDate || panel === 'error');

  const tidy = () => {
    if (canTidy) summarise();
  };

  // Use this and continue: save the summary, then move on once it's saved
  const continueRef = useRef(false);
  const acceptSummary = () => {
    if (outOfDate) return;
    continueRef.current = true;
    if (same(value, summary)) onSubmit();
    else onChange(summary, question.id);
  };
  useEffect(() => {
    if (continueRef.current && same(value, summary)) {
      continueRef.current = false;
      onSubmit();
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChange = () => {
    if (!isFilled(feedback)) return;
    summarise({ nextAttempt: attempt + 1, change: feedback });
    setFeedback('');
  };

  // ---------- The summary panel's content ----------
  let panelContent = null;
  if (panel === 'reading') {
    panelContent = (
      <>
        <h2 className="ramble__panel-title">
          <Sparkles size={18} /> Reading your answer…
        </h2>
        <div className="ramble__skeleton" aria-hidden="true">
          <div className="ramble__bar" />
          <div className="ramble__bar" />
          <div className="ramble__bar" />
          <div className="ramble__bar ramble__bar--short" />
        </div>
      </>
    );
  } else if (panel === 'error') {
    panelContent = (
      <>
        <h2 className="ramble__panel-title">
          <Sparkles size={18} /> We couldn't read your answer just now
        </h2>
        <div className="ramble__actions">
          <button
            type="button"
            className="ramble__btn ramble__btn--primary"
            onClick={() => summarise({ nextAttempt: attempt })}
          >
            <RotateCcw size={16} /> Try again
          </button>
        </div>
      </>
    );
  } else if (panel === 'review') {
    panelContent = (
      <>
        <h2 className="ramble__panel-title">
          <Sparkles size={18} /> Please review the AI summary
        </h2>
        <p className={`ramble__summary ${outOfDate ? 'ramble__summary--stale' : ''}`}>{summary}</p>

        {outOfDate ? (
          <p className="ramble__stale-note">You've changed your answer. Press Tidy it up to update this.</p>
        ) : askingChange ? (
          <div className="ramble__change">
            <label className="ramble__change-label" htmlFor={`change-${question.id}`}>
              What should we change?
            </label>
            <textarea
              id={`change-${question.id}`}
              autoFocus
              rows={2}
              className="ramble__change-box"
              value={feedback}
              placeholder="e.g. Mention that most of them are working parents"
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChange();
                }
              }}
            />
            <div className="ramble__actions">
              <button
                type="button"
                className="ramble__btn ramble__btn--primary"
                onClick={sendChange}
                disabled={!isFilled(feedback)}
              >
                Update
              </button>
              <button
                type="button"
                className="ramble__btn"
                onClick={() => {
                  setAskingChange(false);
                  setFeedback('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="ramble__actions ramble__actions--panel">
            <button type="button" className="ramble__btn ramble__btn--primary" onClick={acceptSummary}>
              Use this and continue <ArrowRight size={16} />
            </button>
            <button type="button" className="ramble__link" onClick={() => setAskingChange(true)}>
              <Pencil size={14} /> Change something
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {question.intro && <p className="flow__helper">{question.intro}</p>}

      <div className={`ramble ${isOpen ? 'ramble--open' : ''}`}>
        {/* ---------- Left: their words ---------- */}
        <div className="ramble__write">
          <div className={`ramble__field ${speech.listening ? 'ramble__field--listening' : ''}`}>
            <textarea
              ref={boxRef}
              autoFocus={!hasSaved}
              className="ramble__box"
              value={shown}
              readOnly={speech.listening}
              placeholder={question.placeholder}
              aria-label={question.question}
              onChange={(e) => saveRaw(e.target.value)}
              onKeyDown={(e) => {
                // Enter makes a new line. Ctrl/Cmd + Enter is a shortcut for Tidy it up.
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  tidy();
                }
              }}
            />

            {/* Hidden where the browser can't do speech (e.g. Firefox) */}
            {speech.supported && (
              <div className="ramble__tools">
                {speech.listening ? (
                  <button
                    type="button"
                    className="ramble__speak ramble__speak--on"
                    onClick={() => speech.stop()}
                    aria-label="Stop recording"
                  >
                    <span className="ramble__dot" aria-hidden="true" />
                    Listening… {formatTime(speech.seconds)} · Tap to stop
                  </button>
                ) : (
                  <button type="button" className="ramble__speak" onClick={startSpeaking}>
                    <Mic size={16} /> Speak
                  </button>
                )}
              </div>
            )}
          </div>

          {speech.error && (
            <p className="ramble__mic-note" role="status">
              {speech.error === 'blocked'
                ? "We couldn't use your microphone. You can type instead."
                : "Voice isn't working right now. You can type instead."}
            </p>
          )}

          <div className="ramble__actions">
            <button type="button" className="ramble__btn ramble__btn--primary" onClick={tidy} disabled={!canTidy}>
              <Sparkles size={16} /> {question.tidyLabel ?? 'Tidy it up'}
            </button>
          </div>
        </div>

        {/* ---------- Middle: the arrow ---------- */}
        <div className="ramble__arrow" aria-hidden="true">
          {isOpen && (
            <span className="ramble__arrow-icon">
              <ArrowRight size={18} />
            </span>
          )}
        </div>

        {/* ---------- Right: the summary ---------- */}
        <div className="ramble__panel-slot">
          {isOpen && (
            <section className="ramble__panel" aria-live="polite" aria-busy={reading}>
              {panelContent}
            </section>
          )}
        </div>
      </div>
    </>
  );
}