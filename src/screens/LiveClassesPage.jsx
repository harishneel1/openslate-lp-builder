import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, Check, ImageIcon, Pencil, Plus, Repeat, Trash2, Video } from 'lucide-react';
import CreateBatchFlow from './CreateBatchFlow';
import BatchOverview from './BatchOverview';
import EditBatch from './EditBatch';
import BatchAnnounce from './BatchAnnounce';
import ClassReminderEditor from './ClassReminderEditor';
import { emailTextOf, saveEmailText } from '../data/classReminders';
import { EditPlaceholder } from './EditFrame';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import ScheduleClassDialog from '../components/ScheduleClassDialog';
import {
  cancelClass,
  classDay,
  classMeetingHref,
  classTime,
  dayOn,
  deleteBatch,
  feeLine,
  getBatch,
  loadBatches,
  lastClassOf,
  nextClassOf,
  nextClasses,
  onBatchesChange,
} from '../data/batches';
import { studentsOf } from '../data/classStudents';
import { previewOf } from '../data/imagePreviews';
import { zoneShort } from '../components/BatchFields';
import { appNow } from '../utils/testClock';
import { addDays } from '../utils/slots';
import { mockAccount } from '../data/myPage';
import './OfferingsHome.css'; // the same panels, rows and buttons as 1:1 calls
import './CallsPage.css';
import './CallOverview.css'; // the tabs (cov__tabs), as on a 1:1 call's page
import './LiveClassesPage.css';

// ------------------------------------------------------------
// The Live classes tab: a coach's classes, laid out like TagMango's
// Workshops list.
//
//   Live classes                                       [+ Create a class]
//   Classes on Zoom. Everyone on the contracts you link can join.
//   ┌───────────────────────────────────────────────────────────────────┐
//   │ [thumb] Morning Yoga               [Join as host] [Schedule] [⋯] │
//   │         [Tomorrow, 6:00 pm IST]  3 classes coming up · 2 contracts │
//   │ [thumb] Watercolour Basics                        [Schedule] [⋯] │
//   │         [Nothing scheduled]  Last class yesterday · 1 contract     │
//   └───────────────────────────────────────────────────────────────────┘
//
// One list, no tabs: a class is an ongoing group, never "completed".
// Classes with one coming up first, the soonest first; then those with
// nothing scheduled, the most recently met first.
//
// A click on a row opens the class's page (BatchOverview.jsx). Join as
// host (only when a class is coming up) opens its Zoom room in a new
// tab. Schedule opens Schedule a class (ScheduleClassDialog.jsx) right
// here, so the next one is two taps from the list. ⋯ holds Edit (its
// editor, EditBatch.jsx) and Delete. Any class can be deleted (it holds
// no payments: those are on its contracts, which stay). Create a class is
// the form (CreateBatchFlow.jsx).
//
// A class has no link of its own, as on TagMango: people join by buying
// one of its contracts, and those are shared from the Contracts page.
//
// onOpenContracts(): to the Contracts page (App.jsx)
//
// The way back, as for 1:1 calls: a class's page and its editor put the
// app in focus mode (onFocus, App.jsx):
//   the class's page   ← All classes   (to this list)
//   its editor         ← Your class    (to its page; asks first about unsaved changes)
//   cancelling a class ← Your class    (BatchAnnounce.jsx; asks first if the email changed)
//
// openRequest: { id, tab, n } from elsewhere (the bell, Contracts): open
//   that class's page on that tab. n opens it again on a second click.
// onFocus(focus | null): sets the focus bar (AppLayout's FocusBar)
// ------------------------------------------------------------

function useBatches() {
  const [batches, setBatches] = useState(loadBatches);
  useEffect(() => onBatchesChange(() => setBatches(loadBatches())), []);
  return batches;
}

export default function LiveClassesPage({ openRequest = null, onFocus, onOpenContracts }) {
  const batches = useBatches();
  // 'list' ↔ 'details' (a class's page) ↔ 'edit' (its editor) or 'email' (one of
  // its emails, in the email editor), or 'new'
  const [view, setView] = useState(openRequest ? 'details' : 'list');
  const [openId, setOpenId] = useState(openRequest?.id ?? null);
  const [tab, setTab] = useState(openRequest?.tab ?? 'classes'); // Classes is the first tab
  // Just made: its page opens with Schedule a class
  const [scheduleOnOpen, setScheduleOnOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null); // the class Schedule was pressed on
  const [listNotice, setListNotice] = useState(null); // "Class scheduled for …"
  const [deleting, setDeleting] = useState(null); // the batch while the pop-up asks
  const [said, setSaid] = useState('');
  const editExitRef = useRef(null);
  const announceExitRef = useRef(null);
  const emailExitRef = useRef(null);
  // The email open in the editor ('welcome', 'hourBefore' …)
  const [emailOpen, setEmailOpen] = useState(null);
  // The class being cancelled: { kind: 'cancel', date }
  const [announce, setAnnounce] = useState(null);
  // A line on the Classes tab after one's sent ("Class on Thu 13 Nov cancelled…")
  const [classNotice, setClassNotice] = useState(null);


  // Asked to open a batch (the bell, Contracts): its page, on that tab
  useEffect(() => {
    if (!openRequest) return;
    setOpenId(openRequest.id);
    setTab(openRequest.tab ?? 'classes');
    setView('details');
  }, [openRequest?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'list') document.title = 'Live classes';
  }, [view]);

  const open = batches.find((b) => b.id === openId) ?? null;

  // ---------- The focus bar, while a batch is open ----------
  const openTitle = open?.title ?? null;
  useEffect(() => {
    if (!onFocus) return;
    const toList = () => setView('list');
    if (view === 'details') {
      onFocus({ title: openTitle ?? 'Class', minimal: true, exitLabel: 'All classes', onExit: toList });
    } else if (view === 'announce') {
      onFocus({
        title: openTitle ?? 'Class',
        minimal: true,
        exitLabel: 'Your class',
        onExit: () => {
          if (announceExitRef.current && announceExitRef.current() === false) return;
          setView('details');
        },
      });
    } else if (view === 'email') {
      onFocus({
        title: openTitle ?? 'Class',
        minimal: true,
        exitLabel: 'Your class',
        onExit: () => (emailExitRef.current ? emailExitRef.current() : setView('details')),
      });
    } else if (view === 'edit') {
      onFocus({
        title: openTitle ?? 'Edit class',
        status: false, // the editor saves with its own button
        exitLabel: 'Your class',
        onExit: () => (editExitRef.current ? editExitRef.current() : setView('details')),
      });
    } else {
      // The list, and Create a class (which has its own way back, as Create a 1:1 call does)
      onFocus(null);
    }
  }, [view, openTitle, onFocus]);
  // Leaving Live classes: no focus bar left behind
  useEffect(() => () => onFocus?.(null), [onFocus]);

  const openBatch = (id, next) => {
    setClassNotice(null);
    setOpenId(id);
    setJustAddedId(null);
    setTab('classes');
    setView(next);
  };

  if (view === 'new') {
    return (
      <CreateBatchFlow
        onExit={() => setView('list')}
        onDone={(id) => {
          setJustAddedId(id);
          setOpenId(id);
          setTab('classes');
          setScheduleOnOpen(true);
          setView('details');
        }}
      />
    );
  }

  if ((view === 'details' || view === 'edit' || view === 'announce') && !open) {
    return (
      <EditPlaceholder
        title="This class isn’t here"
        sub="It may have been deleted. Go back to see your classes."
        backLabel="Live classes"
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'announce' && announce) {
    const now = appNow();
    const students = studentsOf(open);
    const back = () => {
      setTab('classes');
      setView('details');
    };
    return (
      <BatchAnnounce
        key={JSON.stringify(announce)}
        batch={open}
        change={announce}
        students={students}
        hostName={mockAccount.name}
        now={now}
        guardRef={announceExitRef}
        onClose={back}
        onConfirm={(told) => {
          const fresh = getBatch(open.id) ?? open;
          const ok = cancelClass(fresh, announce.sessionId, told, now);
          const who = told.email > 0 ? ` ${told.email} ${told.email === 1 ? 'student was' : 'students were'} told.` : '';
          setClassNotice(
            ok ? `The class on ${classDay(announce.date, null)} is cancelled.${who}` : 'That couldn’t be saved. Try again.',
          );
          back();
        }}
      />
    );
  }

  if (view === 'email' && emailOpen && open) {
    const back = () => {
      setTab('emails');
      setView('details');
    };
    return (
      <ClassReminderEditor
        key={`${open.id}-${emailOpen}`}
        reminderId={emailOpen}
        value={emailTextOf(open, emailOpen)}
        batch={open}
        hostName={mockAccount.name}
        exitRef={emailExitRef}
        onClose={back}
        onApply={(words) => {
          if (saveEmailText(getBatch(open.id) ?? open, emailOpen, words)) back();
        }}
      />
    );
  }

  if (view === 'edit') {
    return <EditBatch key={open.id} batch={open} exitRef={editExitRef} onBack={() => setView('details')} />;
  }

  if (view === 'details') {
    return (
      <BatchOverview
        key={open.id}
        batch={open}
        tab={tab}
        onTab={(t) => {
          setClassNotice(null);
          setTab(t);
        }}
        onEdit={() => setView('edit')}
        onOpenContracts={onOpenContracts}
        onEditEmail={(id) => {
          setEmailOpen(id);
          setView('email');
        }}
        onAnnounce={(change) => {
          setClassNotice(null);
          setAnnounce(change);
          setView('announce');
        }}
        classNotice={tab === 'classes' ? classNotice : null}
        scheduleOnOpen={scheduleOnOpen}
        onScheduleOpened={() => setScheduleOnOpen(false)}
      />
    );
  }

  const create = () => {
    setJustAddedId(null);
    setView('new');
  };

  const confirmDelete = () => {
    const { id, title } = deleting;
    deleteBatch(id);
    setDeleting(null);
    setSaid(`${title} deleted.`);
  };

  return (
    <ClassList
      batches={batches}
      notice={listNotice}
      onSchedule={(id) => {
        setMenuFor(null);
        setListNotice(null);
        setSchedulingId(id);
      }}
      justAddedId={justAddedId}
      menuFor={menuFor}
      setMenuFor={setMenuFor}
      onCreate={create}
      onOpen={(id) => openBatch(id, 'details')}
      onEdit={(id) => openBatch(id, 'edit')}
      onDelete={(b) => {
        setMenuFor(null);
        setListNotice(null);
        setDeleting(b);
      }}
      said={said}
    >
      {schedulingId && batches.some((b) => b.id === schedulingId) && (
        <ScheduleClassDialog
          batch={batches.find((b) => b.id === schedulingId)}
          onClose={() => setSchedulingId(null)}
          onDone={(line) => {
            const title = batches.find((b) => b.id === schedulingId)?.title ?? 'Class';
            setSchedulingId(null);
            setListNotice(`${title}: ${line.charAt(0).toLowerCase()}${line.slice(1)}`);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this class?"
          confirmLabel="Delete class"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>“{deleting.title}”</strong> and all its scheduled classes will be deleted. Its contracts stay as
            they are. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </ClassList>
  );
}

// ---------- The list ----------
function ClassList({ batches, notice, onSchedule, justAddedId, menuFor, setMenuFor, onCreate, onOpen, onEdit, onDelete, said, children }) {
  const now = appNow();
  const rows = useMemo(() => {
    const all = batches.map((b) => ({ batch: b, next: nextClassOf(b, now), last: lastClassOf(b, now) }));
    // Something coming up: soonest first. Then nothing scheduled: the most recently met first.
    return all.sort((a, b) => {
      if (a.next && b.next) return a.next.start - b.next.start;
      if (a.next || b.next) return a.next ? -1 : 1;
      return (b.last?.start ?? b.batch.createdAt ?? 0) - (a.last?.start ?? a.batch.createdAt ?? 0);
    });
  }, [batches, now]);

  return (
    <div className="oh calls lc">
      <div className="lc__head">
        <div>
          <h1 className="oh__title">Live classes</h1>
          <p className="calls__lead">Group classes on Zoom.</p>
        </div>
        {batches.length > 0 && (
          <button type="button" className="oh__add" onClick={onCreate}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a class
          </button>
        )}
      </div>

      {batches.length === 0 ? (
        <section className="oh__panel" aria-label="Your classes">
          <div className="oh__panel-body">
            <div className="calls__empty">
              <span className="calls__empty-icon" aria-hidden="true">
                <Repeat size={22} />
              </span>
              <h2 className="calls__empty-title">Create your first class</h2>
              <p className="calls__empty-text">
                Schedule sessions whenever you like.
              </p>
              <button type="button" className="oh__add" onClick={onCreate}>
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a class
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="oh__panel" aria-label="Your classes">
          <div className="oh__panel-body">
            {notice && (
              <p className="lc__notice" role="status">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> {notice}
              </p>
            )}
            <ul className="oh__rows">
              {rows.map(({ batch: b, next, last }) => (
                <ClassRow
                  key={b.id}
                  batch={b}
                  next={next}
                  last={last}
                  now={now}
                  isNew={b.id === justAddedId}
                  menuOpen={menuFor === b.id}
                  onMenu={(isOpen) => setMenuFor(isOpen ? b.id : null)}
                  onOpen={() => onOpen(b.id)}
                  onSchedule={() => onSchedule(b.id)}
                  onEdit={() => {
                    setMenuFor(null);
                    onEdit(b.id);
                  }}
                  onDelete={() => onDelete(b)}
                />
              ))}
            </ul>
            <p className="oh__sr-only" aria-live="polite">
              {said}
            </p>
          </div>
        </section>
      )}
      {children}
    </div>
  );
}

// The class's picture, or a plain tile when it has none
function Thumb({ batch }) {
  const picture = batch.thumbnail ? previewOf(batch.thumbnail.previewId) : null;
  return (
    <span className="lc__thumb" aria-hidden="true">
      {picture ? <img src={picture} alt="" /> : <ImageIcon size={20} />}
    </span>
  );
}

// When the class shown on a row is: 'Tomorrow, 6:30 am IST', 'Sat 28 Nov, 6:30 am IST'
function whenLine(c, batch, now) {
  return `${classDay(c.date, dayOn(now, batch))}, ${classTime(c, batch)} ${zoneShort(batch.timeZone)}`;
}

// The line after the pill: '3 classes coming up', or for a class with
// nothing scheduled, when it last met ('Last class yesterday')
function comingLine(batch, next, last, now) {
  if (next) {
    const n = nextClasses(batch, now, 100).length;
    return n === 1 ? '1 class coming up' : `${n} classes coming up`;
  }
  if (!last) return 'No classes yet';
  const today = dayOn(now, batch);
  const day = classDay(last.date, today);
  return day === 'Today' ? 'Last class today' : last.date === addDays(today, -1) ? 'Last class yesterday' : `Last class ${day}`;
}

// One class, as a full-width row like a 1:1 call's. Clicking the row
// anywhere but its buttons opens the class's page.
function ClassRow({ batch, next, last, now, isNew, menuOpen, onMenu, onOpen, onSchedule, onEdit, onDelete }) {
  return (
    <li
      className={`oh-row calls__row lc__row ${isNew ? 'oh-row--new' : ''} ${menuOpen ? 'oh-row--menu' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button, a, [role="menu"], [role="dialog"], dialog')) return;
        onOpen();
      }}
    >
      <Thumb batch={batch} />
      <div className="oh-row__text">
        {isNew && <span className="oh-card__new">Just created</span>}
        <h3 className="oh-row__name">
          <button type="button" className="calls__open" onClick={onOpen}>
            {batch.title}
          </button>
        </h3>
        <p className="lc__facts">
          {next ? (
            <span className="lc__when">{whenLine(next, batch, now)}</span>
          ) : (
            <span className="lc__when lc__when--none">Nothing scheduled</span>
          )}
          <span>
            {comingLine(batch, next, last, now)} · {feeLine(batch)}
          </span>
        </p>
      </div>

      <div className="oh-row__actions">
        {next && (
          <a className="lc__join" href={classMeetingHref(batch.id)} target="_blank" rel="noopener" aria-label={`Join ${batch.title} as host (opens in a new tab)`}>
            <Video size={15} aria-hidden="true" /> Join as host
          </a>
        )}
        <button type="button" className="oh__edit oh-card__edit" onClick={onSchedule} aria-label={`Schedule a class for ${batch.title}`}>
          <CalendarPlus size={15} aria-hidden="true" /> Schedule
        </button>
        <RowMenu
          title={batch.title}
          open={menuOpen}
          onOpenChange={onMenu}
          items={[
            { label: 'Edit', icon: Pencil, onSelect: onEdit },
            { label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </li>
  );
}
