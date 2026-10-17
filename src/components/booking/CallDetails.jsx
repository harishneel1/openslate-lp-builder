import { ChevronRight, Clock, MessageSquare, Phone, Star, Video } from 'lucide-react';
import Testimonials from '../profile/Testimonials';
import './CallDetails.css';

// Same icon names as the service cards (see serviceKinds.js)
const ICONS = { clock: Clock, message: MessageSquare, phone: Phone, video: Video };

// Left side of the booking page: what the call is, who it's with,
// and what people who had it said.
export default function CallDetails({ service, creator, profileHref, reviews }) {
  const { title, image, facts, rating, about } = service;

  // Length first ("15 min"), then the rest, as people scan for time first
  const ordered = [...facts].sort((a, b) => Number(b.icon === 'clock') - Number(a.icon === 'clock'));
  const ratingStat = creator.stats.find((s) => s.id === 'rating');
  const otherStats = creator.stats.filter((s) => s.id !== 'rating');

  return (
    <article className="cd">
      {image && <img className="cd__image" src={image} alt="" />}

      {rating && (
        <p className="cd__rating" aria-label={`Rated ${rating.value} out of 5 from ${rating.count} ratings`}>
          <Star size={15} aria-hidden="true" />
          <span className="cd__rating-value">{rating.value}</span>
          <span className="cd__rating-count">({rating.count})</span>
        </p>
      )}

      <h1 className="cd__title">{title}</h1>

      {/* Who it's with: the reason many people trust the page enough to book */}
      <a className="cd__coach" href={profileHref}>
        <span className="cd__coach-photo" aria-hidden="true">
          {creator.photo ? <img src={creator.photo} alt="" /> : creator.initials}
        </span>
        <span className="cd__coach-text">
          <span className="cd__coach-name">{creator.name}</span>
          {creator.headline && <span className="cd__coach-role">{creator.headline}</span>}
          {creator.stats.length > 0 && (
            <span className="cd__coach-stats">
              {ratingStat && (
                <span className="cd__coach-stat">
                  <Star size={13} aria-hidden="true" /> {ratingStat.value} {ratingStat.label}
                </span>
              )}
              {otherStats.map((s) => (
                <span key={s.id} className="cd__coach-stat">
                  {s.value} {s.label}
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronRight className="cd__coach-go" size={18} aria-hidden="true" />
        <span className="sr-only">See {creator.firstName}'s profile</span>
      </a>

      {/* Length and format. The price is shown on the profile and at checkout, not here. */}
      <dl className="cd__facts">
        {ordered.map(({ icon, text }) => {
          const Icon = ICONS[icon];
          return (
            <div key={text} className="cd__fact">
              <dt className="sr-only">{icon === 'clock' ? 'Length' : 'Format'}</dt>
              <dd>
                {Icon && <Icon size={17} aria-hidden="true" />} {text}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="cd__about">
        {about.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      {reviews.length > 0 && (
        <section className="cd__reviews" aria-labelledby="cd-reviews">
          <Testimonials items={reviews} titleId="cd-reviews" showService={false} />
        </section>
      )}
    </article>
  );
}