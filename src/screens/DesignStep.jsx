import { useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import PreviewFrame from '../components/PreviewFrame';
import SimpleDesign from '../components/designs/SimpleDesign';
import { buildPageJson } from '../data/buildPageJson';
import {
  themes,
  getTheme,
  recommendedThemeId,
  recommendationReason,
  loadThemeFont,
} from '../data/themes';
import './QuestionFlow.css'; // reuses .flow__back, .flow__next
import './DesignStep.css';

// After Finish: pick a style (colours, fonts, shapes) for the page.
// themeId: the style they picked, or null until they pick one
// (then the one recommended for their topic is shown).
export default function DesignStep({
  answers,
  themeId,
  onThemeChange,
  mode,
  onModeChange,
  onBack,
  onUse,
}) {
  const category = String(answers.category ?? '').trim();
  const hasCategory = category !== '' && category !== 'Other';

  const recommendedId = recommendedThemeId(category);
  const recommended = getTheme(recommendedId);
  const selectedId = themeId ?? recommendedId;
  const theme = getTheme(selectedId);
  const reason = recommendationReason(recommended, hasCategory ? category : '');

  // Recommended first, the rest in their usual order
  const ordered = [recommended, ...themes.filter((t) => t.id !== recommendedId)];

  // Load every theme's fonts so the "Aa" samples show the real typefaces
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

        <p className="design__done">
          <CheckCircle2 size={18} /> Your landing page content is saved
        </p>
        <h1 className="design__title">Pick a style for your page</h1>
        <p className="design__subtitle">
          Each style sets your page's colours, fonts and button shapes. We've kept it to four
          that look good and get sign-ups, and you can change it anytime.{' '}
          {hasCategory ? (
            <>We picked <strong>{recommended.name}</strong> for {category} webinars.</>
          ) : (
            <>We picked <strong>{recommended.name}</strong>, a style that suits most webinars.</>
          )}
        </p>

        <div className="design__themes" role="group" aria-label="Styles">
          {ordered.map((t) => {
            const isSelected = t.id === selectedId;
            const isRecommended = t.id === recommendedId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                aria-describedby={isRecommended ? 'design-why' : undefined}
                className={`design__theme ${isSelected ? 'design__theme--selected' : ''}`}
                onClick={() => onThemeChange(t.id)}
              >
                {/* Sample: heading font on the band colour, button colour underneath */}
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
                  {/* Touch screens have no hover: show the reason inline once picked */}
                  {isRecommended && isSelected && (
                    <span className="design__why-inline" aria-hidden="true">{reason}</span>
                  )}
                </span>
                {isRecommended && (
                  <span className="design__badge-wrap">
                    <span className="design__badge">Recommended</span>
                    <span id="design-why" role="tooltip" className="design__tip">
                      {reason}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="design__actions">
          <button type="button" className="flow__next" onClick={() => onUse(selectedId)}>
            Use this style <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <PreviewFrame mode={mode} onModeChange={onModeChange} caption="Your landing page">
        <SimpleDesign page={page} theme={theme} />
      </PreviewFrame>
    </div>
  );
}