import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  MessageSquareQuote,
  MonitorSmartphone,
  PlayCircle,
  Star,
  Users,
} from 'lucide-react';
import {
  buyContractOf,
  getCourse,
  instructorStats,
  isPublished,
  listOf,
  onCoursesChange,
  studentSections,
  testimonialsOf,
} from '../data/courses';
import { buildContractCheckout, contractCheckoutPath } from '../data/contractCheckout';
import { formatMoney, payAmount } from '../data/contractPricing';
import { servicePrice } from '../data/mockServices';
import { getMyProfile } from '../data/myProfile';
import { savedHandle } from '../data/myPage';
import { getMockProfile } from '../data/mockProfile';
import { EXAMPLE_COURSE, EXAMPLE_INSTRUCTOR, EXAMPLE_OFFER, EXAMPLE_RATING, EXAMPLE_REVIEWS } from '../data/exampleCourse';
import { initials } from '../utils/initials';
import { TextView } from '../components/TextEditor';
import CoverArt from '../components/CoverArt';
import { KIND } from './lessonKinds';
import { coverVideoOf, durationOf, durationText, trackRecordOf } from '../data/courseExtras';
import { readVideoLink } from '../data/courses';
import './CourseExtras.css';
import './CourseTestimonials.css';
import googleIcon from '../assets/google-g.svg';
import '../styles/storeTheme.css';
import './AcademyCoursesPage.css';
import './CourseLandingPage.css';

// ------------------------------------------------------------
// A course's landing page: /web/course/<course>. The link a coach shares
// to sell a course. Laid out as Udemy's course page (people know how to
// read it), but in our own look: the same warm, light style as the
// coach's storefront and checkout (storeTheme.css), so going from their
// storefront to a course to paying feels like one site. Built from what
// the course already has (CoursePage.jsx's steps). Nothing on it is
// designed by hand.
//
//   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//   ░ Yoga for Everyday Strength…    (warm band,     ┌───────────────────┐
//   ░ Asana, breathwork and…          dot grid)      │      cover        │
//   ░ 4.8 ★★★★★ (126 ratings) · 1,240 students       │ ₹2,499  ₹4,999    │
//   ░ (MJ) Created by Meera Joshi · Last updated…    │ ( Buy now )       │
//   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Pay once, start…  │
//   ┌ What you'll learn (warm panel) ─────────┐      └───────────────────┘
//   │ ✓ Build a 20-minute…   ✓ Move safely…   │
//   └─────────────────────────────────────────┘
//   This course includes · Course content (a white card) · Requirements
//   · Description (folds after a few paragraphs: Show more) · Who this
//   course is for (plain text on the page)
//   Instructor (a white card): photo, name, headline, stats (rating,
//   reviews, students, courses), bio (folds: Show more), View profile
//   ★ 4.8 course rating · 126 ratings: four review cards, Show all reviews
//   What students say: testimonials the coach added
//
// The look, and where it comes from:
//   the band        the storefront's creator panel: our orange's tint with
//                   a fine orange dot grid fading out, dark words on it
//   the page        light grey, with white cards only where they help
//                   (Course content, Instructor, reviews), so it doesn't
//                   become a stack of boxes; What you'll learn is the one
//                   warm panel, the part that sells
//   type            Poppins at 600–700 (never 800); section headings as
//                   on every public page (20px, 600); long text in the
//                   softer body colour; links and orange words in the
//                   darker orange (--pf-accent-ink), which reads on white
//   Buy now         checkout's Pay button: a pill in our orange with dark
//                   words (--pf-accent-on), so the click into checkout
//                   feels continuous
//   avatars         initials on our orange (the coach) or its tint
//                   (reviewers), as checkout and the academy show people
// Every colour comes from the store theme's --pf-* names, so a change to
// the brand's colours carries through.
//
// No academy bar on top (logo, Courses): this is a page shared to sell,
// read by people who aren't students yet, so the band starts at the very
// top and nothing leads away from the course. (The coach's Preview and the
// Example still get their strip above it.)
//
// Scrolled past the band, a slim white bar sticks to the top: the title
// (and rating), the price and Buy now, so buying is always one tap away.
//
// What it shows, and where it comes from:
//   title, subtitle, cover, description,    Landing page step
//     what you'll learn, requirements,
//     who it's for, testimonials
//   This course includes                    worked out from the lessons
//                                           students see: videos (uploaded
//                                           or YouTube/Vimeo), articles
//                                           (text), PDFs, and resources
//   Course content                          Curriculum: sections by name and
//                                           lessons by name, as students see
//                                           them (empty ones left out), each
//                                           section with its lesson count.
//                                           Names only: no lesson opens here.
//   Instructor                              the coach's profile (name, photo,
//                                           bio: myProfile.js), and stats
//                                           that fill in by themselves
//                                           (instructorStats: students,
//                                           courses); a stat that's 0 isn't
//                                           shown. View profile: their
//                                           storefront, once they have one
//   rating, reviews                         from students, once reviews are
//                                           collected (not yet: only the
//                                           example has them). Shown only
//                                           with at least 3 reviews: one
//                                           review, or two low ones, hurts
//                                           more than none.
//   price, Buy now                          Pricing: the Buy button's
//                                           contract (buyContractOf). The
//                                           price is the one for where
//                                           they are (buildContractCheckout),
//                                           with the full price crossed out
//                                           when the contract has a discount.
// A part with nothing in it isn't shown. Video lengths come later (the
// prototype keeps no files): no "2h 38m total" yet.
//
// Buy now (Enroll for free, when it's free) opens the contract's checkout,
// /web/checkout/<contract> (ContractCheckoutPage.jsx). After paying, its
// thank-you page has Start learning, signed in (ContractDonePage.jsx). A
// contract another page owns (a webinar's, say) sends them to that page.
// A contract that's been turned off says sign-ups are closed.
//
// Desktop: the Buy box sits on the right, over the band, and stays in
// view as they scroll. Phones: it comes under the band, and a bar with
// the price and Buy now stays at the foot of the screen (the top bar
// isn't used there).
//
// Only a published course shows. Any other link says the page isn't
// available, without saying what's there. ?preview=1 is the coach's
// Preview: drafts show too, with a strip on top saying so, and a draft's
// Buy now does nothing (it works once it's published).
//
// Example mode (?mock=course-example): Meera's example course
// (exampleCourse.js), the same page with its content, to show what a
// finished landing page looks like. Its Buy now goes nowhere.
//
// embed (&embed=1): the example inside the guide beside the course editor
// (courseAnnotations.js): no Example strip, and neither bar that follows
// the scroll, so the guide's highlights have the page to themselves. The
// guide finds the parts by their class names (.cld__title, .cld__box…):
// keep them when restyling.
//
// courseId; preview; region: ?region=IN, EU or ELSE, to see another
// country's price (as on checkout); example: show the example course;
// embed: shown inside the guide
// ------------------------------------------------------------

const plural = (n, word) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;
const REVIEWS_MIN = 3; // fewer, and no rating or reviews show
const REVIEWS_SHOWN = 4; // then Show all reviews
const LONG_BIO = 420;
const LONG_DESCRIPTION = 900; // characters of html, roughly three short paragraphs

function useCourse(id) {
  const [course, setCourse] = useState(() => getCourse(id));
  useEffect(() => onCoursesChange(() => setCourse(getCourse(id))), [id]);
  return course;
}

// What the Buy box offers: { state: 'buy' | 'closed' | 'none', href, free, amount, compare, monthly }
function offerOf(course, region) {
  const contract = buyContractOf(course);
  if (!contract) return { state: 'none' };
  const data = buildContractCheckout({ contractId: contract.id, region });
  if (data.status === 'elsewhere') {
    const free = servicePrice(contract) === 'Free';
    return { state: 'buy', href: data.href, free, amount: servicePrice(contract), compare: null };
  }
  if (data.status !== 'ok') return { state: 'closed' };
  const href = `${contractCheckoutPath(contract.id)}${region ? `?region=${encodeURIComponent(region)}` : ''}`;
  if (data.free) return { state: 'buy', href, free: true, amount: 'Free', compare: null };
  const p = data.price;
  const compare = p.discount != null && p.discount > 0 ? formatMoney(p.price, p.currency) : null;
  return {
    state: 'buy',
    href,
    free: false,
    amount: `${formatMoney(payAmount(p), p.currency)}${data.monthly ? '/month' : ''}`,
    compare,
    monthly: data.monthly,
  };
}

// ★★★★☆, half stars rounded to the nearest half
function Stars({ value, size = 15 }) {
  return (
    <span className="cld__stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="cld__star">
            <Star size={size} className="cld__star-empty" />
            {fill > 0 && (
              <span className="cld__star-fill" style={{ width: `${Math.round(fill * 2) * 50}%` }}>
                <Star size={size} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// The coach's picture, or their initials on our orange (as checkout shows them)
function CreatorPhoto({ creator, className }) {
  return (
    <span className={className} aria-hidden="true">
      {creator.photo ? <img src={creator.photo} alt="" /> : initials(creator.name)}
    </span>
  );
}

export default function CourseLandingPage({ courseId, preview = false, region = null, example = false, embed = false }) {
  const found = useCourse(example ? null : courseId);
  const course = example ? EXAMPLE_COURSE : found && (preview || isPublished(found)) ? found : null;
  const sections = useMemo(() => (course ? studentSections(course) : []), [course]);
  const hero = useRef(null);
  const [pastHero, setPastHero] = useState(false); // the slim bar shows

  useEffect(() => {
    document.title = course ? course.title : 'Page not available';
  }, [course]);

  // The slim bar: once the band has scrolled out of view
  useEffect(() => {
    const el = hero.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [course?.id]);

  if (!course) {
    return (
      <div className="acd store-theme">
        <main className="acd__main">
          <section className="acd__empty">
            <h1 className="acd__empty-title">This page isn’t available</h1>
            <p className="acd__empty-text">Check the link you were sent.</p>
          </section>
        </main>
      </div>
    );
  }

  const live = isPublished(course);
  const offer = example ? EXAMPLE_OFFER : offerOf(course, region);
  const canBuy = offer.state === 'buy' && live;
  const creator = example ? EXAMPLE_INSTRUCTOR : getMyProfile().creator;
  const stats = example ? EXAMPLE_INSTRUCTOR.stats : instructorStats();
  // Their storefront, where View profile goes: Meera's for the example; the
  // coach's own once they've picked its link
  const handle = example ? getMockProfile().creator.handle : savedHandle();
  const profileHref = handle ? `/${handle}` : null;
  // Reviews come once students can rate a course; only the example has them yet
  const reviews = example ? EXAMPLE_REVIEWS : [];
  const rating = example ? EXAMPLE_RATING : null;
  const showRating = Boolean(rating) && reviews.length >= REVIEWS_MIN;
  const testimonials = example ? [] : testimonialsOf(course);
  const outcomes = listOf(course, 'outcomes');
  const requirements = listOf(course, 'requirements');
  const audience = listOf(course, 'audience');
  const lessons = sections.flatMap((s) => s.lessons);
    const updated = new Date(course.updatedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  // Round 3: how long it takes, and the coach's own track record (only
  // once they've turned it on). The course's own rating takes over once it
  // has enough reviews (showRating).
  const duration = durationOf(course);
  const track = example ? null : trackRecordOf(course);
  const showTrack = !showRating && Boolean(track?.on);
  const realStudents = stats.students ?? 0;
  const shownStats = track?.on
    ? { ...stats, rating: stats.rating || track.rating, ratingFrom: stats.rating ? null : track.source, students: Math.max(realStudents, track.students) }
    : stats;

  const count = (kinds) => lessons.filter((l) => kinds.includes(l.content.kind)).length;
  const resources = lessons.reduce((n, l) => n + l.resources.length, 0);
    const includes = [
    duration ? { id: 'time', icon: Clock, text: `${durationText(duration)} to complete` } : null,
    { id: 'video', icon: PlayCircle, n: count(['video', 'embed']), word: 'video' },
    { id: 'text', icon: AlignLeft, n: count(['text']), word: 'article' },
    { id: 'pdf', icon: FileText, n: count(['pdf']), word: 'PDF' },
    { id: 'res', icon: Download, n: resources, word: 'downloadable resource' },
   ].filter((row) => row && (row.text || row.n > 0));

  const buyLabel = offer.free ? 'Enroll for free' : 'Buy now';

  return (
    <div className={`acd cld store-theme ${offer.state === 'buy' && !embed ? 'cld--with-bar' : ''}`}>
      {example && !embed && (
        <p className="cpl__preview" role="status">
          <Eye size={17} aria-hidden="true" />
          Example: a sample course by Meera Joshi, to show what a finished landing page looks like.
        </p>
      )}

      {/* ---------- The warm band ---------- */}
      <header className="cld__hero" ref={hero}>
        <div className="cld__wrap">
          <div className="cld__hero-text">
            <h1 className="cld__title">{course.title}</h1>
            {course.subtitle && <p className="cld__subtitle">{course.subtitle}</p>}
            {showRating && (
              <p className="cld__rating">
                <strong className="cld__rating-value">{rating.average.toFixed(1)}</strong>
                <Stars value={rating.average} />
                <a className="cld__rating-link" href="#cld-reviews">
                  ({plural(rating.count, 'rating')})
                </a>
                <span className="cld__rating-students">{plural(rating.students, 'student')}</span>
              </p>
            )}
                        {showTrack && (
              <p className="cld__proof cld__rating">
                <strong className="cld__proof-value">{track.rating.toFixed(1)}</strong>
                <Stars value={track.rating} />
                <span aria-hidden="true">·</span>
                <span className="cld__proof-students">{plural(track.students, 'student')}</span>
              </p>
            )}
            {!showRating && !showTrack && !example && realStudents > 0 && (
              <p className="cld__proof">
                <span className="cld__proof-students">
                  {plural(realStudents, 'student')} {realStudents === 1 ? 'has' : 'have'} learned with {creator.name.split(' ')[0]}
                </span>
              </p>
            )}
            {!showRating && !showTrack && !example && realStudents === 0 && <p className="cld__new">New course</p>}
            <p className="cld__by">
              <CreatorPhoto creator={creator} className="cld__by-photo" />
              <span>
                Created by <a href="#cld-instructor">{creator.name}</a>
                <span aria-hidden="true"> · </span>
                                Last updated {updated}
              </span>
            </p>
            {duration && (
              <p className="cld__duration">
                <Clock size={16} aria-hidden="true" />
                {durationText(duration)} to complete
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="cld__wrap cld__layout">
        <main className="cld__main">
          {outcomes.length > 0 && (
            <section className="cld__box" aria-labelledby="cld-learn">
              <h2 className="cld__h2" id="cld-learn">
                What you’ll learn
              </h2>
              <ul className="cld__learn">
                {outcomes.map((item) => (
                  <li key={item}>
                    <span className="cld__tick" aria-hidden="true">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {includes.length > 0 && (
            <section className="cld__part" aria-labelledby="cld-includes">
              <h2 className="cld__h2" id="cld-includes">
                This course includes
              </h2>
              <ul className="cld__includes">
                {includes.map(({ id, icon: Icon, n, word, text }) => (
                  <li key={id}>
                    <Icon size={18} aria-hidden="true" />
                    {text ?? plural(n, word)}
                  </li>
                ))}
                <li>
                  <MonitorSmartphone size={18} aria-hidden="true" />
                  Access on your phone and computer
                </li>
              </ul>
            </section>
          )}

          {sections.length > 0 && <Curriculum sections={sections} lessons={lessons.length} />}

          {requirements.length > 0 && (
            <section className="cld__part" aria-labelledby="cld-req">
              <h2 className="cld__h2" id="cld-req">
                Requirements
              </h2>
              <ul className="cld__bullets">
                {requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {course.description && <Description html={course.description} />}

          {audience.length > 0 && (
            <section className="cld__part" aria-labelledby="cld-who">
              <h2 className="cld__h2" id="cld-who">
                Who this course is for
              </h2>
              <ul className="cld__bullets">
                {audience.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <Instructor creator={creator} stats={shownStats} profileHref={profileHref} />
          {showRating && <Reviews rating={rating} reviews={reviews} />}

          {testimonials.length > 0 && <Testimonials items={testimonials} />}
        </main>

        {/* ---------- The Buy box ---------- */}
        <aside className="cld__side" aria-label="Buy this course">
          <div className="cld__card">
            <CoverMedia course={course} />
            <div className="cld__card-body">
              <BuyParts offer={offer} canBuy={canBuy} label={buyLabel} />
            </div>
          </div>
        </aside>
      </div>

      {/* ---------- Phones: the price and Buy now, at the foot ---------- */}
      {offer.state === 'buy' && !embed && (
        <div className="cld__bar">
          <p className="cld__bar-price">
            <span className="cld__amount">{offer.amount}</span>
            {offer.compare && <s className="cld__compare">{offer.compare}</s>}
          </p>
          <BuyButton href={offer.href} enabled={canBuy} label={buyLabel} />
        </div>
      )}
    </div>
  );
}

// The price, Buy now and the line under it (or why it can't be bought)
function BuyParts({ offer, canBuy, label }) {
  if (offer.state === 'none') {
    return <p className="cld__closed">This course can’t be bought yet.</p>;
  }
  if (offer.state === 'closed') {
    return <p className="cld__closed">Sign-ups for this course are closed for now.</p>;
  }
  return (
    <>
      <p className="cld__price">
        <span className="cld__amount">{offer.amount}</span>
        {offer.compare && (
          <s className="cld__compare">
            <span className="sr-only">Full price </span>
            {offer.compare}
          </s>
        )}
      </p>
      <BuyButton href={offer.href} enabled={canBuy} label={label} wide />
      <p className="cld__after">
        {offer.free
          ? 'Sign up with your details and start straight away.'
          : offer.monthly
            ? 'Paid every month. Start as soon as you’ve paid.'
            : 'Pay once. Start as soon as you’ve paid.'}
      </p>
    </>
  );
}

function BuyButton({ href, enabled, label, wide = false, tabbable = true }) {
  if (!enabled) {
    return (
      <span className={`cld__buy cld__buy--off ${wide ? 'cld__buy--wide' : ''}`} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <a
      className={`cld__buy ${wide ? 'cld__buy--wide' : ''}`}
      href={href}
      tabIndex={tabbable ? undefined : -1}
      // The example's Buy now (href '#') goes nowhere
      onClick={href === '#' ? (e) => e.preventDefault() : undefined}
    >
      {label}
    </a>
  );
}

// Course content: each section folds open or shut; the first starts open
function Curriculum({ sections, lessons }) {
  const [open, setOpen] = useState(() => new Set([sections[0].id]));
  const all = open.size === sections.length;
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="cld__part" aria-labelledby="cld-content">
      <h2 className="cld__h2" id="cld-content">
        Course content
      </h2>
      <div className="cld__content-bar">
        <p>
          {plural(sections.length, 'section')} • {plural(lessons, 'lesson')}
        </p>
        <button
          type="button"
          className="cld__link"
          onClick={() => setOpen(all ? new Set() : new Set(sections.map((s) => s.id)))}
        >
          {all ? 'Collapse all sections' : 'Expand all sections'}
        </button>
      </div>
      <ol className="cld__sections">
        {sections.map((section) => {
          const isOpen = open.has(section.id);
          return (
            <li key={section.id} className="cld__section">
              <button
                type="button"
                className="cld__section-head"
                aria-expanded={isOpen}
                aria-controls={`cld-sec-${section.id}`}
                onClick={() => toggle(section.id)}
              >
                <ChevronDown size={18} className={`cld__chev ${isOpen ? 'cld__chev--open' : ''}`} aria-hidden="true" />
                <span className="cld__section-title">{section.title}</span>
                <span className="cld__section-count">{plural(section.lessons.length, 'lesson')}</span>
              </button>
              {isOpen && (
                <ul className="cld__lessons" id={`cld-sec-${section.id}`}>
                  {section.lessons.map((lesson) => {
                    const kind = lesson.content.kind;
                    const Icon = kind === 'video' || kind === 'embed' ? PlayCircle : KIND[kind]?.icon ?? FileText;
                    return (
                      <li key={lesson.id} className="cld__lesson">
                        <Icon size={16} aria-hidden="true" />
                        <span>{lesson.title}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Description: folded, with Show more, when it's long
function Description({ html }) {
  const [more, setMore] = useState(false);
  const long = html.length > LONG_DESCRIPTION;
  return (
    <section className="cld__part" aria-labelledby="cld-desc">
      <h2 className="cld__h2" id="cld-desc">
        Description
      </h2>
      <div id="cld-desc-text" className={`cld__description ${long && !more ? 'cld__fold' : ''}`}>
        <TextView html={html} />
      </div>
      {long && (
        <button type="button" className="cld__link cld__more" aria-expanded={more} aria-controls="cld-desc-text" onClick={() => setMore((m) => !m)}>
          {more ? 'Show less' : 'Show more'}
          <ChevronDown size={16} className={`cld__chev ${more ? 'cld__chev--open' : ''}`} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

// The coach, as a card (as the storefront's creator panel): photo, name,
// headline, stats that aren't 0, bio (folded when long), View profile
function Instructor({ creator, stats, profileHref }) {
  const [more, setMore] = useState(false);
  const bio = String(creator.bio ?? '').trim();
  const long = bio.length > LONG_BIO;
  const rows = [
    stats.rating
      ? {
          id: 'rating',
          icon: Star,
          text: stats.ratingFrom ? `${stats.rating.toFixed(1)} rating on ${stats.ratingFrom}` : `${stats.rating.toFixed(1)} instructor rating`,
        }
      : null,
    stats.reviews ? { id: 'reviews', icon: MessageSquareQuote, text: plural(stats.reviews, 'review') } : null,
    stats.students ? { id: 'students', icon: Users, text: plural(stats.students, 'student') } : null,
    stats.courses ? { id: 'courses', icon: BookOpen, text: plural(stats.courses, 'course') } : null,
  ].filter(Boolean);

  return (
    <section className="cld__part" id="cld-instructor" aria-labelledby="cld-instructor-title">
      <h2 className="cld__h2" id="cld-instructor-title">
        Instructor
      </h2>
      <div className="cld__instructor-card">
        <div className="cld__instructor">
          <CreatorPhoto creator={creator} className="cld__photo" />
          <div className="cld__instructor-text">
            <p className="cld__name">{creator.name}</p>
            {creator.headline && <p className="cld__headline">{creator.headline}</p>}
            {rows.length > 0 && (
              <ul className="cld__stats">
                {rows.map(({ id, icon: Icon, text }) => (
                  <li key={id}>
                    <Icon size={15} aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {bio && (
          <>
            <p id="cld-bio" className={`cld__bio ${long && !more ? 'cld__fold' : ''}`}>
              {bio}
            </p>
            {long && (
              <button type="button" className="cld__link cld__more" aria-expanded={more} aria-controls="cld-bio" onClick={() => setMore((m) => !m)}>
                {more ? 'Show less' : 'Show more'}
                <ChevronDown size={16} className={`cld__chev ${more ? 'cld__chev--open' : ''}`} aria-hidden="true" />
              </button>
            )}
          </>
        )}
        {profileHref && (
          <a className="cld__profile" href={profileHref}>
            View {creator.name.split(' ')[0]}’s profile
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}

// ★ 4.8 course rating · 126 ratings, four cards, then Show all reviews
function Reviews({ rating, reviews }) {
  const [all, setAll] = useState(false);
  const shown = all ? reviews : reviews.slice(0, REVIEWS_SHOWN);
  return (
    <section className="cld__part" id="cld-reviews" aria-labelledby="cld-reviews-title">
      <h2 className="cld__h2 cld__reviews-title" id="cld-reviews-title">
        <Star size={20} className="cld__reviews-star" aria-hidden="true" />
        {rating.average.toFixed(1)} course rating
        <span className="cld__dot" aria-hidden="true">
          ·
        </span>
        {plural(rating.count, 'rating')}
      </h2>
      <ul className="cld__reviews">
        {shown.map((r) => (
          <li key={r.id} className="cld__review">
            <div className="cld__review-head">
              <span className="cld__avatar" aria-hidden="true">
                {initials(r.name)}
              </span>
              <div>
                <p className="cld__review-name">{r.name}</p>
                <p className="cld__review-meta">
                  <Stars value={r.stars} size={13} />
                  <span className="sr-only">{r.stars} out of 5 stars, </span>
                  {r.when}
                </p>
              </div>
            </div>
            <p className="cld__review-text">{r.text}</p>
          </li>
        ))}
      </ul>
      {reviews.length > REVIEWS_SHOWN && (
        <button type="button" className="cld__all" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
        </button>
      )}
    </section>
  );
}

// What students say: testimonials the coach added, as a webinar page's
// reviews: the quote, then their picture beside "Name, Who they are",
// then View LinkedIn at the foot when there's a link. No stars.
function Testimonials({ items }) {
  return (
    <section className="cld__part" aria-labelledby="cld-testimonials">
      <h2 className="cld__h2" id="cld-testimonials">
        What students say
      </h2>
      <ul className="cld__reviews">
        {items.map((t) => {
          const who = [t.name, t.from].filter(Boolean).join(', ');
          return (
            <li key={t.id} className="cld__review cld__testimonial ctm-card">
              <p className="cld__review-text">“{t.text}”</p>
              {(who || t.photo || t.source) && (
                <div className="ctm-card__by">
                  <ReviewerPicture testimonial={t} />
                  {who && <p className="ctm-card__who">{who}</p>}
                </div>
              )}
              {t.linkedin && (
                <a className="ctm-card__linkedin" href={t.linkedin} target="_blank" rel="noopener noreferrer">
                  <span className="ctm-card__in" aria-hidden="true">
                    in
                  </span>
                  View LinkedIn
                  <span className="sr-only">
                    {t.name ? ` profile of ${t.name}` : ' profile'} (opens in a new tab)
                  </span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Their picture: their photo, else the Google icon, else their initials,
// else nothing (as a webinar page's ReviewerPicture)
function ReviewerPicture({ testimonial: t }) {
  if (t.photo) {
    return (
      <span className="ctm-card__photo" aria-hidden="true">
        <img src={t.photo} alt="" />
      </span>
    );
  }
  if (t.source === 'google') {
    return (
      <span className="ctm-card__photo ctm-card__photo--icon">
        <img src={googleIcon} alt="Google review" />
      </span>
    );
  }
  const letters = initials(t.name);
  return letters ? (
    <span className="ctm-card__photo" aria-hidden="true">
      {letters}
    </span>
  ) : null;
}

// The Buy box's cover: the picture, or, for a cover video, the picture
// with a ▶ that plays it right there (with its controls, no autoplay
// until it's clicked). An uploaded video can't play in the prototype,
// which keeps only its name.
function CoverMedia({ course }) {
  const video = coverVideoOf(course);
  const [playing, setPlaying] = useState(false);
  if (!video) return <CoverArt course={course} />;

  if (playing && video.kind === 'embed') {
    const v = readVideoLink(video.url);
    const src = `${v.embedUrl}${v.embedUrl.includes('?') ? '&' : '?'}autoplay=1`;
    return (
      <div className="cld__cover-frame">
        <iframe
          src={src}
          title={`${course.title}: intro video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (playing) {
    return (
      <div className="cld__cover-frame cld__cover-standin">
        <strong>{video.name}</strong>
        <span>The prototype keeps only the video’s name, so it can’t play here yet.</span>
      </div>
    );
  }
  return (
    <button type="button" className="cld__cover-btn" onClick={() => setPlaying(true)} aria-label={`Play the intro video: ${course.title}`}>
      <CoverArt course={course} play />
    </button>
  );
}