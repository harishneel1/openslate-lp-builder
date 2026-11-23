import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CalendarX, Check, ChevronRight, Download, Link2, MessageCircle, Pencil, Plus, Search, Users, X } from 'lucide-react';
import RowMenu from '../components/RowMenu';
import PrototypeControls from '../components/PrototypeControls';
import GuestInitials from '../components/GuestInitials';
import ScheduleClassDialog from '../components/ScheduleClassDialog';
import { ContractsTab, LinkContractsDialog } from './ClassContracts';
import { classDay, classMeetingHref, classState, classTimeRange, dayOn, nextClasses, pastClasses } from '../data/batches';
import { zoneShort } from '../components/BatchFields';
import { onStudentsChange, studentsCsv, studentsOf } from '../data/classStudents';
import { whatsappHref } from '../utils/whatsapp';
import { getAllServices } from '../data/mockServices';
import ReminderChannels from '../components/ReminderChannels';
import WhatsAppTab from '../components/WhatsAppTab';
import ClassEmails from './ClassEmails';
import { classReminderById, saveReminderOn } from '../data/classReminders';
import { classOffDefaults } from '../data/whatsappMessages';
import { appNow, onTestDateChange } from '../utils/testClock';
import { copyText } from '../utils/copyText';
import './OfferingsHome.css';
import './CallOverview.css'; // the same head and tabs as a 1:1 call's page
import './BookingsPage.css'; // initials (.bk-face)
import './SalesPage.css'; // the search box (.tx-search), as on a course's Students
import './WebinarsPage.css'; // the badges and the meeting button's pulse, as on webinars
import './WebinarDetails.css'; // the next-session card and the sessions table, as on a webinar's page
import './BatchOverview.css';

// ------------------------------------------------------------
// One class's own page, opened from its row on Live classes.
//
//   [focus bar:  ← All classes ]   (App.jsx, from LiveClassesPage)
//   Morning Yoga                                                 [Edit]
//   ┌ 📅 Tue 24 Nov, 6:00–7:00 pm IST · Starts tomorrow [Join as host] ┐  light orange,
//   └──────────────────────────────────────────────────────────────────┘  as a webinar's
//                                                                          next session
//
//   Classes 9 | Students 12 | Reminders | Contracts 2      [+ Schedule]
//   Class                 Status
// ▌ Tue 24 Nov 6:00 pm    ● Next up                               ⋯
//   Thu 26 Nov 6:00 pm    Scheduled                               ⋯
//   Thu 19 Nov 6:00 pm    Ended
//
// Laid out like a webinar's page (WebinarDetails.jsx), so the two read
// the same: the next class is the one light-orange card in the header,
// with the one filled orange button (Join as host; it pulses from 15
// minutes before). The Students tab carries the head count. Nothing coming
// up: a quiet white card with + Schedule class instead.
//
// Classes (the first tab): every class as a table, coming up first
// (soonest at the top), then the ones that are over (latest first). The
// next one is the only orange row and the only orange badge (● Next up,
// or ● Live now). Later ones say Scheduled, cancelled ones Cancelled,
// past ones Ended. With 10 or more, the rows come in groups: Next up,
// Later · 8, Ended · 4 (folded away). ⋯ on a class to come: Change time,
// Cancel this class. + Schedule, beside the tabs, opens Schedule a class
// (ScheduleClassDialog.jsx). Cancelling goes to the cancel page
// (BatchAnnounce.jsx, through onAnnounce), where students are told.
//
// Students: everyone who bought any of the class's linked contracts, one
// row each (classStudents.js), newest first. Someone on two contracts
// shows once, with a chip for each. A slim bar above: how many, search
// and the contract filter (past 5 people), and Export CSV.
//
// Contracts: the ones people buy to join, each with Share link, and
// + Link contract beside the tabs (ClassContracts.jsx).
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
// tab: 'classes' | 'students' | 'emails' (Reminders, on Email) | 'whatsapp' | 'contracts'
//   (Reminders, on WhatsApp); onTab(tab)
// onEditEmail(id): open one of its emails in the editor
// onOpenContracts(): to the Contracts page, where contracts are shared
// onEdit(): its editor
// onAnnounce(change): cancel a class ({ kind: 'cancel', sessionId, date }): the cancel page
// classNotice: a line to show on Classes after one ("Class cancelled…")
// ------------------------------------------------------------

const TICK_MS = 30_000; // the clock, for which class is next or on now
const CLASSES_SHOWN = 200; // coming up, cancelled ones included
const GROUP_AT = 10; // from this many classes, the table comes in groups, as a webinar's does
const MIN = 60_000;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SEARCH_FROM = 5; // search and the filter show past this many people

// How many of its contracts still exist (one deleted since doesn't count)
const linkedCount = (batch) => {
  const ids = new Set(getAllServices().map((c) => c.id));
  return (batch.contractIds ?? []).filter((id) => ids.has(id)).length;
};

const TABS = [
  { id: 'classes', label: 'Classes' },
  { id: 'students', label: 'Students' },
  { id: 'emails', label: 'Reminders' },
  { id: 'contracts', label: 'Contracts' },
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
  const shownTab =
    tab === 'students' || tab === 'contracts'
      ? tab
      : tab === 'emails' || tab === 'whatsapp'
        ? 'emails'
        : 'classes';
  // The Schedule a class pop-up: { c: null } to schedule, { c } to change one's time
  const [scheduling, setScheduling] = useState(null);
  const [scheduled, setScheduled] = useState(null); // "Class scheduled for …"
  const [linking, setLinking] = useState(false); // the Link contracts pop-up
  const [contractNote, setContractNote] = useState(null); // "Contract linked."
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
  const past = useMemo(() => pastClasses(batch, now), [batch, now]);
  const nextOn = classes.find((c) => !c.off) ?? null;
  const today = dayOn(now, batch);
  const notice = scheduled ?? classNotice;
  const allCount = (batch.sessions ?? []).length;
  const contractCount = linkedCount(batch);

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
          </div>

          <div className="cov__actions">
            <button type="button" className="oh__edit" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </div>
        </div>
        <div className="bov__next-wrap">
          <NextClassCard
            batch={batch}
            c={nextOn}
            now={now}
            today={today}
            onSchedule={() => setScheduling({ c: null })}
            onChange={() => nextOn && change(nextOn)}
            onCancel={() => nextOn && cancel(nextOn)}
          />
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
                  setContractNote(null);
                  onTab(t.id);
                }}
              >
                {t.label}
                {t.id === 'students' && students.length > 0 && <span className="oh__count">{students.length}</span>}
                {t.id === 'classes' && allCount > 0 && <span className="oh__count">{allCount}</span>}
                {t.id === 'contracts' && contractCount > 0 && <span className="oh__count">{contractCount}</span>}
              </button>
            ))}
          </div>
          {/* At the top, so it's in reach however long the list gets (as Add session on a webinar) */}
          {shownTab === 'classes' && (
            <button type="button" className="wd__st-new" onClick={() => setScheduling({ c: null })}>
              <Plus size={16} aria-hidden="true" /> Schedule
            </button>
          )}
          {shownTab === 'contracts' && contractCount > 0 && (
            <button
              type="button"
              className="wd__st-new"
              onClick={() => {
                setContractNote(null);
                setLinking(true);
              }}
            >
              <Plus size={16} aria-hidden="true" /> Link contract
            </button>
          )}
        </div>

        {shownTab === 'contracts' ? (
          <div id="bov-panel-contracts" role="tabpanel" aria-labelledby="bov-tab-contracts">
            {contractNote && (
              <p className="bov__notice bov__notice--table" role="status">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> {contractNote}
              </p>
            )}
            <ContractsTab
              batch={batch}
              students={students}
              onLink={() => {
                setContractNote(null);
                setLinking(true);
              }}
              onSaid={setContractNote}
            />
          </div>
        ) : shownTab === 'students' ? (
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
          <div id="bov-panel-classes" role="tabpanel" aria-labelledby="bov-tab-classes">
            {notice && (
              <p className="bov__notice bov__notice--table" role="status">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> {notice}
              </p>
            )}
            {classes.length === 0 && past.length === 0 ? (
              <p className="bov__table-empty">Classes you schedule show here.</p>
            ) : (
              <ClassesTable
                batch={batch}
                upcoming={classes}
                past={past}
                next={nextOn}
                now={now}
                today={today}
                menuFor={menuFor}
                onMenu={setMenuFor}
                onChange={change}
                onCancel={cancel}
              />
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

      {linking && (
        <LinkContractsDialog
          batch={batch}
          onClose={() => setLinking(false)}
          onDone={(line) => {
            setLinking(false);
            setContractNote(line);
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

// ---------- The next class: a card in the header, as a webinar's next session ----------
// Light orange, the same every day: one line, the date with Join as
// host, the one filled
// orange button on the page. Share Zoom link sits by it (copies the
// class's one Zoom link, the same every class, for the coach's own
// groups; turns green, "Zoom link copied", for 3 seconds), and Change
// time and Cancel this class do until it starts. Nothing coming up: a quiet white card with + Schedule class.
function NextClassCard({ batch, c, now, today, onSchedule, onChange, onCancel }) {
  const [copied, setCopied] = useState(false);
  if (!c) {
    return (
      <section className="wd__next wd__next--none" aria-labelledby="bov-next-title">
        <div className="wd__next-none-text">
          <h2 className="wd__next-title wd__next-title--none" id="bov-next-title">
            No upcoming class
          </h2>
          <p className="wd__next-text">Schedule one. Students get a reminder before it starts.</p>
        </div>
        <button type="button" className="oh__add wd__next-add" onClick={onSchedule}>
          <Plus size={16} aria-hidden="true" /> Schedule class
        </button>
      </section>
    );
  }
  const state = classState(c, now);
  const live = state === 'live';
  const copyLink = async () => {
    if (await copyText(`${window.location.origin}${classMeetingHref(batch.id)}`)) {
      setCopied(true);
      window.clearTimeout(copyLink.t);
      copyLink.t = window.setTimeout(() => setCopied(false), 3000);
    }
  };
  return (
    <section className="wd__next" aria-label="Next class">
      <div className="wd__next-foot bov__next-foot">
        <div className="wd__next-when">
          <CalendarClock size={16} aria-hidden="true" />
          <span>
            {classDay(c.date, null)}, {classTimeRange(c, batch)} {zoneShort(batch.timeZone)}
          </span>
          <StartsIn c={c} now={now} batch={batch} />
        </div>
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
          <button
            type="button"
            className={`bov__link-btn bov__share ${copied ? 'bov__share--done' : ''}`}
            onClick={copyLink}
          >
            {/* Both labels share one spot, so the button keeps its width */}
            <span className="bov__share-label" aria-hidden={copied}>
              <Link2 size={14} aria-hidden="true" /> Share Zoom link
            </span>
            <span className="bov__share-label" aria-hidden={!copied}>
              <Check size={14} aria-hidden="true" /> Zoom link copied
            </span>
            <span className="oh__sr-only" aria-live="polite">
              {copied ? 'Zoom link copied' : ''}
            </span>
          </button>
          <a
            className={`oh__add wb-row__start bov__start-class`}
            href={classMeetingHref(batch.id)}
            target="_blank"
            rel="noopener"
            aria-label={`Join ${batch.title} as host (opens Zoom in a new tab)`}
          >
            {state !== 'later' && <span className="wb-row__pulse" aria-hidden="true" />}
            Join as host
          </a>
        </span>
      </div>
    </section>
  );
}

// "· Starts tomorrow" in green, or on the day the countdown pill, as on a webinar's card
function StartsIn({ c, now, batch }) {
  const mins = Math.ceil((c.start - now) / MIN);
  if (now >= c.start) {
    const at = Math.min(1, (now - c.start) / (c.end - c.start));
    const inMins = Math.floor((now - c.start) / MIN);
    return <Pill phase="live" text={inMins < 1 ? 'Live · just started' : `Live · ${countdown(inMins)} in`} at={at} />;
  }
  const days = dayDiff(dayOn(c.start, batch), dayOn(now, batch));
  if (days === 0) {
    const from = Math.min(now, c.start - 30 * MIN);
    return <Pill phase={mins <= 15 ? 'soon' : 'today'} text={`Starts in ${countdown(mins)}`} at={(now - from) / (c.start - from)} />;
  }
  return (
    <span className="wd__next-soon">
      <span aria-hidden="true">· </span>
      {days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`}
    </span>
  );
}

function Pill({ phase, text, at }) {
  return (
    <p className="wd__status">
      <span className={`wd__count wd__count--${phase}`}>
        {phase === 'live' && <span className="wd__count-dot" aria-hidden="true" />}
        {text}
        <span className="wd__count-fill" style={{ width: `${Math.min(Math.max(at, 0), 1) * 100}%` }} aria-hidden="true" />
      </span>
    </p>
  );
}

// 95 → '1 hr 35 min'; 40 → '40 min'
const countdown = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`);
// Whole days between two 'YYYY-MM-DD' dates
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

// ---------- Classes: every class, as a webinar's sessions table ----------
// Coming up first (soonest at the top), then the ones that are over
// (latest first). The next one is the light-orange row with the only
// orange badge. With GROUP_AT or more: Next up, Later · n, Ended · n (folded).
function ClassesTable({ batch, upcoming, past, next, now, today, menuFor, onMenu, onChange, onCancel }) {
  const [endedOpen, setEndedOpen] = useState(false);
  const live = next ? classState(next, now) === 'live' : false;
  const later = upcoming.filter((c) => c !== next);
  const grouped = upcoming.length + past.length >= GROUP_AT;

  const row = (c) => (
    <ClassRow
      key={c.id}
      c={c}
      batch={batch}
      today={today}
      now={now}
      isNext={c === next}
      past={past.includes(c)}
      menuOpen={menuFor === c.id}
      onMenu={(open) => onMenu(open ? c.id : null)}
      onChange={() => onChange(c)}
      onCancel={() => onCancel(c)}
    />
  );

  return (
    <div className="wd__st bov-ct">
      <div className="wd__st-row wd__st-row--head" aria-hidden="true">
        <span>Class</span>
        <span>Status</span>
        <span />
      </div>

      {grouped ? (
        <>
          {next && (
            <section aria-label={live ? 'Happening now' : 'Next up'}>
              <h3 className="wd__st-group">{live ? 'Happening now' : 'Next up'}</h3>
              <ul className="wd__st-list">{row(next)}</ul>
            </section>
          )}
          {later.length > 0 && (
            <section aria-label="Later">
              <h3 className="wd__st-group">
                Later <span className="wd__st-group-count">· {later.length}</span>
              </h3>
              <ul className="wd__st-list">{later.map(row)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section aria-label="Ended">
              <h3 className="wd__st-group wd__st-group--toggle">
                <button
                  type="button"
                  className="wd__st-group-btn"
                  aria-expanded={endedOpen}
                  aria-controls="bov-ct-ended"
                  onClick={() => setEndedOpen((o) => !o)}
                >
                  Ended <span className="wd__st-group-count">· {past.length}</span>
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                    className={`wd__st-group-chev ${endedOpen ? 'wd__st-group-chev--open' : ''}`}
                  />
                </button>
              </h3>
              {endedOpen && (
                <ul className="wd__st-list" id="bov-ct-ended">
                  {past.map(row)}
                </ul>
              )}
            </section>
          )}
        </>
      ) : (
        <ul className="wd__st-list">{[...upcoming, ...past].map(row)}</ul>
      )}
    </div>
  );
}

// One class: its day and time, its status badge, and ⋯ (Change time,
// Cancel this class) while it's still to come
function ClassRow({ c, batch, today, now, isNext, past, menuOpen, onMenu, onChange, onCancel }) {
  const cancelled = c.off?.kind === 'cancelled';
  const live = !cancelled && classState(c, now) === 'live';
  const label = cancelled ? 'Cancelled' : live ? 'Live now' : past ? 'Ended' : isNext ? 'Next up' : 'Scheduled';
  const orange = !cancelled && (live || isNext);
  const day = classDay(c.date, null);
  return (
    <li>
      <div className={`wd__st-row ${orange ? 'wd__st-row--link' : ''} ${cancelled ? 'bov-ct__row--off' : ''}`}>
        <span className="wd__st-when">
          <span className="wd__st-day">{day}</span>
          <span className="wd__st-time">{classTimeRange(c, batch)}</span>
        </span>
        <span className="wd__st-status">
          <span className={`wb-badge ${orange ? 'wd__st-badge--link' : ''}`}>
            {orange && <span className="wb-badge__dot" aria-hidden="true" />}
            {label}
          </span>
          {cancelled && c.off.told?.email > 0 && <span className="bov-ct__told">{plural(c.off.told.email, 'student')} told</span>}
        </span>
        <span className="bov-ct__menu">
          {!past && !cancelled && !live && (
            <RowMenu
              title={`${day} class`}
              open={menuOpen}
              onOpenChange={onMenu}
              items={[
                { label: 'Change time', icon: CalendarClock, onSelect: onChange },
                { label: 'Cancel this class', icon: CalendarX, danger: true, onSelect: onCancel },
              ]}
            />
          )}
        </span>
      </div>
    </li>
  );
}
