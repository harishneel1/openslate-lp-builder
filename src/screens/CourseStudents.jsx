import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FlaskConical,
  ChevronDown,
  GraduationCap,
  MessageCircle,
  RotateCcw,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import RowMenu from '../components/RowMenu';
import GuestInitials from '../components/GuestInitials';
import { Segmented, Stat, useMoney } from './SalesShared';
import { RefundDialog } from './TransactionsTab';
import CourseStudentDrawer, { Progress, joinedDay } from './CourseStudentDrawer';
import {
  addSampleStudent,
  courseNumbers,
  onCourseStudentsChange,
  studentsCsv,
  studentsOfCourse,
} from '../data/courseStudents';
import { money, refundOrder } from '../data/earnings';
import { loadSaved } from '../utils/storage';
import { whatsappHref } from '../utils/whatsapp';
import './BookingsPage.css'; // the initials (bk-face) and the panel's buttons (bk-btn)
import './OfferingsHome.css'; // panels and buttons
import './SalesPage.css'; // the numbers, tiles, pills, search and the refund pop-up, as in Sales
import './CourseStudents.css';

// ------------------------------------------------------------
// A published course's Students tab (CoursePage.jsx): who bought it,
// what came in, and each student's details. Only once it's been
// published: a course being set up has no students yet.
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ (↗) Total sales      (👥) Students      (↺) Refunds          │
//   │     ₹38,998               24                ₹2,499 · 1 person │
//   └──────────────────────────────────────────────────────────────┘
//   ┌ Students ─────────────────────────────────────────────────────┐
//   │ Students                                             [⤓ Download CSV] │
//   │ [🔍 Name, email or phone] [All 25|Paid 22|Free 2|Refunded 1]          │
//   │ STUDENT                  PROGRESS      JOINED        PAID             │
//   │ (PR) Priya Raman            ▓▓▓░░░ 4 of 12      12 Nov 2026  ₹2,499 Paid  💬 ⋯ │
//   │      priya@gmail.com · +91 98765 43210                                         │
//   └───────────────────────────────────────────────────────────────┘
//   (Prototype controls: Add a sample student)
//
// The three numbers are the course's, all time:
//   Total sales  what came in, in rupees, after refunds (dollars and euros
//                at Sales' rates): the same as Sales shows for it
//   Students     people who have the course now (refunded ones don't)
//   Refunds      what was given back, and to how many people
// One row per person (courseStudents.js): the same person paying twice is
// one student. A click on the row (or View details in ⋯) opens them in a
// side panel (CourseStudentDrawer.jsx): how to reach them, their progress,
// every payment, and their checkout answers.
// ⋯: View details, and Refund for a payment that can be refunded. Refund
// is Sales' own pop-up (TransactionsTab.jsx): full or part, what comes out
// of the balance, and a line that says they lose the course. Any refund,
// full or part, takes the course away, so they move to Refunded. A free
// student or one refunded already says why it can't be refunded.
// Download CSV: everyone on the list as it's filtered and searched.
// Filters: Free shows only once someone joined free, Paid only on a course
// people pay for. Searching or filtering adds "3 of 25 students" under it.
//
// course: the course (published, or published before)
// ------------------------------------------------------------

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'free', label: 'Free' },
  { id: 'refunded', label: 'Refunded' },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Everyone on the course, kept up to date as people buy (here or in another tab)
function useStudents(course) {
  const [tick, setTick] = useState(0);
  useEffect(() => onCourseStudentsChange(() => setTick((n) => n + 1)), []);
  return useMemo(
    () => ({ list: studentsOfCourse(course), numbers: courseNumbers(course) }),
    [course, tick], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

export default function CourseStudents({ course }) {
  const { list, numbers } = useStudents(course);
  // Every webinar session, so the balance a refund comes out of is the whole one, as in Sales
  const webinars = useMemo(() => {
    const { funnels } = loadSaved();
    return (Array.isArray(funnels) ? funnels : []).filter((f) => f?.type === 'webinar');
  }, []);
  const { orders, total } = useMoney(webinars);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [menuFor, setMenuFor] = useState(null); // whose ⋯ is open
  const [openKey, setOpenKey] = useState(null); // who's open in the side panel
  const [refunding, setRefunding] = useState(null); // the payment being refunded (a sign-up id)

  const counts = useMemo(
    () => ({
      all: list.length,
      paid: list.filter((s) => s.status === 'paid').length,
      free: list.filter((s) => s.status === 'free').length,
      refunded: list.filter((s) => s.status === 'refunded').length,
    }),
    [list],
  );

  // Only the filters that can show someone: Free goes when nobody joined
  // free (a paid course), Paid when only free people are on it (a free
  // course). The one that's picked always stays.
  const filters = FILTERS.filter(
    (f) =>
      f.id === filter ||
      (f.id === 'free'
        ? counts.free > 0
        : f.id === 'paid'
          ? counts.paid > 0 || counts.refunded > 0 || counts.free === 0
          : true),
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return list.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (digits.length >= 3 && s.phone.replace(/\D/g, '').includes(digits))
      );
    });
  }, [list, query, filter]);

  const opened = openKey ? (list.find((s) => s.key === openKey) ?? null) : null;
  const orderOf = (signupId) => orders.find((o) => o.id === `sale-${signupId}`) ?? null;
  const refundingOrder = refunding ? orderOf(refunding) : null;

  const download = () => {
    const blob = new Blob([studentsCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${course.slug || 'course'}-students.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <div className="cst">
      {/* ---------- The three numbers ---------- */}
      <section className="oh__panel wd-bal" aria-label="Totals">
        <div className="wd-bal__grid cst-totals">
          <Stat kind="sale" icon={TrendingUp} label="Total sales">
            {money(numbers.sales)}
          </Stat>
          <Stat kind="course" icon={Users} label="Students">
            {numbers.students.toLocaleString('en-IN')}
          </Stat>
          <Stat kind="refund" icon={RotateCcw} label="Refunds">
            {money(numbers.refunds)}
            {numbers.refundedPeople > 0 && (
              <span className="cst-stat__note"> · {plural(numbers.refundedPeople, 'person')}</span>
            )}
          </Stat>
        </div>
      </section>

      {/* ---------- Everyone ---------- */}
      <section className="oh__panel" aria-labelledby="cst-title">
        <div className="oh__panel-head cst__head">
          {/* The title, with Download CSV across from it */}
          <div className="cst__title-row">
            <h2 className="oh__panel-title" id="cst-title">
              Students
            </h2>
            {list.length > 0 && (
              <button type="button" className="oh__edit cst__download" onClick={download} disabled={shown.length === 0}>
                <Download size={15} aria-hidden="true" /> Download CSV
              </button>
            )}
          </div>
          {list.length > 0 && (
            <div className="cst__tools">
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
              <Segmented
                options={filters.map((f) => ({ id: f.id, label: `${f.label} ${counts[f.id]}` }))}
                value={filter}
                onChange={setFilter}
                label="Show"
              />
            </div>
          )}
        </div>

        {list.length === 0 ? (
          <div className="cst-empty">
            <span className="cst-empty__icon" aria-hidden="true">
              <GraduationCap size={22} />
            </span>
            <h3 className="cst-empty__title">No students yet</h3>
            <p className="cst-empty__text">Share your landing page link. People who buy the course show up here.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="cst-empty">
            <h3 className="cst-empty__title">
              {query.trim()
                ? `No one matches “${query.trim()}”`
                : `No ${FILTERS.find((f) => f.id === filter).label.toLowerCase()} students`}
            </h3>
            <button
              type="button"
              className="oh__edit"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              <X size={15} aria-hidden="true" /> Show everyone
            </button>
          </div>
        ) : (
          <>
            {/* What each column is (hidden on narrow screens, where rows stack) */}
            <div className="cst-list__head" aria-hidden="true">
              <span />
              <span>Student</span>
              <span>Progress</span>
              <span>Joined</span>
              <span className="cst-list__head-end">Paid</span>
              <span />
            </div>
            <ul className="cst-list">
              {shown.map((s) => (
                <StudentRow
                  key={s.key}
                  student={s}
                  canRefund={Boolean(s.refundable && orderOf(s.refundable.id))}
                  menuOpen={menuFor === s.key}
                  onMenu={(open) => setMenuFor(open ? s.key : null)}
                  onOpen={() => {
                    setMenuFor(null);
                    setOpenKey(s.key);
                  }}
                  onRefund={() => {
                    setMenuFor(null);
                    setRefunding(s.refundable.id);
                  }}
                />
              ))}
            </ul>
            {/* Searching or filtering: how many of everyone this is */}
            {(query.trim() || filter !== 'all') && (
              <p className="cst-list__count" role="status">
                {shown.length} of {plural(list.length, 'student')}
              </p>
            )}
          </>
        )}
      </section>

      <StudentsTestControls course={course} />

      {opened && (
        <CourseStudentDrawer
          student={opened}
          course={course}
          orderOf={orderOf}
          onClose={() => setOpenKey(null)}
          onRefund={(signupId) => setRefunding(signupId)}
        />
      )}

      {refundingOrder && (
        <RefundDialog
          order={refundingOrder}
          balance={total}
          onCancel={() => setRefunding(null)}
          onConfirm={(minor) => {
            refundOrder(refundingOrder.id, minor, { webinars });
            setRefunding(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- One student ----------
// The row opens their side panel; WhatsApp and ⋯ are buttons of their own.
const STATUS_PILL = {
  paid: { cls: 'completed', label: 'Paid' },
  free: { cls: 'free', label: 'Free' },
  refunded: { cls: 'refunded', label: 'Refunded' },
};

function StudentRow({ student: s, canRefund, menuOpen, onMenu, onOpen, onRefund }) {
  const name = s.name || 'No name given';
  const first = name.split(/\s+/)[0];
  const chat = s.phone ? whatsappHref(s.phone, `Hi ${first}, `) : null;
  const pill = STATUS_PILL[s.status];
  const why =
    s.status === 'free' ? 'They joined for free.' : s.status === 'refunded' ? 'They were refunded already.' : null;
  const items = [
    { label: 'View details', icon: Eye, onSelect: onOpen },
    {
      label: 'Refund',
      icon: RotateCcw,
      danger: canRefund,
      disabled: !canRefund,
      hint: canRefund ? 'They lose the course.' : (why ?? 'This payment can’t be refunded here.'),
      onSelect: onRefund,
    },
  ];
  const stop = (e) => e.stopPropagation();

  return (
    <li className={`cst-row ${s.hasAccess ? '' : 'cst-row--gone'}`} onClick={onOpen}>
      <GuestInitials name={name} />
      <div className="cst-row__who">
        <button
          type="button"
          className="cst-row__name"
          onClick={(e) => {
            stop(e);
            onOpen();
          }}
        >
          {name}
        </button>
        <p className="cst-row__contact">{[s.email, s.phone].filter(Boolean).join(' · ') || '—'}</p>
      </div>
      <Progress progress={s.progress} gone={!s.hasAccess} />
      <span className="cst-row__joined">{joinedDay(s.joinedAt)}</span>
      <span className="cst-row__money">
        {s.status !== 'free' && <span className="cst-row__paid">{money(s.paid)}</span>}
        <span className={`sx-pill sx-pill--${pill.cls}`}>{pill.label}</span>
      </span>
      <span className="cst-row__acts" onClick={stop}>
        {chat ? (
          <a
            className="cst-row__wa"
            href={chat}
            target="_blank"
            rel="noopener"
            aria-label={`Message ${name} on WhatsApp`}
            data-tip="WhatsApp"
            data-tip-align="end"
          >
            <MessageCircle size={17} aria-hidden="true" />
          </a>
        ) : (
          <span className="cst-row__wa cst-row__wa--none" />
        )}
        <RowMenu title={name} open={menuOpen} onOpenChange={onMenu} items={items} />
      </span>
    </li>
  );
}

// ---------- Prototype controls: not part of the product ----------
function StudentsTestControls({ course }) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState(null);
  return (
    <section className={`proto cst-proto ${open ? 'proto--open' : ''}`} aria-label="Prototype controls">
      <button type="button" className="proto__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <FlaskConical size={16} aria-hidden="true" />
        <span className="proto__title">Prototype controls</span>
        <span className="proto__tag">For testing, not part of the product</span>
        <ChevronDown size={16} className="proto__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="proto__body">
          <div className="proto__row">
            <span className="proto__label">Students</span>
            <div className="proto__controls">
              <button
                type="button"
                className="proto__btn"
                onClick={() => {
                  const made = addSampleStudent(course);
                  setSaid(
                    made ? `${made.name} bought it just now.` : 'This course has no price yet, so nobody can buy it.',
                  );
                }}
              >
                Add a sample student
              </button>
              <p className="proto__note">
                {said ??
                  'A made-up buyer at the course’s price, as if they paid on its landing page just now. They show in Sales too.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}