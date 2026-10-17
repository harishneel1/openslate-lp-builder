import { useState } from 'react';
import { Star } from 'lucide-react';
import './CreatorPanel.css';

// Bios longer than this start folded, with "Read more"
const LONG_BIO = 240;

// Left column of the profile (top of the page on phones): who the creator is
export default function CreatorPanel({ creator }) {
  const [open, setOpen] = useState(false);
  const { name, initials, photo, headline, bio, stats } = creator;
  const long = bio.length > LONG_BIO;

  return (
    <div className="cp">
      <div className="cp__photo">
        {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{initials}</span>}
      </div>

      <h1 className="cp__name">{name}</h1>
      {headline && <p className="cp__headline">{headline}</p>}

      {bio && (
        <div className="cp__about">
          <p id="cp-bio" className={long && !open ? 'cp__bio cp__bio--folded' : 'cp__bio'}>
            {bio}
          </p>
          {long && (
            <button
              type="button"
              className="cp__more"
              aria-expanded={open}
              aria-controls="cp-bio"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <ul className="cp__stats">
          {stats.map((s) => (
            <li key={s.id} className="cp__stat">
              <span className="cp__stat-value">
                {s.id === 'rating' && <Star size={18} aria-hidden="true" />}
                {s.value}
              </span>
              <span className="cp__stat-label">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}