import { loadBatches, nextClasses } from './batches';
import { studentsOf } from './classStudents';
import { matchOf } from './courseAccess';

// ------------------------------------------------------------
// A student's live classes, for the academy's Community page
// (CommunityPage.jsx): what's coming up in every class they're in.
//
// They're in a class when they're one of its students (classStudents.js):
// they bought one of its linked contracts, matched by email or phone, as
// courses are (courseAccess.js). Cancelled classes don't show.
//
// upcomingFor(student, now) → [{ c, batch }], soonest first; a class on
//   now counts until it ends. student null (the coach's preview): every
//   class's.
// joinState(c, now) → 'later' (more than 15 minutes off), 'open' (Join
//   works: from 15 minutes before until it ends) or 'live' (it's on)
// JOIN_FROM_MS: how early Join opens
// communityPath: /web/community
// studentJoinHref(batchId) → the class's Zoom room (the same one the
//   coach joins), from any page
// ------------------------------------------------------------

// The Community page's address (main.jsx sends it to AcademyCoursesPage.jsx)
export const communityPath = '/web/community';

export const JOIN_FROM_MS = 15 * 60_000;
const SHOWN = 60; // per class: plenty for the next few weeks

const lower = (v) => String(v ?? '').trim().toLowerCase();
const last10 = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

function isIn(student, batch) {
  const { emails, phones } = matchOf(student);
  return studentsOf(batch).some(
    (s) => (lower(s.email) && emails.has(lower(s.email))) || (last10(s.phone).length === 10 && phones.has(last10(s.phone))),
  );
}

export function upcomingFor(student, now = Date.now()) {
  return loadBatches()
    .filter((batch) => !student || isIn(student, batch))
    .flatMap((batch) => nextClasses(batch, now, SHOWN).map((c) => ({ c, batch })))
    .sort((a, b) => a.c.start - b.c.start);
}

export function joinState(c, now = Date.now()) {
  if (now >= c.start) return 'live';
  return c.start - now <= JOIN_FROM_MS ? 'open' : 'later';
}

export const studentJoinHref = (batchId) => `/?mock=zoom&batch=${encodeURIComponent(batchId)}`;
