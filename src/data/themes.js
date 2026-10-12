// ------------------------------------------------------------
// Designs for the landing page. One renderer (SimpleDesign),
// the look comes from the theme:
// tokens: become CSS variables (--sd-<name>) on the page
// layout.hero: 'split' | 'centered' | 'stacked'
// layout.card: 'ticket' | 'plain'
// name: plain colour name shown to the user (id stays the same for saved funnels)
// why: reason shown when this theme is the recommended one
// ------------------------------------------------------------
export const themes = [
  {
    id: 'peacock',
    name: 'Green & gold',
    description: 'Modern font, rounded buttons, ticket-style sign-up card.',
    why: 'Calm green and warm gold feel soothing and trustworthy',
    fontUrl:
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Source+Sans+3:wght@400;600;700&display=swap',
    layout: { hero: 'split', card: 'ticket' },
    tokens: {
      'hero-bg': '#0f4c47',
      'hero-text': '#ffffff',
      'hero-muted': 'rgba(255, 255, 255, 0.8)',
      accent: '#f4b223',
      'accent-text': '#13302d',
      page: '#ffffff',
      text: '#1b2826',
      muted: '#5b6b68',
      soft: '#eef4f2',
      'soft-text': '#13302d',
      line: '#d5e0dd',
      icon: '#0f4c47',
      'card-bg': '#ffffff',
      'card-border': 'none',
      radius: '14px',
      'button-radius': '10px',
      'chip-radius': '999px',
      display: "'Bricolage Grotesque', 'Poppins', system-ui, sans-serif",
      body: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif",
      'display-weight': '700',
      tracking: '-0.02em',
      h1: '30px',
      'h1-wide': '42px',
      'h1-leading': '1.1',
    },
  },
  {
    id: 'harbour',
    name: 'Navy & white',
    description: 'Classic serif headings, sharp corners, a formal feel.',
    why: 'Navy and a classic serif feel professional and credible',
    fontUrl:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap',
    layout: { hero: 'split', card: 'plain' },
    tokens: {
      'hero-bg': '#172a46',
      'hero-text': '#ffffff',
      'hero-muted': 'rgba(255, 255, 255, 0.75)',
      accent: '#172a46',
      'accent-text': '#ffffff',
      page: '#ffffff',
      text: '#1c2533',
      muted: '#5d6878',
      soft: '#e9eef5',
      'soft-text': '#172a46',
      line: '#dde3ec',
      icon: '#172a46',
      'card-bg': '#ffffff',
      'card-border': 'none',
      radius: '4px',
      'button-radius': '4px',
      'chip-radius': '2px',
      display: "'Source Serif 4', Georgia, serif",
      body: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      'display-weight': '600',
      tracking: '-0.01em',
      h1: '30px',
      'h1-wide': '44px',
      'h1-leading': '1.15',
    },
  },
  {
    id: 'sunrise',
    name: 'Orange & pink',
    description: 'Friendly rounded font, soft pill-shaped buttons.',
    why: 'Warm colours and soft shapes feel friendly and welcoming',
    fontUrl:
      'https://fonts.googleapis.com/css2?family=Nunito:wght@800&family=Nunito+Sans:wght@400;600;700&display=swap',
    layout: { hero: 'centered', card: 'plain' },
    tokens: {
      'hero-bg': '#f7a531',
      'hero-text': '#3a1f12',
      'hero-muted': 'rgba(58, 31, 18, 0.78)',
      accent: '#b8235a',
      'accent-text': '#ffffff',
      page: '#fffaf5',
      text: '#3a1f12',
      muted: '#7a5a49',
      soft: '#fdeedd',
      'soft-text': '#7a3a12',
      line: '#f1dcc4',
      icon: '#b8235a',
      'card-bg': '#ffffff',
      'card-border': 'none',
      radius: '24px',
      'button-radius': '999px',
      'chip-radius': '999px',
      display: "'Nunito', 'Poppins', system-ui, sans-serif",
      body: "'Nunito Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      'display-weight': '800',
      tracking: '-0.01em',
      h1: '30px',
      'h1-wide': '44px',
      'h1-leading': '1.15',
    },
  },
  {
    id: 'studio',
    name: 'Black & blue',
    description: 'Big bold headings, square edges, a high-contrast look.',
    why: 'Bold type and strong contrast grab attention and feel confident',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap',
    layout: { hero: 'stacked', card: 'plain' },
    tokens: {
      'hero-bg': '#ffffff',
      'hero-text': '#000000',
      'hero-muted': '#4a4a4a',
      accent: '#2340ff',
      'accent-text': '#ffffff',
      page: '#ffffff',
      text: '#000000',
      muted: '#4a4a4a',
      soft: '#eef0ff',
      'soft-text': '#2340ff',
      line: '#000000',
      icon: '#2340ff',
      'card-bg': '#ffffff',
      'card-border': '2px solid #000000',
      radius: '0px',
      'button-radius': '0px',
      'chip-radius': '0px',
      display: "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
      'display-weight': '800',
      tracking: '-0.035em',
      h1: '40px',
      'h1-wide': '68px',
      'h1-leading': '1',
    },
  },
];

// Which theme we recommend for each topic (the category answer)
const CATEGORY_THEME = {
  'Life Coaching & Personal Growth': 'sunrise',
  'Mental Health & Emotional Healing': 'peacock',
  'Leadership & Corporate Training': 'harbour',
  'Career & Communication Skills': 'harbour',
  'Business & Entrepreneurship': 'harbour',
  'Marketing, Sales & Personal Branding': 'studio',
  'Tech & AI': 'harbour',
  'Finance & Wealth': 'harbour',
  'Health, Nutrition & Holistic Medicine': 'peacock',
  'Yoga, Fitness & Meditation': 'peacock',
  'Spirituality, Astrology & Energy Healing': 'peacock',
  'Parenting & Relationships': 'sunrise',
  'Education, Languages & Study Abroad': 'sunrise',
  'Arts & Creative Skills': 'studio',
};

// "Other" or anything unmapped gets the most neutral theme
export const recommendedThemeId = (category) => CATEGORY_THEME[category] ?? 'harbour';

// Why we recommend a theme, for the badge tooltip
export function recommendationReason(theme, category) {
  const fit = category ? `${category} webinars` : 'most webinars';
  return `${theme.why}, which suits ${fit}.`;
}

export const getTheme = (id) => themes.find((t) => t.id === id) ?? themes[0];

// Adds a theme's Google Fonts to the page once
export function loadThemeFont(theme) {
  const url = theme?.fontUrl;
  if (!url || document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}