// A funnel's display name: their headline → their topic → "Untitled webinar".
// type: the funnel's type from funnelTypes.js
export function funnelName(funnel, type) {
  const noun = type.id === 'webinar' ? 'webinar' : 'funnel';
  const headline = String(funnel.answers.headline ?? '').trim();
  if (headline) return headline;
  const category = String(funnel.answers.category ?? '').trim();
  if (category && category !== 'Other') return `${category} ${noun}`;
  return `Untitled ${noun}`;
}