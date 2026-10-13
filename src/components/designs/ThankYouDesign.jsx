import { useEffect, useMemo } from 'react';
import { CalendarDays, Check, MessageCircle, Send } from 'lucide-react';
import { buildPageJson } from '../../data/buildPageJson';
import { loadThemeFont } from '../../data/themes';
import { GROUP_OPTIONS, groupLinkMissing } from '../../data/thankYouQuestions';
import './SimpleDesign.css'; // .sd base: theme font, colours and container sizing
import './ThankYouDesign.css';

// The thank you page, in the same theme as their landing page.
// Renders from their answers: webinar title and time (landing page)
// and the group they picked (thank you questions).
// TEMPORARY: a simple layout until the real thank you designs exist.

// Theme tokens → CSS variables, same as SimpleDesign: { accent: '#f4b223' } → { '--sd-accent': '#f4b223' }
const themeStyle = (theme) =>
  Object.fromEntries(Object.entries(theme.tokens).map(([key, value]) => [`--sd-${key}`, value]));

// Links can be saved without https:// (e.g. chat.whatsapp.com/…)
const withHttps = (link) => {
  const clean = String(link ?? '').trim();
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
};

const GROUPS = {
  [GROUP_OPTIONS.whatsapp]: { app: 'WhatsApp', icon: MessageCircle },
  [GROUP_OPTIONS.telegram]: { app: 'Telegram', icon: Send },
};

export default function ThankYouDesign({ answers, theme }) {
  useEffect(() => {
    loadThemeFont(theme);
  }, [theme]);

  const page = useMemo(() => buildPageJson(answers, theme.id), [answers, theme.id]);
  // No working group link yet ("I'll add it later"): the page can still go live,
  // so visitors get the email version instead of a button that goes nowhere.
  // Once they add the link, the group version shows up straight away.
  const group = groupLinkMissing(answers) ? null : GROUPS[answers.groupApp] ?? null;

  const nextSteps = group
    ? [
        `Join the ${group.app} group. The webinar link is shared there.`,
        'Add the date to your calendar so you don\u2019t miss it.',
        'Join a few minutes early on the day.',
      ]
    : [
        'Look out for an email with the webinar link.',
        'Add the date to your calendar so you don\u2019t miss it.',
        'Join a few minutes early on the day.',
      ];

  return (
    <div className="sd ty" style={themeStyle(theme)}>
      <header className="ty__hero">
        <span className="ty__check" aria-hidden="true">
          <Check size={28} strokeWidth={3} />
        </span>
        <h1 className="ty__title">You're in!</h1>
        {page.hero.title && (
          <p className="ty__sub">
            You've signed up for <strong>{page.hero.title}</strong>
          </p>
        )}
        {page.event.label && (
          <p className="ty__when">
            <CalendarDays size={18} aria-hidden="true" /> {page.event.label}
          </p>
        )}
      </header>

      <main className="ty__body">
        {group ? (
          <section className="ty__card ty__card--main">
            <h2 className="ty__card-title">One last step</h2>
            <p className="ty__card-text">
              Join our {group.app} group to get the webinar link and reminders.
            </p>
            <a className="ty__button" href={withHttps(answers.groupLink)} target="_blank" rel="noopener">
              <group.icon size={18} aria-hidden="true" /> Join the {group.app} group
            </a>
          </section>
        ) : (
          <section className="ty__card ty__card--main">
            <h2 className="ty__card-title">Check your inbox</h2>
            <p className="ty__card-text">We'll email you the webinar link before it starts.</p>
          </section>
        )}

        <section className="ty__card">
          <h2 className="ty__card-title">What happens next</h2>
          <ol className="ty__steps">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}