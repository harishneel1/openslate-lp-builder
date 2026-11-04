import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Link2, Pencil, Users, Video } from 'lucide-react';
import GuestInitials from '../components/GuestInitials';
import { useCopy } from './OfferingsHome';
import {
  classDay,
  classMeetingHref,
  classState,
  classTime,
  dayOn,
  feeLine,
  nextClasses,
  scheduleLine,
} from '../data/batches';
import { membersOf, onMembersChange, shortDate } from '../data/batchMembers';
import './OfferingsHome.css';
import './CallOverview.css'; // the same head and tabs as a 1:1 call's page
import './BookingsPage.css'; // initials (.bk-face)
import './BatchOverview.css';

// ------------------------------------------------------------
// One batch's own page, opened from its row on Live classes.
//
//   [focus bar:  ← All batches ]   (App.jsx, from LiveClassesPage)
//   Morning Yoga                        [Copy link] [Edit] [↗ View live page]
//   Mon–Sat · 6:30–7:30 am · ₹2,000/month
//
//   Members 18 | Classes
//
//   Members: everyone holding the batch's contract, newest first
//     (RK) Ravi Kumar       Joined 14 Nov    Renews 14 Dec    [Paid]   ▾
//          (opened) email, phone, and their answers to the questions
//
//   Classes: the next class, with Start class (the mock Zoom room, in a
//   new tab), then the ones after it
//     ┌ Next class · Tomorrow, 6:30 am             [▶ Start class] ┐
//     Wed 18 Nov   6:30 am      ...
//
// Round 1: everyone is Paid (renewals come in round 2), and every class
// in the schedule happens (holidays come in round 3). Students see their
// classes in their own feed, so there's no link to send here.
//
// batch: the batch (data/batches.js)
// url: its link to share
// tab: 'members' | 'classes'; onTab(tab)
// onEdit(): its editor
// ------------------------------------------------------------

const TICK_MS = 30_000; // the clock, for which class is next or on now
const CLASSES_SHOWN = 12;

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'classes', label: 'Classes' },
];

export default function BatchOverview({ batch, url, tab, onTab, onEdit }) {
  const [members, setMembers] = useState(() => membersOf(batch.id));
  const [now, setNow] = useState(() => Date.now());
  const [openId, setOpenId] = useState(null);
  const [copy, copyLink] = useCopy();

  // Someone joining on the batch's page (another tab) shows up here
  useEffect(() => onMembersChange(() => setMembers(membersOf(batch.id))), [batch.id]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.title = batch.title;
  }, [batch.title]);

  const classes = useMemo(() => nextClasses(batch, now, CLASSES_SHOWN), [batch, now]);
  const today = dayOn(now, batch);

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = TABS.find((t) => t.id !== tab).id;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`bov-tab-${next}`)?.focus());
  };

  return (
    <div className="oh cov bov">
      <header className="cov__head">
        <div className="cov__intro">
          <div className="cov__about">
            <h1 className="cov__title">{batch.title}</h1>
            <p className="cov__detail">
              {scheduleLine(batch)} · <span className="oh-row__price">{feeLine(batch)}</span>
            </p>
          </div>

          <div className="cov__actions">
            <button type="button" className="oh-card__copy" onClick={() => copyLink(url)}>
              {copy === 'copied' ? (
                <Check size={16} strokeWidth={3} aria-hidden="true" />
              ) : (
                <Link2 size={16} aria-hidden="true" />
              )}
              {copy === 'copied' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="oh__edit" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
            <a
              className="oh__edit cov__live"
              href={url}
              target="_blank"
              rel="noopener"
              aria-label="View live page (opens in a new tab)"
            >
              <ExternalLink size={15} aria-hidden="true" /> View live page
            </a>
          </div>
        </div>
        <span className="oh__sr-only" aria-live="polite">
          {copy === 'copied' && 'Link copied'}
        </span>
        {copy === 'failed' && (
          <p className="oh__copy-error cov__copy-error" role="alert">
            Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
          </p>
        )}
      </header>

      <section className="oh__panel cov__panel">
        {/* The tabs sit in the panel's head, their underline on its bottom line, as on a 1:1 call's page */}
        <div className="oh__panel-head cov__panel-head">
          <div className="cov__tabs" role="tablist" aria-label="Batch" onKeyDown={onKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`bov-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`bov-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className="cov__tab"
                onClick={() => onTab(t.id)}
              >
                {t.label}
                {t.id === 'members' && members.length > 0 && <span className="oh__count">{members.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {tab === 'members' ? (
          <div id="bov-panel-members" role="tabpanel" aria-labelledby="bov-tab-members" className="bov__body">
            {members.length === 0 ? (
              <div className="bov__empty">
                <span className="bov__empty-icon" aria-hidden="true">
                  <Users size={22} />
                </span>
                <h2 className="bov__empty-title">Nobody has joined yet</h2>
                <p className="bov__empty-text">
                  Share your batch’s link. Everyone who pays shows here, with when they renew.
                </p>
                <button type="button" className="oh-card__copy" onClick={() => copyLink(url)}>
                  <Link2 size={16} aria-hidden="true" /> {copy === 'copied' ? 'Copied' : 'Copy link'}
                </button>
              </div>
            ) : (
              <ul className="bov__members">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    open={openId === m.id}
                    onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div id="bov-panel-classes" role="tabpanel" aria-labelledby="bov-tab-classes" className="bov__body">
            {classes.length === 0 ? (
              <p className="bov__empty-text">This batch has no days set. Edit it to pick the days it meets.</p>
            ) : (
              <>
                <NextClass batch={batch} c={classes[0]} today={today} now={now} />
                <h2 className="bov__subhead">After that</h2>
                <ul className="bov__classes">
                  {classes.slice(1).map((c) => (
                    <li key={c.start} className="bov__class">
                      <span className="bov__class-day">{classDay(c.date, today)}</span>
                      <span className="bov__class-time">{classTime(c, batch)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// One member: who, when they joined and renew, and Paid. Opens to their
// contact details and answers.
function MemberRow({ member: m, open, onToggle }) {
  const phone = m.phone?.number ? `${m.phone.code ?? ''} ${m.phone.number}`.trim() : null;
  const answers = (m.answers ?? []).filter((a) => a.question);
  return (
    <li className={`bov__member ${open ? 'bov__member--open' : ''}`}>
      <button type="button" className="bov__member-row" aria-expanded={open} onClick={onToggle}>
        <GuestInitials name={m.name} />
        <span className="bov__member-name">{m.name || 'Member'}</span>
        <span className="bov__member-date">{m.joinedOn ? `Joined ${shortDate(m.joinedOn)}` : ''}</span>
        <span className="bov__member-date">{m.renewsOn ? `Renews ${shortDate(m.renewsOn)}` : ''}</span>
        <span className="bov__paid">Paid</span>
        <ChevronDown size={16} className="bov__chevron" aria-hidden="true" />
      </button>
      {open && (
        <dl className="bov__details">
          <div>
            <dt>Email</dt>
            <dd>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{phone ?? '—'}</dd>
          </div>
          {answers.map((a) => (
            <div key={a.question} className="bov__answer">
              <dt>{a.question}</dt>
              <dd>{a.answer || <span className="bov__none">Not answered</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

// The next class (or the one on now), with Start class
function NextClass({ batch, c, today, now }) {
  const state = classState(c, now);
  const live = state === 'live';
  return (
    <div className={`bov__next ${state !== 'later' ? 'bov__next--now' : ''}`}>
      <span className="bov__next-text">
        <span className="bov__next-label">{live ? 'Happening now' : 'Next class'}</span>
        <span className="bov__next-when">
          {classDay(c.date, today)}, {classTime(c, batch)}
        </span>
      </span>
      <a className="bov__start" href={classMeetingHref(batch.id)} target="_blank" rel="noopener">
        <Video size={16} aria-hidden="true" /> {live ? 'Rejoin class' : 'Start class'}
      </a>
    </div>
  );
}