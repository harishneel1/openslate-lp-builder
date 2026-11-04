import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarOff,
  CalendarX,
  Check,
  Copy,
  ExternalLink,
  IndianRupee,
  Link2,
  MessageCircle,
  Pencil,
  Search,
  UserCheck,
  UserX,
  Users,
  Video,
  X,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import RowMenu from '../components/RowMenu';
import MemberDrawer from '../components/MemberDrawer';
import PrototypeControls from '../components/PrototypeControls';
import { useCopy } from './OfferingsHome';
import {
  classDay,
  classMeetingHref,
  classState,
  classTime,
  classesInRange,
  dayOn,
  offOn,
  saveBatchDaysOff,
  upcomingBreaks,
  feeLine,
  nextClasses,
  scheduleLine,
} from '../data/batches';
import {
  GRACE_DAYS,
  NEEDS_ACTION,
  membersOf,
  nextRenewal,
  noteRejoinLink,
  noteReminder,
  onMembersChange,
  payRenewal,
  removeMember,
  restoreMember,
  shortDate,
  statusWords,
  undoMarkedPayment,
} from '../data/batchMembers';
import { batchPayHref, rejoinHref, reminderHref } from '../data/renewalMessage';
import { formatMoney } from '../data/contractPricing';
import { rangeLine } from '../data/batchNotices';
import DaysOffDrawer from '../components/DaysOffDrawer';
import { appNow, onTestDateChange } from '../utils/testClock';
import { todayIn, weekdayOf } from '../utils/slots';
import './OfferingsHome.css';
import './CallOverview.css'; // the same head and tabs as a 1:1 call's page
import './BookingsPage.css'; // initials and buttons (.bk-face, .bk-btn)
import './BatchOverview.css';

// ------------------------------------------------------------
// One batch's own page, opened from its row on Live classes.
//
//   [focus bar:  ← All batches ]   (App.jsx, from LiveClassesPage)
//   Morning Yoga                        [Copy link] [Edit] [↗ View live page]
//   Mon–Sat · 6:30–7:30 am · ₹2,000/month
//
//   Classes | Members 18
//
// Members: a row of tabs with every count, so the state of the batch is
// clear at the top without scrolling, and a line under them saying what
// the open one is. It opens on Pending payments when anyone is in it.
//
//   [Pending payments 3]  Paid 14  Removed 1  All 18
//   Not paid yet, or due in the next 3 days. Remind them on WhatsApp, or
//   mark them paid if they paid you in cash or UPI.
//   ⚠ Ravi hasn't paid for over 5 days. …
//   Ravi Kumar                         8 days late  [Payment pending]  [💬 Remind] ⋯
//   ravi@… · +91 98765 43210
//
// The same kind of filter row as a 1:1 call's page (Upcoming, Past,
// Cancelled), with plain names.
//
// Rows are a webinar's "Manage people" rows: name with how to reach
// them, what's happening on the right, and ⋯ for the rest. A click on a
// row opens the member's panel (MemberDrawer.jsx), as a booking opens
// from a 1:1 call. Search shows once there are more than 5 people.
//
// Nothing happens on its own. Remind opens WhatsApp with a message and
// the batch's own link ready (renewalMessage.js), since every payment
// happens on the batch's page; Mark as paid is for cash or
// UPI paid to the coach directly; Remove ends their hold on the contract,
// so the classes leave their feed; Restore is for someone who paid again.
//
// Classes (the first tab): Breaks, picked on the 1:1 calls' Days off
// panel (DaysOffDrawer.jsx) with nothing sent (the coach tells members in
// class); the next class with Start class (the mock Zoom room) and Cancel
// this class; then what's coming up, each with ⋯ Cancel this class, or
// marked Cancelled / Break. Cancelling goes to the cancel page
// (BatchAnnounce.jsx, through onAnnounce), where members are told.
//
// At the bottom, Prototype controls (PrototypeControls.jsx): sample
// members in every situation, and a pretend date. The date is appNow()
// (utils/testClock.js) everywhere on this page.
//
// batch: the batch (data/batches.js)
// url: its link to share
// tab: 'members' | 'classes'; onTab(tab)
// onEdit(): its editor
// onAnnounce(change): cancel a class ({ kind: 'cancel', date }): the cancel page
// classNotice: a line to show on Classes after one ("Class cancelled…")
// ------------------------------------------------------------

const TICK_MS = 30_000; // the clock, for which class is next or on now
const CLASSES_SHOWN = 14; // breaks and cancelled ones included, so a few more
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SEARCH_FROM = 5; // search shows past this many people, as on a webinar

const TABS = [
  { id: 'classes', label: 'Classes' },
  { id: 'members', label: 'Members' },
];

// Who needs the coach first: the latest at the top
const URGENCY = { 'past-grace': 0, overdue: 1, today: 2, soon: 3, paid: 4, removed: 5 };

// The tabs over the members: what each holds, and the line under the
// open one, written the way the coach would say it (short sentences,
// everyday words: no "grace", "renew" or "overdue")
const VIEWS = [
  {
    id: 'pending',
    title: 'Pending payments',
    sub:
      'These people haven’t paid for this month yet, or their payment is due in the next 3 days. ' +
      'Send them a reminder on WhatsApp. If someone has already paid you by cash or UPI, mark them as paid.',
    has: (m) => NEEDS_ACTION.includes(m.status),
    empty: 'Everyone has paid. People show up here 3 days before their next payment.',
  },
  {
    id: 'paid',
    title: 'Paid',
    sub: 'These people have paid for this month. Nothing to do here.',
    has: (m) => m.status === 'paid',
    empty: 'Nobody here yet. People show up here once they’ve paid for this month.',
  },
  {
    id: 'removed',
    title: 'Removed',
    sub:
      'These people are no longer in this batch, so they can’t join your classes. ' +
      'If someone wants to come back, send them their payment link. Once they pay, they come back automatically.',
    has: (m) => m.status === 'removed',
    empty: 'Nobody has been removed.',
  },
  {
    id: 'all',
    title: 'All',
    sub: 'Everyone who has joined this batch.',
    has: () => true,
    empty: 'Nobody has joined yet.',
  },
];

// The colour of each tab's count, so the batch's state reads at a glance:
// pending is orange (red once someone is over 5 days late), paid green,
// removed grey
const countTone = (id, count, late) =>
  id === 'pending' ? (count === 0 ? 'none' : late > 0 ? 'late' : 'pending') : id === 'all' ? 'none' : id;

const matches = (m, q) => {
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    m.name.toLowerCase().includes(q) ||
    String(m.email ?? '').toLowerCase().includes(q) ||
    (digits.length > 2 && String(m.phone?.number ?? '').replace(/\D/g, '').includes(digits))
  );
};

export default function BatchOverview({ batch, url, tab, onTab, onEdit, onAnnounce, classNotice = null }) {
  const [version, setVersion] = useState(0); // bumped when members change
  const [now, setNow] = useState(appNow);
  const [query, setQuery] = useState('');
  // The open tab: Pending payments when anyone is in it, else Paid
  const [view, setView] = useState(() =>
    membersOf(batch, appNow()).some((m) => NEEDS_ACTION.includes(m.status)) ? 'pending' : 'paid',
  );
  const [openId, setOpenId] = useState(null); // the member in the panel
  const [menuFor, setMenuFor] = useState(null); // the row whose ⋯ is open
  const [asking, setAsking] = useState(null); // { kind: 'paid' | 'remove' | 'restore', member }
  const [notice, setNotice] = useState(null); // { text, undo?: memberId }
  const [copy, copyLink] = useCopy();
  const [payCopy, copyPayLink] = useCopy();

  const refresh = () => {
    setNow(appNow());
    setVersion((v) => v + 1);
  };

  // Someone joining or paying their renewal (another tab), or the pretend date changing
  useEffect(() => onMembersChange(() => setVersion((v) => v + 1)), []);
  useEffect(() => onTestDateChange(() => setNow(appNow())), []);
  useEffect(() => {
    const id = setInterval(() => setNow(appNow()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.title = batch.title;
  }, [batch.title]);

  const members = useMemo(
    () =>
      membersOf(batch, now).sort(
        (a, b) => URGENCY[a.status] - URGENCY[b.status] || String(a.renewsOn).localeCompare(String(b.renewsOn)),
      ),
    [batch, now, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const q = query.trim().toLowerCase();
  const found = members.filter((m) => matches(m, q));
  const activeCount = members.filter((m) => m.status !== 'removed').length;
  const late = members.filter((m) => m.status === 'past-grace');
  const opened = members.find((m) => m.id === openId) ?? null;
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const shown = found.filter(current.has);

  const classes = useMemo(() => nextClasses(batch, now, CLASSES_SHOWN, { includeOff: true }), [batch, now]);
  const nextOn = classes.find((c) => !c.off) ?? null;
  const breaks = upcomingBreaks(batch, dayOn(now, batch));
  const [addingBreak, setAddingBreak] = useState(false);
  const today = dayOn(now, batch);

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = TABS.find((t) => t.id !== tab).id;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`bov-tab-${next}`)?.focus());
  };

  // ---------- What the coach does ----------
  const ask = (kind, member) => {
    setMenuFor(null);
    setAsking({ kind, member });
  };

  const reminded = (m) => {
    noteReminder(m.id, batch, now);
    setVersion((v) => v + 1);
  };

  const copyPay = (m) => {
    setMenuFor(null);
    copyPayLink(batchPayHref(batch));
    const first = m.name.split(/\s+/)[0];
    setNotice({
      text: m.email
        ? `The batch’s payment link is copied. Ask ${first} to pay with ${m.email}, so it counts for ${first}.`
        : `The batch’s payment link is copied. Paste it anywhere to send it to ${first}.`,
    });
  };

  // A removed member's payment link, sent on WhatsApp to come back
  const sentRejoin = (m) => {
    noteRejoinLink(m.id, batch, now);
    setVersion((v) => v + 1);
  };

  const confirm = () => {
    const { kind, member } = asking;
    const first = member.name.split(/\s+/)[0] || 'They';
    setAsking(null);
    if (kind === 'paid') {
      const after = payRenewal(member.id, batch, 'marked', now);
      if (after) setNotice({ text: `${first} is paid until ${shortDate(after.renewsOn)}.`, undo: member.id });
    } else if (kind === 'remove') {
      if (removeMember(member.id, batch, now)) {
        setNotice({ text: `${first} is removed. You’ll find them under Removed.` });
      }
    } else if (kind === 'restore') {
      const after = restoreMember(member.id, batch, now);
      if (after) setNotice({ text: `${first} is back in ${batch.title}, paid until ${shortDate(after.renewsOn)}.` });
    }
    setVersion((v) => v + 1);
  };

  const undo = (memberId) => {
    undoMarkedPayment(memberId, batch, now);
    setNotice(null);
    setVersion((v) => v + 1);
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
              {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              {copy === 'copied' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="oh__edit" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
            <a className="oh__edit cov__live" href={url} target="_blank" rel="noopener" aria-label="View live page (opens in a new tab)">
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
                {t.id === 'members' && activeCount > 0 && <span className="oh__count">{activeCount}</span>}
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
                <p className="bov__empty-text">Share your batch’s link. Everyone who pays shows here, with when they pay next.</p>
                <button type="button" className="oh-card__copy" onClick={() => copyLink(url)}>
                  <Link2 size={16} aria-hidden="true" /> {copy === 'copied' ? 'Copied' : 'Copy link'}
                </button>
              </div>
            ) : (
              <>
                <div className="cov__filters bov__views" role="group" aria-label="Show">
                  {VIEWS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="cov__filter"
                      aria-pressed={view === v.id}
                      onClick={() => {
                        setView(v.id);
                        setMenuFor(null);
                      }}
                    >
                      {v.title}{' '}
                      <span className={`cov__filter-count bov__count bov__count--${countTone(v.id, found.filter(v.has).length, late.length)}`}>
                        {found.filter(v.has).length}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="bov__view-sub">{current.sub}</p>

                {members.length > SEARCH_FROM && (
                  <label className="bov__search">
                    <Search size={16} aria-hidden="true" />
                    <span className="oh__sr-only">Search members</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, email or phone"
                    />
                  </label>
                )}

                {notice && (
                  <p className="bov__notice" role="status">
                    <Check size={16} strokeWidth={3} aria-hidden="true" /> {notice.text}
                    {notice.undo && (
                      <button type="button" className="bov__undo" onClick={() => undo(notice.undo)}>
                        Undo
                      </button>
                    )}
                    <button type="button" className="bov__notice-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </p>
                )}


                {(view === 'pending' || view === 'all') && late.length > 0 && (
                  <div className="bov__alert" role="status">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <p>
                      {late.length === 1
                        ? `${late[0].name.split(/\s+/)[0]} hasn’t paid for ${late[0].daysLate} days. Remove them from the batch, or mark them as paid if they paid you by cash or UPI.`
                        : `${late.length} people haven’t paid for more than ${GRACE_DAYS} days. Remove them from the batch, or mark them as paid if they paid you by cash or UPI.`}
                    </p>
                  </div>
                )}

                {shown.length > 0 ? (
                  <ul className="bov-people">
                    {shown.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        batch={batch}
                        menuOpen={menuFor === m.id}
                        onMenu={(open) => setMenuFor(open ? m.id : null)}
                        onOpen={() => setOpenId(m.id)}
                        onReminded={() => reminded(m)}
                        onAsk={(kind) => ask(kind, m)}
                        onCopyLink={() => copyPay(m)}
                        onSentRejoin={() => sentRejoin(m)}
                        showPill={view !== 'pending'}
                      />
                    ))}
                  </ul>
                ) : q ? (
                  <div className="bov__no-match">
                    <p>No one here matches “{query.trim()}”</p>
                    <button type="button" className="oh__edit" onClick={() => setQuery('')}>
                      <X size={15} aria-hidden="true" /> Clear search
                    </button>
                  </div>
                ) : (
                  <p className="bov__view-empty">{current.empty}</p>
                )}
                <span className="oh__sr-only" aria-live="polite">
                  {payCopy === 'failed' && 'Couldn’t copy the payment link'}
                </span>
              </>
            )}
          </div>
        ) : (
          <div id="bov-panel-classes" role="tabpanel" aria-labelledby="bov-tab-classes" className="bov__body">
            {classNotice && (
              <p className="bov__notice" role="status">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> {classNotice}
              </p>
            )}

            {/* Breaks: like Days off on the 1:1 calls page, and the same panel */}
            <div className="bov__breaks">
              <span className="bov__breaks-label">Breaks</span>
              <div className="bov__breaks-value">
                {breaks.length === 0 ? (
                  <span className="bov__muted">None coming up</span>
                ) : (
                  <span className="bov__break-list">
                    {breaks.map((x, i) => (
                      <span key={x.from} className="bov__break">
                        <span className="bov__break-dates">{rangeLine(x.from, x.to)}</span>
                        <span className="bov__muted">
                          {' '}
                          ({plural(classesInRange(batch, x.from, x.to).length, 'class', 'classes')})
                        </span>
                        {i < breaks.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <button type="button" className="oh__edit" onClick={() => setAddingBreak(true)}>
                <CalendarOff size={15} aria-hidden="true" /> {breaks.length === 0 ? 'Add a break' : 'Manage'}
              </button>
            </div>

            {classes.length === 0 ? (
              <p className="bov__empty-text">This batch has no days set. Edit it to pick the days it meets.</p>
            ) : (
              <>
                {nextOn ? (
                  <NextClass batch={batch} c={nextOn} today={today} now={now} onCancel={() => onAnnounce({ kind: 'cancel', date: nextOn.date })} />
                ) : (
                  <p className="bov__empty-text">No classes coming up in the next few weeks.</p>
                )}
                <h2 className="bov__subhead">Coming up</h2>
                <ul className="bov__classes">
                  {classes
                    .filter((c) => c !== nextOn)
                    .map((c) => (
                      <ClassRow
                        key={c.start}
                        c={c}
                        batch={batch}
                        today={today}
                        menuOpen={menuFor === `class-${c.date}`}
                        onMenu={(open) => setMenuFor(open ? `class-${c.date}` : null)}
                        onCancel={() => {
                          setMenuFor(null);
                          onAnnounce({ kind: 'cancel', date: c.date });
                        }}
                      />
                    ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {/* The 1:1 calls' Days off panel, for this batch: tap the days off */}
      {addingBreak && (
        <DaysOffDrawer
          value={Object.fromEntries((batch.daysOff ?? []).map((d) => [d, []]))}
          zone={batch.timeZone}
          words={{
            title: 'Breaks',
            sub: `Tap the days you’re away. There’s no ${batch.title} class on them, and the time opens up for 1:1 calls.`,
            listTitle: 'No classes on',
            empty: 'No breaks coming up. Tap a day on the calendar to add one.',
            save: 'Save breaks',
            offKey: 'No class',
            unsaved: 'Your breaks aren’t saved.',
          }}
          // Only days the batch meets, and not a class that's already cancelled
          canTap={(d) => batch.days.includes(weekdayOf(d)) && offOn(batch, d)?.kind !== 'cancelled'}
          countOf={(range) => plural(classesInRange(batch, range.from, range.to).length, 'class', 'classes')}
          bookings={false}
          onSave={(clean) => saveBatchDaysOff(batch, Object.keys(clean))}
          onSaved={() => setAddingBreak(false)}
          onClose={() => setAddingBreak(false)}
        />
      )}

      <PrototypeControls batch={batch} onChange={refresh} />

      {opened && (
        <MemberDrawer
          member={opened}
          batch={batch}
          onClose={() => setOpenId(null)}
          onReminded={() => reminded(opened)}
          onAsk={(kind) => ask(kind, opened)}
          onCopyLink={() => copyPay(opened)}
          onSentRejoin={() => sentRejoin(opened)}
        />
      )}

      {asking && <AskDialog asking={asking} batch={batch} now={now} onCancel={() => setAsking(null)} onConfirm={confirm} />}
    </div>
  );
}

// ---------- One member: a webinar's "Manage people" row ----------
// Name and how to reach them; on the right, their date (and status, except
// on Pending payments, where every row would say the same), the WhatsApp
// action that fits, and ⋯ for the rest. A click on the row (or the name)
// opens their panel.
//   pending or due soon → Remind (their payment link, as a reminder)
//   removed             → Send payment link (to come back; paying brings them back)
function MemberRow({ member: m, batch, menuOpen, onMenu, onOpen, onReminded, onAsk, onCopyLink, onSentRejoin, showPill = true }) {
  const words = statusWords(m, batch.timeZone);
  const needs = NEEDS_ACTION.includes(m.status);
  const removed = m.status === 'removed';
  const chat = needs ? reminderHref(m, batch) : removed ? rejoinHref(m, batch) : null;
  const phone = m.phone?.number ? `${m.phone.code ?? ''} ${m.phone.number}`.trim() : null;
  const zone = batch.timeZone;

  const items = removed
    ? [
        { label: 'Copy payment link', icon: Copy, onSelect: onCopyLink },
        { label: 'Paid by cash or UPI? Restore', icon: UserCheck, onSelect: () => onAsk('restore') },
      ]
    : [
        ...(needs ? [{ label: 'Mark as paid (cash or UPI)', icon: IndianRupee, onSelect: () => onAsk('paid') }] : []),
        { label: 'Copy payment link', icon: Copy, onSelect: onCopyLink },
        { label: 'Remove from batch', icon: UserX, danger: true, onSelect: () => onAsk('remove') },
      ];

  // Under their date: when the coach last sent them something
  const sent = needs && m.lastReminder
    ? `Reminded ${shortDate(todayIn(zone, m.lastReminder.at))}`
    : removed && m.lastRejoinLink
      ? `Link sent ${shortDate(todayIn(zone, m.lastRejoinLink.at))}`
      : null;

  return (
    <li
      className={`bov-person ${removed ? 'bov-person--removed' : ''} ${menuOpen ? 'bov-person--menu' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button, a, [role="menu"], [role="dialog"]')) return;
        onOpen();
      }}
    >
      <div className="bov-person__text">
        <p className="bov-person__name">
          <button type="button" className="bov-person__open" onClick={onOpen}>
            {m.name || 'Member'}
          </button>
        </p>
        <p className="bov-person__contact">
          {m.email}
          {phone && <span> · {phone}</span>}
        </p>
      </div>

      <div className="bov-person__side">
        <span className={`bov-person__when bov-person__when--${words.tone}`}>
          {words.detail}
          {sent && <span className="bov-person__reminded">{sent}</span>}
        </span>
        {showPill && <span className={`bov__pill bov__pill--${words.tone}`}>{words.pill}</span>}
      </div>

      <div className="bov-person__act">
        {(needs || removed) &&
          (chat ? (
            <a
              className="bov__remind"
              href={chat}
              target="_blank"
              rel="noopener noreferrer"
              onClick={removed ? onSentRejoin : onReminded}
            >
              <MessageCircle size={15} aria-hidden="true" /> {removed ? 'Send payment link' : 'Remind'}
              <span className="oh__sr-only"> {m.name} on WhatsApp</span>
            </a>
          ) : (
            <span className="bov__no-phone">No phone</span>
          ))}
      </div>

      <RowMenu title={m.name} open={menuOpen} onOpenChange={onMenu} items={items} />
    </li>
  );
}

// "Mark as paid?", "Remove?" and "Restore?": what will happen, in a line
function AskDialog({ asking, batch, now, onCancel, onConfirm }) {
  const { kind, member: m } = asking;
  const first = m.name.split(/\s+/)[0] || 'them';
  const fee = formatMoney(batch.price, 'INR');
  if (kind === 'paid') {
    const until = nextRenewal(m.renewsOn, m.payDay);
    return (
      <ConfirmDialog title={`Mark ${first} as paid?`} confirmLabel={`Yes, ${first} paid ${fee}`} onCancel={onCancel} onConfirm={onConfirm}>
        <p>
          Only do this if {first} has paid you {fee} by cash or UPI. It counts for {shortDate(m.renewsOn)} –{' '}
          {shortDate(until)}, and their next payment is on {shortDate(until)}.
        </p>
      </ConfirmDialog>
    );
  }
  if (kind === 'remove') {
    return (
      <ConfirmDialog title={`Remove ${first} from ${batch.title}?`} confirmLabel="Remove" danger onCancel={onCancel} onConfirm={onConfirm}>
        <p>
          They won’t be able to join this batch’s classes. Their details and payments are kept. If they want to come back
          later, send them their payment link.
        </p>
      </ConfirmDialog>
    );
  }
  const today = todayIn(batch.timeZone, now);
  return (
    <ConfirmDialog title={`Restore ${first}?`} confirmLabel={`Yes, ${first} paid ${fee}`} onCancel={onCancel} onConfirm={onConfirm}>
      <p>
        Only do this if {first} has paid you {fee} by cash or UPI. Their new month starts today: {shortDate(today)} –{' '}
        {shortDate(nextRenewal(today))}. If they haven’t paid yet, send them their payment link instead. Paying it brings
        them back automatically.
      </p>
    </ConfirmDialog>
  );
}

// The next class that happens (or the one on now), with Start class,
// and Cancel this class until it starts
function NextClass({ batch, c, today, now, onCancel }) {
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
      <span className="bov__next-actions">
        {!live && (
          <button type="button" className="bov__link-btn" onClick={onCancel}>
            Cancel this class
          </button>
        )}
        <a className="bov__start" href={classMeetingHref(batch.id)} target="_blank" rel="noopener">
          <Video size={16} aria-hidden="true" /> {live ? 'Rejoin class' : 'Start class'}
        </a>
      </span>
    </div>
  );
}

// One class in "Coming up": its day and time, and either what's happening
// to it (Cancelled, Break) or ⋯ with Cancel this class
function ClassRow({ c, batch, today, menuOpen, onMenu, onCancel }) {
  const off = c.off;
  return (
    <li className={`bov__class ${off ? 'bov__class--off' : ''}`}>
      <span className="bov__class-day">{classDay(c.date, today)}</span>
      <span className="bov__class-time">{classTime(c, batch)}</span>
      <span className="bov__class-state">
        {off?.kind === 'cancelled' && (
          <>
            <span className="bov__pill bov__pill--removed">Cancelled</span>
            {off.told?.email > 0 && <span className="bov__muted"> {plural(off.told.email, 'member')} told</span>}
          </>
        )}
        {off?.kind === 'break' && <span className="bov__pill bov__pill--soon">Break</span>}
      </span>
      <span className="bov__class-menu">
        {!off && (
          <RowMenu
            title={`${classDay(c.date, today)} class`}
            open={menuOpen}
            onOpenChange={onMenu}
            items={[{ label: 'Cancel this class', icon: CalendarX, danger: true, onSelect: onCancel }]}
          />
        )}
      </span>
    </li>
  );
}