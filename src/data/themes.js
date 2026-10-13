// ------------------------------------------------------------
// Styles for the landing page. One renderer (SimpleDesign),
// the look comes from the theme:
// tokens: become CSS variables (--sd-<n>) on the page
// layout.hero: 'split' | 'centered' | 'stacked'
// layout.card: 'ticket' | 'plain'
// name: how the style feels, shown to the user
// description: who it's best for, shown to the user
//
// The style is picked for them from their category when the page is
// built. They only see the picker if they choose "Change" in the editor.
// ------------------------------------------------------------
const INTER =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
const INTER_STACK = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const typeScale = {
  display: INTER_STACK,
  body: INTER_STACK,
  tracking: '-0.02em',
  h1: '32px',
  'h1-wide': '52px',
  'h1-leading': '1.12',
};

export const themes = [
  {
    id: 'heritage',
    name: 'Warm & traditional',
    description: 'Best for spirituality, astrology, yoga and holistic health',
    fontUrl: INTER,
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      ...typeScale,
      'hero-bg': '#faf5ec',
      'hero-text': '#2b1d14',
      'hero-muted': '#5c4a3d',
      accent: '#8a1c1c', // maroon
      'accent-text': '#ffffff',
      page: '#faf5ec',
      text: '#2b1d14',
      muted: '#5c4a3d',
      soft: '#fbf0d9',
      'soft-text': '#7a4f0f', // dark gold, labels
      line: '#e6d7bf',
      icon: '#8a1c1c',
      'card-bg': '#ffffff',
      'card-border': '1px solid #e6d7bf',
      radius: '12px',
      'button-radius': '8px',
      'chip-radius': '10px',
      'display-weight': '800',
    },
  },
  {
    id: 'calm',
    name: 'Calm & soothing',
    description: 'Best for mental health, coaching and personal growth',
    fontUrl: INTER,
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      ...typeScale,
      'hero-bg': '#faf8f4',
      'hero-text': '#1f2a24',
      'hero-muted': '#4d5a52',
      accent: '#3f6b55', // deep sage
      'accent-text': '#ffffff',
      page: '#faf8f4',
      text: '#1f2a24',
      muted: '#4d5a52',
      soft: '#e8f0ea',
      'soft-text': '#46695a',
      line: '#e1e8e2',
      icon: '#3f6b55',
      'card-bg': '#ffffff',
      'card-border': '1px solid #e1e8e2',
      radius: '18px',
      'button-radius': '999px',
      'chip-radius': '14px',
      'display-weight': '700',
    },
  },
  {
    id: 'rose',
    name: 'Soft & caring',
    description: 'Best for relationships, parenting and emotional healing',
    fontUrl: INTER,
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      ...typeScale,
      'hero-bg': '#fef8f1',
      'hero-text': '#241613',
      'hero-muted': '#5a4540',
      accent: '#ab4865', // deep rose
      'accent-text': '#ffffff',
      page: '#fef8f1',
      text: '#241613',
      muted: '#5a4540',
      soft: '#fbe9e5',
      'soft-text': '#9a3f5a',
      line: '#f0e0db',
      icon: '#ab4865',
      'card-bg': '#ffffff',
      'card-border': '1px solid #f0e0db',
      radius: '18px',
      'button-radius': '999px',
      'chip-radius': '14px',
      'display-weight': '700',
    },
  },
  {
    id: 'professional',
    name: 'Clean & professional',
    description: 'Best for corporate training, careers, finance and education',
    fontUrl: INTER,
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      ...typeScale,
      'hero-bg': '#f6f7f9',
      'hero-text': '#121a26',
      'hero-muted': '#465163',
      accent: '#1d3557', // navy
      'accent-text': '#ffffff',
      page: '#f6f7f9',
      text: '#121a26',
      muted: '#465163',
      soft: '#e8eef6',
      'soft-text': '#2b4a77',
      line: '#e1e6ed',
      icon: '#1d3557',
      'card-bg': '#ffffff',
      'card-border': '1px solid #e1e6ed',
      radius: '10px',
      'button-radius': '8px',
      'chip-radius': '8px',
      'display-weight': '800',
    },
  },
  {
    id: 'creative',
    name: 'Bright & playful',
    description: 'Best for arts, music and creative skills',
    fontUrl: INTER,
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      ...typeScale,
      'hero-bg': '#fffcf6',
      'hero-text': '#1b1b2f',
      'hero-muted': '#474a5e',
      accent: '#2f4ed8', // cobalt
      'accent-text': '#ffffff',
      page: '#fffcf6',
      text: '#1b1b2f',
      muted: '#474a5e',
      soft: '#eaeefe',
      'soft-text': '#2f4ed8',
      line: '#e4e2ea',
      icon: '#2f4ed8',
      'card-bg': '#ffffff',
      'card-border': '2px solid #1b1b2f', // "sticker" outline
      radius: '16px',
      'button-radius': '12px',
      'chip-radius': '12px',
      'display-weight': '800',
    },
  },
  {
    id: 'bold',
    name: 'Bold & modern',
    description: 'Best for tech, AI, business and marketing',
    fontUrl: INTER,
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      ...typeScale,
      'hero-bg': '#030509',
      'hero-text': '#ffffff',
      'hero-muted': 'rgba(255, 255, 255, 0.72)',
      accent: '#8b5cf6', // purple
      'accent-text': '#ffffff',
      page: '#030509',
      text: '#ffffff',
      muted: 'rgba(255, 255, 255, 0.72)',
      soft: 'rgba(139, 92, 246, 0.15)',
      'soft-text': '#c4b5fd',
      line: 'rgba(139, 92, 246, 0.25)',
      icon: '#8b5cf6',
      'card-bg': '#0c0a14',
      'card-border': '1px solid rgba(139, 92, 246, 0.25)',
      radius: '12px',
      'button-radius': '8px',
      'chip-radius': '10px',
      'display-weight': '800',
    },
  },
];

const DEFAULT_THEME_ID = 'professional';

// The style we pick for each topic (the category answer)
const CATEGORY_THEME = {
  'Spirituality, Astrology & Energy Healing': 'heritage',
  'Yoga, Fitness & Meditation': 'heritage',
  'Health, Nutrition & Holistic Medicine': 'heritage',
  'Mental Health & Emotional Healing': 'calm',
  'Life Coaching & Personal Growth': 'calm',
  'Parenting & Relationships': 'rose',
  'Leadership & Corporate Training': 'professional',
  'Career & Communication Skills': 'professional',
  'Finance & Wealth': 'professional',
  'Education, Languages & Study Abroad': 'professional',
  'Arts & Creative Skills': 'creative',
  'Tech & AI': 'bold',
  'Business & Entrepreneurship': 'bold',
  'Marketing, Sales & Personal Branding': 'bold',
};

// "Other" or anything unmapped gets the most neutral style
export const recommendedThemeId = (category) =>
  CATEGORY_THEME[String(category ?? '').trim()] ?? DEFAULT_THEME_ID;

// Ids from the old four styles, which saved funnels may still have
const LEGACY_THEME = {
  peacock: 'calm',
  harbour: 'professional',
  sunrise: 'rose',
  studio: 'bold',
};

export const getTheme = (id) =>
  themes.find((t) => t.id === (LEGACY_THEME[id] ?? id)) ??
  themes.find((t) => t.id === DEFAULT_THEME_ID);

// Any saved id (old, unknown or current) → a current theme id.
// Use this before comparing ids, so old saves still match a card.
export const resolveThemeId = (id) => getTheme(id).id;

// Adds a theme's Google Fonts to the page once
export function loadThemeFont(theme) {
  const url = theme?.fontUrl;
  if (!url || document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}