import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CalendarPlus, CalendarX, Check, Download, MessageCircle, Pencil, Search, Users, Video, X } from 'lucide-react';
import RowMenu from '../components/RowMenu';
import PrototypeControls from '../components/PrototypeControls';
import GuestInitials from '../components/GuestInitials';
import ScheduleClassDialog from '../components/ScheduleClassDialog';
import { classDay, classMeetingHref, classState, classTimeRange, dayOn, nextClasses, pastClasses, scheduleLine } from '../data/batches';
import { onStudentsChange, studentsCsv, studentsOf } from '../data/classStudents';
import { whatsappHref } from '../utils/whatsapp';
import ReminderChannels from '../components/ReminderChannels';
import WhatsAppTab from '../components/WhatsAppTab';
import ClassEmails from './ClassEmails';
import { classReminderById, saveReminderOn } from '../data/classReminders';
import { classOffDefaults } from '../data/whatsappMessages';
import { appNow, onTestDateChange } from '../utils/testClock';
import './OfferingsHome.css';
import './CallOverview.css'; // the same head and tabs as a 1:1 call's page
import './BookingsPage.css'; // initials (.bk-face)
import './SalesPage.css'; // the search box (.tx-search), as on a course's Students
import './BatchOverview.css';

// ------------------------------------------------------------
// One class's own page, opened from its row on Live classes.
//
//   [focus bar:  ← All classes ]   (App.jsx, from LiveClassesPage)
//   Morning Yoga                                [Join as host] [Edit]
//   Next class Tue 24 Nov, 6:00–7:00 pm
//
//   Classes | Students 12 | Reminders
//
// Classes (the first tab): its classes, scheduled one by one, on the fly
// (+ Schedule a class, ScheduleClassDialog.jsx). The next one with Start
// class (the mock Zoom room) and Cancel this class; then what's coming
// up, each with ⋯ Change time or Cancel this class, or marked Cancelled;
// then the ones that are over. Cancelling goes to the cancel page
// (BatchAnnounce.jsx, through onAnnounce), where students are told.
//
// Students: everyone who bought any of the class's linked contracts, one
// row each (classStudents.js), newest first. Someone on two contracts
// shows once, with a chip for each. A slim bar above: how many, search
// and the contract filter (past 5 people), and Export CSV.
//
//   [🔍 Name, email or phone]  [All contracts ▾]          [⤓ Export CSV]
//   (PS) Priya Sharma              [Yoga monthly] [Yoga 6 months]  12 Nov 2026  💬
//        priya@example.com · +91 98765 43210
//
// 💬 opens a WhatsApp chat with them. Nothing here changes who's in: that
// follows the contracts (buying one adds them; a refund or cancelled
// booking takes them out). Export downloads what's shown, as a CSV.
//
// Reminders: the same Email | WhatsApp switch as a 1:1 call's page
// (ReminderChannels.jsx). Email: the welcome and the reminders before each
// class (ClassEmails.jsx), with switches that save straight away and a
// pencil that opens the email editor (onEditEmail). WhatsApp: the same
// list as a call's or webinar's (WhatsAppTab.jsx, kind 'class').
//
// At the bottom, Prototype controls (PrototypeControls.jsx): sample
// students, a pretend date, and class shortcuts.
//
// batch: the class (data/batches.js)
// tab: 'classes' | 'students' | 'emails' (Reminders, on Email) | 'whatsapp'
//   (Reminders, on WhatsApp); onTab(tab)
// onEditEmail(id): open one of its emails in the editor
// onOpenContracts(): to the Contracts page, where contracts are shared
// onEdit(): its editor
// onAnnounce(change): cancel a class ({ kind: 'cancel', sessionId, date }): the cancel page
// classNotice: a line to show on Classes after one ("Class cancelled…")
// ------------------------------------------------------------

const TICK_MS = 30_000; // the clock, for which class is next or on now
const CLASSES_SHOWN = 30; // coming up, cancelled ones included
const PAST_SHOWN = 10;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SEARCH_FROM = 5; // search and the filter show past this many people

const TABS = [
  { id: 'classes', label: 'Classes' },
  { id: 'students', label: 'Students' },
  { id: 'emails', label: 'Reminders' },
];

const joinedDay = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const matches = (s, q) => {
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    s.name.toLowerCase().includes(q) ||
    s.email.toLowerCase().includes(q) ||
    (digits.length >= 3 && s.phone.replace(/\D/g, '').includes(digits))
  );
};

export default function BatchOverview({
  batch,
  tab,
  onTab,
  onEdit,
  onOpenContracts,
  onEditEmail,
  onAnnounce,
  classNotice = null,
}) {
  const [version, setVersion] = useState(0); // bumped when students change
  const [now, setNow] = useState(appNow);
  const [menuFor, setMenuFor] = useState(null); // the row whose ⋯ is open
  // Classes is the first tab: anything else from before (Members) opens it.
  // Reminders' WhatsApp half has its own id ('whatsapp'), shown as Reminders.
  const shownTab = tab === 'students' ? 'students' : tab === 'emails' || tab === 'whatsapp' ? 'emails' : 'classes';
  // The Schedule a class pop-up: { c: null } to schedule, { c } to change one's time
  const [scheduling, setScheduling] = useState(null);
  const [scheduled, setScheduled] = useState(null); // "Class scheduled for …"
  const [said, setSaid] = useState('');
  const toggleReminder = (id, on) => {
    if (saveReminderOn(batch, id, on)) setSaid(`${on ? 'Turned on' : 'Turned off'} the email ${classReminderById(id).name}.`);
  };

  // Someone buying a linked contract (another tab), samples, or the pretend date changing
  useEffect(() => onStudentsChange(() => setVersion((v) => v + 1)), []);
  useEffect(() => onTestDateChange(() => setNow(appNow())), []);
  useEffect(() => {
    const id = setInterval(() => setNow(appNow()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.title = batch.title;
  }, [batch.title]);

  const students = useMemo(() => studentsOf(batch), [batch, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const classes = useMemo(() => nextClasses(batch, now, CLASSES_SHOWN, { includeOff: true }), [batch, now]);
  const past = useMemo(() => pastClasses(batch, now).slice(0, PAST_SHOWN), [batch, now]);
  const nextOn = classes.find((c) => !c.off) ?? null;
  const today = dayOn(now, batch);
  const notice = scheduled ?? classNotice;

  const cancel = (c) => {
    setMenuFor(null);
    setScheduled(null);
    onAnnounce({ kind: 'cancel', sessionId: c.id, date: c.date });
  };
  const change = (c) => {
    setMenuFor(null);
    setScheduled(null);
    setScheduling({ c });
  };

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const at = TABS.findIndex((t) => t.id === shownTab);
    const next = TABS[(at + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`bov-tab-${next}`)?.focus());
  };

  return (
    <div className="oh cov bov">
      <header className="cov__head">
        <div className="cov__intro">
          <div className="cov__about">
            <h1 className="cov__title">{batch.title}</h1>
            <p className="cov__detail">{scheduleLine(batch, now)}</p>
          </div>

          <div className="cov__actions">
            {nextOn && (
            <a className="bov__join" href={classMeetingHref(batch.id)} target="_blank" rel="noopener" aria-label="Join as host (opens in a new tab)">
              <Video size={15} aria-hidden="true" /> Join as host
            </a>
            )}
            <button type="button" className="oh__edit" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </div>
        </div>
        <span className="oh__sr-only" aria-live="polite">
          {said}
        </span>
      </header>

      <section className="oh__panel cov__panel">
        {/* The tabs sit in the panel's head, their underline on its bottom line, as on a 1:1 call's page */}
        <div className="oh__panel-head cov__panel-head">
          <div className="cov__tabs" role="tablist" aria-label="Class" onKeyDown={onKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`bov-tab-${t.id}`}
                aria-selected={shownTab === t.id}
                aria-controls={`bov-panel-${t.id}`}
                tabIndex={shownTab === t.id ? 0 : -1}
                className="cov__tab"
                onClick={() => {
                  setScheduled(null);
                  onTab(t.id);
                }}
              >
                {t.label}
                {t.id === 'students' && students.length > 0 && <span className="oh__count">{students.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {shownTab === 'students' ? (
          <div id="bov-panel-students" role="tabpanel" aria-labelledby="bov-tab-students" className="bov__body">
            <StudentsTab batch={batch} students={students} onOpenContracts={onOpenContracts} />
          </div>
        ) : shownTab === 'emails' ? (
          <div id="bov-panel-emails" role="tabpanel" aria-labelledby="bov-tab-emails">
            <ReminderChannels
              channel={tab === 'whatsapp' ? 'whatsapp' : 'email'}
              kind="class"
              offering={`class:${batch.id}`}
              offDefaults={classOffDefaults(batch)}
              onChannel={(c) => onTab(c === 'whatsapp' ? 'whatsapp' : 'emails')}
            />
            {tab === 'whatsapp' ? (
              <WhatsAppTab
                kind="class"
                offering={`class:${batch.id}`}
                offeringName={batch.title}
                offDefaults={classOffDefaults(batch)}
                links={{ batchId: batch.id }}
              />
            ) : (
              <ClassEmails batch={batch} onToggle={toggleReminder} onEdit={(id) => onEditEmail?.(id)} />
            )}
          </div>
        ) : (
          <div id="bov-panel-classes" role="tabpanel" aria-labelledby="bov-tab-classes" className="bov__body">
            {notice && (
              <p className="bov__notice" role="status">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> {notice}
              </p>
            )}

            {/* Nothing coming up: one clear call to schedule, in the middle. Otherwise the list, with Schedule a class above it */}
            {classes.length > 0 && (
              <div className="bov__classes-head">
                <h2 className="bov__classes-title">Coming up</h2>
                <button type="button" className="oh__edit bov__schedule" onClick={() => setScheduling({ c: null })}>
                  <CalendarPlus size={15} aria-hidden="true" /> Schedule a class
                </button>
              </div>
            )}

            {classes.length === 0 ? (
              <div className="bov__none">
                <span className="bov__empty-icon" aria-hidden="true">
                  <CalendarPlus size={22} />
                </span>
                <h2 className="bov__none-title">{past.length === 0 ? 'Schedule your first class' : 'Schedule your next class'}</h2>
                <p className="bov__none-text">Students get a reminder before it starts.</p>
                <button type="button" className="oh__add bov__none-go" onClick={() => setScheduling({ c: null })}>
                  <CalendarPlus size={16} aria-hidden="true" /> Schedule a class
                </button>
              </div>
            ) : (
              <>
                {nextOn && (
                  <NextClass batch={batch} c={nextOn} today={today} now={now} onCancel={() => cancel(nextOn)} onChange={() => change(nextOn)} />
                )}
                <ul className="bov__classes">
                  {classes
                    .filter((c) => c !== nextOn)
                    .map((c) => (
                      <ClassRow
                        key={c.id}
                        c={c}
                        batch={batch}
                        today={today}
                        menuOpen={menuFor === c.id}
                        onMenu={(open) => setMenuFor(open ? c.id : null)}
                        onChange={() => change(c)}
                        onCancel={() => cancel(c)}
                      />
                    ))}
                </ul>
              </>
            )}

            {past.length > 0 && (
              <>
                <h2 className="bov__subhead">Past</h2>
                <ul className="bov__classes bov__classes--past">
                  {past.map((c) => (
                    <ClassRow key={c.id} c={c} batch={batch} today={today} past />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {scheduling && (
        <ScheduleClassDialog
          batch={batch}
          c={scheduling.c}
          onClose={() => setScheduling(null)}
          onDone={(line) => {
            setScheduling(null);
            setScheduled(line);
          }}
        />
      )}

      <PrototypeControls batch={batch} onChange={() => setNow(appNow())} />
    </div>
  );
}

// ---------- Students ----------
function StudentsTab({ batch, students, onOpenContracts }) {
  const [query, setQuery] = useState('');
  const [contract, setContract] = useState('all'); // a contract id, or 'all'
  const linked = useMemo(() => {
    // The linked contracts that anyone is on, for the filter (in the class's order)
    const seen = new Map();
    students.forEach((s) => s.contracts.forEach((c) => seen.set(c.id, c.title)));
    return (batch.contractIds ?? []).filter((id) => seen.has(id)).map((id) => ({ id, title: seen.get(id) }));
  }, [students, batch.contractIds]);

  const q = query.trim().toLowerCase();
  const shown = students.filter((s) => matches(s, q) && (contract === 'all' || s.contracts.some((c) => c.id === contract)));
  const filtering = Boolean(q) || contract !== 'all';

  const download = () => {
    const blob = new Blob([studentsCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${batch.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'class'}-students.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  if (students.length === 0) {
    return (
      <div className="bov__empty">
        <span className="bov__empty-icon" aria-hidden="true">
          <Users size={22} />
        </span>
        <h2 className="bov__empty-title">Nobody’s on these contracts yet</h2>
        <p className="bov__empty-text">
          {(batch.contractIds ?? []).length === 0
            ? 'Edit the class to link a contract. Everyone who buys it shows here.'
            : 'Share them from Contracts. Everyone who buys one shows here.'}
        </p>
        {(batch.contractIds ?? []).length > 0 && onOpenContracts && (
          <button type="button" className="oh__edit bov__empty-go" onClick={onOpenContracts}>
            Go to Contracts <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* One slim bar: how many on the left, search and the filter (past a few people), Export on the right */}
      <div className="bov-st__tools">
        <span className="bov-st__total">{plural(students.length, 'student')}</span>
        {students.length > SEARCH_FROM && (
          <label className="tx-search">
            <Search size={16} aria-hidden="true" />
            <span className="oh__sr-only">Search students</span>
            <input
              type="search"
              value={query}
              placeholder="Name, email or phone"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            />
          </label>
        )}
        {students.length > SEARCH_FROM && linked.length > 1 && (
          <label className="bov-st__filter">
            <span className="oh__sr-only">Show students on</span>
            <select className="call__select bov-st__select" value={contract} onChange={(e) => setContract(e.target.value)}>
              <option value="all">All contracts ({students.length})</option>
              {linked.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({students.filter((s) => s.contracts.some((x) => x.id === c.id)).length})
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="bov-st__export" onClick={download} disabled={shown.length === 0}>
          <Download size={14} aria-hidden="true" /> Export CSV
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="bov__no-match">
          <p>No one matches{q ? ` “${query.trim()}”` : ' that contract'}</p>
          <button
            type="button"
            className="oh__edit"
            onClick={() => {
              setQuery('');
              setContract('all');
            }}
          >
            <X size={15} aria-hidden="true" /> Show everyone
          </button>
        </div>
      ) : (
        <>
          <ul className="bov-st">
            {shown.map((s) => (
              <StudentRow key={s.id} student={s} showContracts={(batch.contractIds ?? []).length > 1} />
            ))}
          </ul>
          {filtering && (
            <p className="bov-st__count" role="status">
              {shown.length} of {plural(students.length, 'student')}
            </p>
          )}
        </>
      )}
    </>
  );
}

// One student: initials, name and how to reach them, their contracts,
// when they joined, and a WhatsApp chat
function StudentRow({ student: s, showContracts }) {
  const name = s.name || s.email || s.phone || 'Student';
  const first = name.split(/\s+/)[0];
  const chat = s.phone ? whatsappHref(s.phone, `Hi ${first}, `) : null;
  return (
    <li className="bov-st__row">
      <GuestInitials name={name} />
      <div className="bov-st__who">
        <p className="bov-st__name">
          {name}
          {s.sample && <span className="bov-st__sample">Sample</span>}
        </p>
        <p className="bov-st__contact">{[s.email, s.phone].filter(Boolean).join(' · ') || '—'}</p>
      </div>
      <span className="bov-st__tags">
        {showContracts &&
          s.contracts.map((c) => (
            <span key={c.id} className="bov-st__tag" title={c.title}>
              {c.title}
            </span>
          ))}
      </span>
      <span className="bov-st__joined">{joinedDay(s.joinedAt)}</span>
      <span className="bov-st__act">
        {chat ? (
          <a className="bov-st__wa" href={chat} target="_blank" rel="noopener noreferrer" aria-label={`Message ${name} on WhatsApp`}>
            <MessageCircle size={16} aria-hidden="true" />
          </a>
        ) : (
          <span className="bov-st__wa bov-st__wa--none" title="No phone number" />
        )}
      </span>
    </li>
  );
}

// The next class that happens (or the one on now), with Start class,
// and Change time and Cancel this class until it starts
function NextClass({ batch, c, today, now, onCancel, onChange }) {
  const state = classState(c, now);
  const live = state === 'live';
  return (
    <div className={`bov__next ${state !== 'later' ? 'bov__next--now' : ''}`}>
      <span className="bov__next-text">
        <span className="bov__next-label">{live ? 'Happening now' : 'Next class'}</span>
        <span className="bov__next-when">
          {classDay(c.date, today)}, {classTimeRange(c, batch)}
        </span>
      </span>
      <span className="bov__next-actions">
        {!live && (
          <>
            <button type="button" className="bov__link-btn" onClick={onChange}>
              Change time
            </button>
            <button type="button" className="bov__link-btn" onClick={onCancel}>
              Cancel this class
            </button>
          </>
        )}
        <a className="bov__start" href={classMeetingHref(batch.id)} target="_blank" rel="noopener">
          <Video size={16} aria-hidden="true" /> {live ? 'Rejoin class' : 'Start class'}
        </a>
      </span>
    </div>
  );
}

// One class in "Coming up" or "Past": its day and time, and either
// Cancelled or (coming up) ⋯ with Change time and Cancel this class
function ClassRow({ c, batch, today, past = false, menuOpen, onMenu, onChange, onCancel }) {
  const off = c.off;
  return (
    <li className={`bov__class ${off ? 'bov__class--off' : ''} ${past ? 'bov__class--past' : ''}`}>
      <span className="bov__class-day">{classDay(c.date, today)}</span>
      <span className="bov__class-time">{classTimeRange(c, batch)}</span>
      <span className="bov__class-state">
        {off?.kind === 'cancelled' && (
          <>
            <span className="bov__pill bov__pill--removed">Cancelled</span>
            {off.told?.email > 0 && <span className="bov__muted"> {plural(off.told.email, 'student')} told</span>}
          </>
        )}
      </span>
      <span className="bov__class-menu">
        {!off && !past && (
          <RowMenu
            title={`${classDay(c.date, today)} class`}
            open={menuOpen}
            onOpenChange={onMenu}
            items={[
              { label: 'Change time', icon: CalendarClock, onSelect: onChange },
              { label: 'Cancel this class', icon: CalendarX, danger: true, onSelect: onCancel },
            ]}
          />
        )}
      </span>
    </li>
  );
}
