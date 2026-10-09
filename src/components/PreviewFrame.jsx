import { Monitor, Smartphone, Info } from 'lucide-react';
import './PreviewFrame.css';

const MODES = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
];

// Phone or browser frame with a Mobile/Desktop toggle.
// Used by the page outline (sketch) and the design step.
// screenRef: lets the parent scroll the inside of the frame.
export default function PreviewFrame({
  mode = 'mobile',
  onModeChange,
  caption,
  note,
  url = 'openslate.ai/your-webinar',
  screenRef,
  children,
}) {
  return (
    <div className={`pv pv--${mode}`}>
      <div className="pv__header">
        <p className="pv__caption">{caption}</p>
        <div className="pv__toggle" role="group" aria-label="Preview size">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              className={`pv__toggle-btn ${mode === id ? 'pv__toggle-btn--active' : ''}`}
              onClick={() => onModeChange?.(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {note && (
        <p className="pv__note">
          <Info size={14} /> {note}
        </p>
      )}

      <div className="pv__frame">
        {mode === 'desktop' && (
          <div className="pv__browserbar">
            <span className="pv__dots"><span /><span /><span /></span>
            <span className="pv__url">{url}</span>
          </div>
        )}
        <div className="pv__screen" ref={screenRef}>
          {children}
        </div>
      </div>
    </div>
  );
}