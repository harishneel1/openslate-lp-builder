import { RotateCcw, Sparkles } from 'lucide-react';
import { ABOUT_MAX, callAboutOf, suggestedAbout } from '../data/callDetails';
import './CallAboutInput.css';

// The longer description on their booking page. It starts filled in,
// with a note saying we wrote it, so they can keep it or make it theirs.
// Saves to callAbout only once they type; until then the page uses
// the written version.
// label: the field's name ("Description" in setup, "Long description" when editing)
// showNote: false hides "We've written this for you" (setup only)
// showHint: false hides "Leave a blank line between paragraphs"
// note: shown under the box, beside the count (in place of the hint)
export default function CallAboutInput({
  answers,
  onChange,
  label = 'Description',
  showNote = true,
  showHint = true,
  note = null,
}) {
  const text = callAboutOf(answers);
  const written = answers.callAbout === undefined;
  const changed = !written && answers.callAbout !== suggestedAbout();

  return (
    <div className="qinput about">
      {showNote && written && (
        <p className="about__note">
          <Sparkles size={16} aria-hidden="true" />
          <span>We’ve written this for you. Keep it as it is, or edit anything to make it sound like you.</span>
        </p>
      )}

      <div className="qinput__field">
        <label className="qinput__label" htmlFor="call-about">{label}</label>
        <textarea
          id="call-about"
          className="qinput__text about__text"
          rows={9}
          maxLength={ABOUT_MAX}
          value={text}
          onChange={(e) => onChange(e.target.value, 'callAbout')}
        />
        <span className="qinput__under">
          <span className="qinput__example">{note ?? (showHint ? 'Leave a blank line between paragraphs.' : '')}</span>
          <span className="qinput__count">{text.length}/{ABOUT_MAX}</span>
        </span>
      </div>

      {changed && (
        <button type="button" className="about__reset" onClick={() => onChange(undefined, 'callAbout')}>
          <RotateCcw size={14} aria-hidden="true" /> Go back to our version
        </button>
      )}
    </div>
  );
}