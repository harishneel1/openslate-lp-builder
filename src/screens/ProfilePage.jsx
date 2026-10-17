import { useEffect, useMemo, useState } from 'react';
import { getMockProfile } from '../data/mockProfile';
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
// Renders only from the page JSON (buildProfileJson), never raw data.
// ------------------------------------------------------------
export default function ProfilePage({ state }) {
  const page = useMemo(() => buildProfileJson(getMockProfile(state)), [state]);
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
                <li key={s.id}>
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