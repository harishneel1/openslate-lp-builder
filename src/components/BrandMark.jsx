import { initials } from '../utils/initials';
import openslateLogo from '../assets/openslate-logo.png';
import './BrandMark.css';

// ------------------------------------------------------------
// The square logo at the left of the dashboard's top bar (AppLayout.jsx),
// and in Settings → Branding's preview.
//
// brand: { saved, name, logo } (data/branding.js)
//   Not saved yet: OpenSlate's logo
//   Saved with a logo: their logo
//   Saved without one: their initials (HN)
// size: in px (40 in the top bar)
//
// OpenSlate's logo: src/assets/openslate-logo.png
// ------------------------------------------------------------
export default function BrandMark({ brand, size = 40 }) {
  const style = { width: size, height: size };
  if (!brand.saved) {
    return <img className="brd-mark brd-mark--openslate" style={style} src={openslateLogo} alt="OpenSlate" />;
  }
  if (brand.logo) {
    return <img className="brd-mark brd-mark--img" style={style} src={brand.logo} alt={brand.name || 'Logo'} />;
  }
  return (
    <span
      className="brd-mark brd-mark--initials"
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
      role="img"
      aria-label={brand.name}
    >
      {initials(brand.name)}
    </span>
  );
}
