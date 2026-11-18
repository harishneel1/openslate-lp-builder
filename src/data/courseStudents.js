import { contractSignupsOf, isRefunded, onContractSignupsChange, saveContractSignup } from './contractSignupsStore';
import { buyContractOf, studentLessons } from './courses';
import { contractOf } from './mockServices';
import { contractTotals } from './contractCheckout';
import { progressOf } from './courseProgress';
import { studentIdFor } from './students';
import { CURRENCIES } from './earnings';

// ------------------------------------------------------------
// A course's students, for its Students tab (Round B): everyone who
// signed up on the course's own contract (the one its Buy button sells,
// course.buyContractId). One course, one contract: nobody gets in any
// other way (students.js).
//
// One student per person, matched by email (else phone, else name): the
// same person paying twice is one student with two payments.
//
//   { key, name, email, phone, joinedAt (ms, their first sign-up),
//     payments: [{ id, at, currency, price, coupon, discount, gst, total,
//                  free, paymentId, refundedAt, refunded, answers,
//                  gstDetails }]   newest first, as saved
//     free: true when every sign-up was free
//     paid: what they paid in all, in rupees' paise (other currencies at
//           Sales' rates, earnings.js), before refunds
//     refundedPaise: what was given back, in the same paise
//     status: 'paid' | 'free' | 'refunded'
//             refunded: every payment they made was refunded (in full
//             or in part), so they no longer have the course
//     hasAccess: true while any sign-up of theirs isn't refunded
//                (students.js decides the same)
//     refundable: their newest payment that can still be refunded, or
//                 null (free, or every payment refunded already)
//     answers: their newest sign-up's checkout answers
//     progress: { done, total, lastId, lastLesson } ; done and total count
//               the lessons students see. Empty until they've signed in
//               to the academy (progress is kept per signed-in student).
//   }
//
// studentsOfCourse(course) → its students, newest first
// courseNumbers(course) → { sales, refunds, refundedPeople, students }
//   sales:   paise, what's come in after refunds (rupees; other
//            currencies at Sales' rates), the same as Sales shows
//   refunds: paise given back; refundedPeople: how many people
//   students: how many have access now
// onCourseStudentsChange(fn) → runs fn when sign-ups change; returns the stop
// studentsCsv(list) → the list as a CSV file Excel opens
// addSampleStudent(course) → a made-up buyer on its Buy button's contract,
//   just now (Prototype controls only), or null with no contract
// ------------------------------------------------------------

const lower = (v) => String(v ?? '').trim().toLowerCase();
const digits = (v) => String(v ?? '').replace(/\D/g, '');

// Who a sign-up is, so the same person paying twice counts once
const keyOf = (r) => (lower(r.email) ? `e:${lower(r.email)}` : digits(r.phone) ? `p:${digits(r.phone)}` : `n:${lower(r.name) || r.id}`);

// An amount in a sign-up's currency (1499.5) → rupees' paise
const toPaise = (amount, currency) => {
  const rate = CURRENCIES[currency]?.rate ?? 1;
  return Math.round((Number(amount) || 0) * 100 * rate);
};

export function studentsOfCourse(course) {
  const contractId = course?.buyContractId;
  if (!contractId) return [];
  const lessons = studentLessons(course);
  const byPerson = new Map();
  contractSignupsOf(contractId).forEach((r) => {
    const key = keyOf(r);
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key).push(r);
  });

  return [...byPerson.entries()]
    .map(([key, records]) => {
      const newest = records[0];
      const at = (r) => Date.parse(r.createdAt) || 0;
      const paid = records.filter((r) => !r.free).reduce((sum, r) => sum + toPaise(r.total, r.currency), 0);
      const refundedPaise = records
        .filter(isRefunded)
        .reduce((sum, r) => sum + toPaise(r.refunded, r.currency), 0);
      const hasAccess = records.some((r) => !isRefunded(r));
      const free = records.every((r) => r.free || !(Number(r.total) > 0));
      const refundable = records.find((r) => !r.free && Number(r.total) > 0 && !isRefunded(r)) ?? null;

      // Their progress, once they've signed in to the academy
      const who = studentIdFor({ email: newest.email, phone: newest.phone });
      const progress = who ? progressOf(who, course.id) : null;
      const done = progress ? lessons.filter(({ lesson }) => progress.done.has(lesson.id)).length : 0;
      const last = progress?.last ? lessons.find(({ lesson }) => lesson.id === progress.last)?.lesson ?? null : null;

      return {
        key,
        name: String(records.find((r) => String(r.name ?? '').trim())?.name ?? '').trim(),
        email: String(newest.email ?? '').trim(),
        phone: String(newest.phone ?? '').trim(),
        joinedAt: Math.min(...records.map(at)),
        payments: records,
        free,
        paid,
        refundedPaise,
        status: !hasAccess ? 'refunded' : free ? 'free' : 'paid',
        hasAccess,
        refundable,
        answers: (newest.answers ?? []).filter((a) => a && a.question),
        progress: { done, total: lessons.length, lastId: last?.id ?? null, lastLesson: last?.title ?? null },
      };
    })
    .sort((a, b) => b.joinedAt - a.joinedAt);
}

export function courseNumbers(course) {
  const list = studentsOfCourse(course);
  const paid = list.reduce((sum, s) => sum + s.paid, 0);
  const refunds = list.reduce((sum, s) => sum + s.refundedPaise, 0);
  return {
    sales: paid - refunds,
    refunds,
    refundedPeople: list.filter((s) => s.refundedPaise > 0).length,
    students: list.filter((s) => s.hasAccess).length,
  };
}

export const onCourseStudentsChange = (fn) => onContractSignupsChange(fn);

// ---------- The list as a file ----------

export function studentsCsv(list) {
  const cell = (v) => {
    const text = String(v ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
  const rupees = (paise) => (paise / 100).toFixed(2);
  const STATUS = { paid: 'Paid', free: 'Free', refunded: 'Refunded' };
  const lines = [
    ['Name', 'Email', 'Phone', 'Joined', 'Status', 'Paid (₹)', 'Refunded (₹)', 'Lessons done', 'Lessons in all'],
    ...list.map((s) => [
      s.name,
      s.email,
      s.phone,
      day(s.joinedAt),
      STATUS[s.status],
      s.free ? '0' : rupees(s.paid),
      s.refundedPaise > 0 ? rupees(s.refundedPaise) : '',
      s.progress.done,
      s.progress.total,
    ]),
  ];
  return `\uFEFF${lines.map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

// ---------- Prototype controls (not part of the product) ----------

const SAMPLE_PEOPLE = [
  'Priya Raman', 'Arjun Mehta', 'Kavya Iyer', 'Rohan Gupta', 'Ananya Rao', 'Vikram Shah',
  'Sneha Pillai', 'Karthik Nair', 'Divya Menon', 'Aditya Joshi', 'Meera Krishnan', 'Rahul Verma',
];

export function addSampleStudent(course) {
  const buy = buyContractOf(course);
  if (!buy) return null;
  const contract = contractOf(buy);
  const prices = contract.prices ?? [];
  const price = prices.find((p) => p.currency === 'INR') ?? prices[0] ?? null;
  const free = contract.type === 'free' || !price;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const name = pick(SAMPLE_PEOPLE);
  const coupon = !free && Math.random() < 0.3 ? { code: 'WELCOME10', percent: 10 } : null;
  const sums = free ? null : contractTotals(price, contract.gst, coupon?.percent ?? 0);
  const mobile = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  return saveContractSignup({
    contractId: buy.id,
    contractTitle: buy.title,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}${Math.floor(Math.random() * 90 + 10)}@gmail.com`,
    phone: `+91 ${mobile}`,
    answers: [],
    free,
    currency: free ? 'INR' : price.currency,
    price: free ? 0 : sums.amount,
    coupon,
    discount: free ? 0 : sums.discount,
    gst: free ? null : sums.gst,
    total: free ? 0 : sums.total,
    gstDetails: null,
  });
}