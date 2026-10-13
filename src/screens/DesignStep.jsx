import { useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import PreviewFrame from '../components/PreviewFrame';
import SimpleDesign from '../components/designs/SimpleDesign';
import { buildPageJson } from '../data/buildPageJson';
import { themes, getTheme, recommendedThemeId, resolveThemeId, loadThemeFont } from '../data/themes';
import './QuestionFlow.css'; // reuses .flow__back, .flow__next
import './DesignStep.css';

// "Change" on the style row of "Edit your landing page".
// (When the page is first built, the style is picked for them from their
// category and this screen is skipped.)
// themeId: the style being previewed right now (changes as they tap)
// savedThemeId: the style saved on the page when they opened this screen
// (null = they never changed it, so it's the best match for their topic)
export default function DesignStep({
  answers,
  themeId,
  savedThemeId = null,
  onThemeChange,
  mode,
  onModeChange,
  onBack,
  onUse,
}) {
  const bestId = recommendedThemeId(answers.category);
  const currentId = resolveThemeId(savedThemeId ?? bestId);
  const selectedId = resolveThemeId(themeId ?? currentId);
  const theme = getTheme(selectedId);

  // Best match first, the rest in their usual order
  const ordered = [getTheme(bestId), ...themes.filter((t) => t.id !== bestId)];

  useEffect(() => {
    themes.forEach(loadThemeFont);
  }, []);

  const page = useMemo(() => buildPageJson(answers, selectedId), [answers, selectedId]);

  return (
    <div className={`design design--${mode}`}>
      <div className="design__intro">
        <button type="button" className="flow__back flow__back--top" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="design__title">Pick a style for your page</h1>
        <p className="design__subtitle">Tap any style to preview it. Your content stays the same.</p>

        <div className="design__themes" role="group" aria-label="Styles">
          {ordered.map((t) => {
            const isSelected = t.id === selectedId;
            // One tag per card: "Current" wins when it's also the best match
            const tag =
              t.id === currentId ? 'current' : t.id === bestId ? 'best' : null;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                className={`design__theme ${isSelected ? 'design__theme--selected' : ''}`}
                onClick={() => onThemeChange(t.id)}
              >
                {/* Sample: heading on the band colour, button colour underneath */}
                <span
                  className="design__swatch"
                  aria-hidden="true"
                  style={{
                    '--swatch-bg': t.tokens['hero-bg'],
                    '--swatch-text': t.tokens['hero-text'],
                    '--swatch-accent': t.tokens.accent,
                    fontFamily: t.tokens.display,
                    fontWeight: t.tokens['display-weight'],
                  }}
                >
                  Aa
                </span>
                <span className="design__theme-body">
                  <span className="design__theme-name">{t.name}</span>
                  <span className="design__theme-desc">{t.description}</span>
                </span>
                {tag && (
                  <span className={`design__badge design__badge--${tag}`}>
                    {tag === 'current' ? 'Current' : 'Best match'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="design__actions">
          <button type="button" className="flow__next" onClick={() => onUse(selectedId)}>
            Save style <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <PreviewFrame mode={mode} onModeChange={onModeChange} caption="Your landing page">
        <SimpleDesign page={page} theme={theme} />
      </PreviewFrame>
    </div>
  );
}