// "Priya Raman" → "PR", "priya" → "P", "" → ""
// Used for the round picture on reviews when there's no photo or icon.
export function initials(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}