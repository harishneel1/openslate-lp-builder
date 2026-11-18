import { contractSignupsOf, CONTRACT_SIGNUPS_EVENT } from './contractSignupsStore';
import { isPublished, linkedContracts, loadCourses } from './courses';
import { holds, matchOf } from './courseAccess';
import { getAllServices } from './mockServices';

// ------------------------------------------------------------
// Students: who's signed in to the academy, and which courses they can see.
//
// UI only. The real sign-in, codes and access checks are built by the
// devs on the server; this keeps just enough in the browser to click
// through the screens:
//   - any 6-digit code works (StudentSignIn.jsx)
//   - students are kept in this browser, one record each:
//       { id: 'stu-…', name, email, phone ('+91 9876543210' or ''),
//         emails: [...], phones: [...]  every email and number they've had,
//         photo: null, createdAt }
//   - who's signed in is kept in this browser too
//
// Access (RBAC): a student sees a course when it's published and they
// hold one of its contracts, matched by any email or mobile number
// they've had (courseAccess.js):
//   - its own, the one its Buy button sells (course.buyContractId):
//     a sign-up that hasn't been refunded. A refund, full or part, takes
//     the course away. These are the people on its Students tab.
//   - any it's also included with (extraContractsOf in courses.js): a
//     webinar's, a 1:1 call's, a batch's or any other contract. Booking
//     the call, registering for the webinar or joining the batch gives the
//     course too, until the booking is cancelled, they're removed, or the
//     sign-up is refunded. These people aren't on its Students tab.
// Courses they don't have don't show at all. Access belongs to the
// student, not to one email: changing their email or number later keeps
// their courses, since the old ones stay in emails/phones.
//
// Their name, and the email or number they didn't sign in with, come from
// what they gave at checkout: their newest sign-up on any contract made
// with any email or number they've had. Filled in when they sign in, and
// again whenever they're read (so someone who signs in first and buys
// later gets their name too). Only what's missing is filled in. Someone
// we know nothing about still signs in; they just have no courses, and
// show as their number or email.
//
// currentStudent() → the signed-in student, or null
// signIn({ phone } | { email }) → the student
// signOut()
// updateStudent(id, { photo } | { phone } | { email }) → { student } or
//   { error }: a new number or email joins the ones they've had, so their
//   courses stay; a photo is a small data URL, or null to remove it
// usedByOther(id, { phone } | { email }) → true when someone else has it
// studentIdFor({ email, phone }) → the id of the student with that email
//   or number, or null (they haven't signed in yet): whose progress to read
// onStudentChange(fn) → runs fn when someone signs in or out, or a sign-up
//   is saved or refunded (here or in another tab); returns the function
//   that stops it
// canSee(student, course) → true when they can open it
// coursesOf(student) → the published courses they can open
// INDIAN_MOBILE → what a number must look like (10 digits, from 6 to 9)
// EMAIL → what an email must look like
// fullPhone('9876543210') → '+91 9876543210'
// showPhone('+91 9876543210') → '+91 98765 43210'
// accountPath, contactPath → My account, and Update number/email
// ------------------------------------------------------------

const KEY = 'pagebuilder:students';
const SESSION = 'pagebuilder:student-session';
const CHANGED = 'students-changed';

export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const fullPhone = (national) => `+91 ${national}`;
// For showing: '+91 9876543210' → '+91 98765 43210'
export const showPhone = (phone) => String(phone ?? '').replace(/(\d{5})(\d{5})$/, '$1 $2');

// The student's own pages (AcademyCoursesPage.jsx sends them here)
export const accountPath = '/web/account';
export const contactPath = '/web/account/change-number-email';
const digits = (phone) => String(phone ?? '').replace(/\D/g, '');
const lower = (email) => String(email ?? '').trim().toLowerCase();

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((s) => s && typeof s.id === 'string') : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const changed = () => window.dispatchEvent(new Event(CHANGED));

export function currentStudent() {
  let id = null;
  try {
    id = localStorage.getItem(SESSION);
  } catch {
    return null;
  }
  if (!id) return null;
  const list = load();
  const student = list.find((s) => s.id === id);
  if (!student) return null;
  if (fillIn(student)) save(list);
  return student;
}

// Every sign-up made with this email or number, on any contract, newest first
function signupsFor({ emails = [], phones = [] }) {
  const wantEmails = new Set(emails.map(lower).filter(Boolean));
  const wantPhones = new Set(phones.map(digits).filter(Boolean));
  if (wantEmails.size === 0 && wantPhones.size === 0) return [];
  const ids = new Set([
    ...getAllServices().map((c) => c.id),
    ...loadCourses().flatMap((c) => [c.buyContractId, ...(c.contractIds ?? [])]).filter(Boolean),
  ]);
  return [...ids]
    .flatMap((id) => contractSignupsOf(id))
    .filter((r) => wantEmails.has(lower(r.email)) || wantPhones.has(digits(r.phone)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const uniq = (list) => [...new Set(list.filter(Boolean))];

// Fills in their name, email and number from their sign-ups, where
// missing. Returns true when something changed.
function fillIn(student) {
  const before = JSON.stringify(student);
  const found = signupsFor({ emails: student.emails ?? [student.email], phones: student.phones ?? [student.phone] });
  const named = found.find((r) => String(r.name ?? '').trim());
  if (!student.name && named) student.name = String(named.name).trim();
  const withEmail = found.find((r) => lower(r.email));
  if (!student.email && withEmail) student.email = lower(withEmail.email);
  const withPhone = found.find((r) => digits(r.phone).length >= 10);
  if (!student.phone && withPhone) student.phone = fullPhone(digits(withPhone.phone).slice(-10));
  student.emails = uniq([...(student.emails ?? []), student.email, ...found.map((r) => lower(r.email))]);
  student.phones = uniq([...(student.phones ?? []), student.phone]);
  return JSON.stringify(student) !== before;
}

export function signIn({ phone, email }) {
  const byPhone = phone ? fullPhone(digits(phone).slice(-10)) : '';
  const byEmail = lower(email);
  const list = load();

  const known = list.find((s) =>
    byPhone ? (s.phones ?? []).some((p) => digits(p) === digits(byPhone)) : (s.emails ?? []).map(lower).includes(byEmail),
  );

  let student = known;
  if (!student) {
    student = {
      id: `stu-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      email: byEmail,
      phone: byPhone,
      emails: [],
      phones: [],
      photo: null,
      createdAt: new Date().toISOString(),
    };
    list.push(student);
  }
  // What they gave at checkout: name, and the other contact
  fillIn(student);
  save(list);

  try {
    localStorage.setItem(SESSION, student.id);
  } catch {
    // Signed in for this visit only
  }
  changed();
  return student;
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION);
  } catch {
    // Nothing kept
  }
  changed();
}

export function usedByOther(id, { phone, email }) {
  return load().some(
    (s) =>
      s.id !== id &&
      (phone
        ? (s.phones ?? []).some((p) => digits(p) === digits(fullPhone(digits(phone).slice(-10))))
        : (s.emails ?? []).map(lower).includes(lower(email))),
  );
}

export function updateStudent(id, changes) {
  const list = load();
  const student = list.find((s) => s.id === id);
  if (!student) return { error: 'You’ve been signed out. Sign in again.' };
  if ('photo' in changes) student.photo = changes.photo || null;
  if (changes.phone) {
    student.phone = fullPhone(digits(changes.phone).slice(-10));
    student.phones = uniq([...(student.phones ?? []), student.phone]);
  }
  if (changes.email) {
    student.email = lower(changes.email);
    student.emails = uniq([...(student.emails ?? []), student.email]);
  }
  if (!save(list)) return { error: 'Couldn’t save. Try a smaller photo, or try again.' };
  changed();
  return { student };
}

export function studentIdFor({ email, phone }) {
  const e = lower(email);
  const p = digits(phone).slice(-10);
  const found = load().find(
    (s) =>
      (e && (s.emails ?? [s.email]).map(lower).includes(e)) ||
      (p.length === 10 && (s.phones ?? [s.phone]).some((x) => digits(x).slice(-10) === p)),
  );
  return found?.id ?? null;
}

export function canSee(student, course) {
  if (!student || !isPublished(course)) return false;
  const who = matchOf(student);
  return linkedContracts(course).some((contract) => holds(contract, who));
}

export const coursesOf = (student) => loadCourses().filter((c) => canSee(student, c));

export function onStudentChange(fn) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === SESSION || e.key === null || e.key === 'pagebuilder:contract-signups') fn();
  };
  window.addEventListener(CHANGED, fn);
  window.addEventListener(CONTRACT_SIGNUPS_EVENT, fn);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED, fn);
    window.removeEventListener(CONTRACT_SIGNUPS_EVENT, fn);
    window.removeEventListener('storage', fromOtherTab);
  };
}