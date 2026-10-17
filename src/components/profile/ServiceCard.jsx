import { BookOpen, CalendarDays, Clock, MessageSquare, Phone, Star, Video } from 'lucide-react';
import './ServiceCard.css';

// Icon names used in serviceKinds.js → the picture. A new name needs a line here.
const ICONS = {
  calendar: CalendarDays,
  clock: Clock,
  lessons: BookOpen,
  message: MessageSquare,
  phone: Phone,
  video: Video,
};

// One service of any kind. The whole card is the link to its next page.
// Everything kind-specific (facts, button text, link) comes from serviceKinds.js.
export default function ServiceCard({ service }) {
  const { title, description, facts, cta, price, rating, image, href } = service;

  return (
    <a className="sc" href={href}>
      {image && <img className="sc__image" src={image} alt="" />}

      <div className="sc__body">
        <div className="sc__meta">
          {facts.map(({ icon, text }) => {
            const Icon = ICONS[icon];
            return (
              <span key={text} className="sc__chip">
                {Icon && <Icon size={14} aria-hidden="true" />} {text}
              </span>
            );
          })}
          {rating && (
            <span className="sc__rating" aria-label={`Rated ${rating.value} out of 5 from ${rating.count} ratings`}>
              <Star size={14} aria-hidden="true" /> {rating.value}
              <span className="sc__rating-count">({rating.count})</span>
            </span>
          )}
        </div>

        <h3 className="sc__title">{title}</h3>
        {description && <p className="sc__desc">{description}</p>}
      </div>

      <div className="sc__foot">
        <p className="sc__price">
          {price.compare && (
            <s className="sc__compare">
              <span className="sr-only">Was </span>
              {price.compare}
            </s>
          )}
          <span className={price.isFree ? 'sc__amount sc__amount--free' : 'sc__amount'}>{price.label}</span>
        </p>
        <span className="sc__cta">{cta}</span>
      </div>
    </a>
  );
}