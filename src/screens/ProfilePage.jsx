import { useEffect, useMemo, useState } from 'react';
import { getMockProfile } from '../data/mockProfile';
import { getMyPage } from '../data/myProfile';
import { buildProfileJson } from '../data/buildProfileJson';
import CreatorPanel from '../components/profile/CreatorPanel';
import ServiceCard from '../components/profile/ServiceCard';
import ServiceFilters from '../components/profile/ServiceFilters';
import Testimonials from '../components/profile/Testimonials';
import '../styles/storeTheme.css';
import './ProfilePage.css';

// ------------------------------------------------------------
// The creator's public profile, opened at ?mock=profile (see main.jsx).
// Add &state=calls-only, &state=new or &state=single for other situations (mockProfile.js).
// Add &source=mine for the creator's own page, built from their setup answers, with
// only the calls they've put on it (getMyPage in myProfile.js).
// Add &live=1 (with &source=mine) to redraw whenever their answers change in
// this browser: the preview beside setup's "Which calls go on your page?"
// Renders only from the page JSON (buildProfileJson), never raw data.
// ------------------------------------------------------------
export default function ProfilePage({ state, source, live = false }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!live) return undefined;
    const redraw = () => setVersion((v) => v + 1);
    window.addEventListener('storage', redraw);
    return () => window.removeEventListener('storage', redraw);
  }, [live]);
  const page = useMemo(
    () => buildProfileJson(source === 'mine' ? getMyPage() : getMockProfile(state)),
    [state, source, version] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { creator, services, kinds, testimonials } = page;
  const firstName = creator.name.split(' ')[0] || 'This coach';

  // Which filter is on. Falls back to "All" if that kind isn't offered.
  const [filter, setFilter] = useState('all');
  const active = kinds.some((k) => k.id === filter) ? filter : 'all';
  const shown = active === 'all' ? services : services.filter((s) => s.kind === active);

  // One kind: its own heading ("Book a call"). Several: a general one, plus filters.
  const title = kinds.length === 1 ? kinds[0].title : 'Services';

  useEffect(() => {
    document.title = creator.name || 'Profile';
  }, [creator.name]);

  return (
    <div className="pf store-theme">
      <aside className="pf__creator" aria-label={`About ${creator.name}`}>
        <CreatorPanel creator={creator} />
      </aside>

      <main className="pf__main">
        <section aria-labelledby="pf-services">
          <h2 id="pf-services" className="pf__section-title">{title}</h2>
          {kinds.length > 1 && (
            <ServiceFilters kinds={kinds} total={services.length} active={active} onChange={setFilter} />
          )}
          {services.length > 0 ? (
            <ul className="pf__services">
              {shown.map((s) => (
                <li key={s.id} data-kind={s.kind}>
                  <ServiceCard service={s} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="pf__empty">{firstName} isn't taking bookings right now. Check back soon.</p>
          )}
        </section>

        {testimonials.length > 0 && (
          <section aria-labelledby="pf-reviews">
            <Testimonials items={testimonials} titleId="pf-reviews" />
          </section>
        )}
      </main>
    </div>
  );
}