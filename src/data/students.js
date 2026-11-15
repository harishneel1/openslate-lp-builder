import { contractSignupsOf, CONTRACT_SIGNUPS_EVENT } from './contractSignupsStore';
import { isPublished, loadCourses } from './courses';

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
// Access (RBAC): a student sees a course only when it's published and
// they have a sign-up on one of its contracts (contractSignupsStore.js),
// matched by any email or mobile number they've had. Courses they don't
// have don't show at all. Access belongs to the student, not to one
// email: changing their email or number later keeps their courses, since
// the old ones stay in emails/phones.
//
// Signing in with a number or email we know from a sign-up fills in their
// name and the other contact from it. One we don't know still signs in;
// they just have no courses.
//
// currentStudent() → the signed-in student, or null
// signIn({ phone } | { email }) → the student
// signOut()
// updateStudent(id, { photo } | { phone } | { email }) → { student } or
//   { error }: a new number or email joins the ones they've had, so their
//   courses stay; a photo is a small data URL, or null to remove it
// usedByOther(id, { phone } | { email }) → true when someone else has it
// onStudentChange(fn) → runs fn when someone signs in or out, or a sign-up
//   is saved (here or in another tab); returns the function that stops it
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
  return id ? load().find((s) => s.id === id) ?? null : null;
}

// Every sign-up made with this email or number, newest first
function signupsFor({ emails = [], phones = [] }) {
  const wantEmails = new Set(emails.map(lower).filter(Boolean));
  const wantPhones = new Set(phones.map(digits).filter(Boolean));
  const ids = new Set(loadCourses().flatMap((c) => c.contractIds ?? []));
  return [...ids]
    .flatMap((id) => contractSignupsOf(id))
    .filter((r) => wantEmails.has(lower(r.email)) || wantPhones.has(digits(r.phone)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const uniq = (list) => [...new Set(list.filter(Boolean))];

export function signIn({ phone, email }) {
  const byPhone = phone ? fullPhone(digits(phone).slice(-10)) : '';
  const byEmail = lower(email);
  const list = load();

  const known = list.find((s) =>
    byPhone ? (s.phones ?? []).some((p) => digits(p) === digits(byPhone)) : (s.emails ?? []).map(lower).includes(byEmail),
  );

  // What their sign-ups know about them: name, and the other contact
  const found = signupsFor({ emails: byEmail ? [byEmail] : [], phones: byPhone ? [byPhone] : [] });
  const latest = found[0];

  let student;
  if (known) {
    student = known;
  } else {
    student = {
      id: `stu-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: String(latest?.name ?? '').trim(),
      email: byEmail || lower(latest?.email),
      phone: byPhone || (latest?.phone ? fullPhone(digits(latest.phone).slice(-10)) : ''),
      emails: [],
      phones: [],
      photo: null,
      createdAt: new Date().toISOString(),
    };
    list.push(student);
  }
  student.emails = uniq([...(student.emails ?? []), student.email, ...found.map((r) => lower(r.email))]);
  student.phones = uniq([...(student.phones ?? []), student.phone]);
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

export function canSee(student, course) {
  if (!student || !isPublished(course)) return false;
  const emails = new Set((student.emails ?? []).map(lower).filter(Boolean));
  const phones = new Set((student.phones ?? []).map(digits).filter(Boolean));
  return (course.contractIds ?? []).some((id) =>
    contractSignupsOf(id).some((r) => emails.has(lower(r.email)) || phones.has(digits(r.phone))),
  );
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