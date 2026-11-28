import { buildProfileJson } from './buildProfileJson';
import {
  getMyPage,
  getMyProfile,
  isHiddenOnPage,
  isOnPage,
  loadAnswers,
  myCallIds,
  withCallChanges,
  withHiddenOnPage,
  withOnPage,
} from './myProfile';
import { buyContractOf, courseLandingPath, courseLandingUrl, isPublished, lessonCount, loadCourses } from './courses';
import { durationOf, durationText } from './courseExtras';
import { getService, servicePrice } from './mockServices';
import { loadBatches } from './batches';
import { contractCheckoutPath, contractCheckoutUrl } from './contractCheckout';
import { offeringUrl } from './myPage';
import { currentRun, seriesIdOf, webinarPrice, webinarStatus } from './webinar';
import { loadSaved } from '../utils/storage';
import { isPublished as isLive, liveHref } from '../utils/publish';

// ------------------------------------------------------------
// What the storefront page lists: everything the creator has made, by
// type (a tab each on the storefront page), each with an On/Off switch and
// the short description on its card. The page only talks to this file, so
// a new type (webinars, …) is one more entry in STOREFRONT_SOURCES, not a
// new screen.
//
// Each source says:
//   kind        matches serviceKinds.js ('call', 'course', …)
//   label       its tab on the storefront page ('1:1 calls')
//   tab         the sidebar tab where these are made ('calls')
//   tabLabel    that tab's name, for "Go to 1:1 calls"
//   empty       the note when there are none to list yet
//   note        optional: a line under the list's head, always shown
//   items(a)    everything of this kind that can go on the storefront, as
//               its card shows it (buildProfileJson), newest first
//   isOn(a,id)  shown on the storefront
//   withOn(a,id,on)        switched on or off
//   lineOf(a,item)         the short description on its card
//   withLine(a,id,text)    the short description changed
//   urlOf(a,id)            its own link (Copy link, Preview)
//   editsHere   true: Edit opens its editor on the storefront page (calls);
//               false: Edit goes to its sidebar tab (courses, live classes)
//   blockedOf(a,item)      optional: why it can't be switched on yet, or null
//   pickerOf(a,item)       optional: a choice shown under the short
//                          description while it's on ("People join with"):
//                          { label, options: [{ id, label }], value, note }
//   withPick(a,id,value)   that choice changed
//   noticeOf(a,item)       optional: a line under the row while it's on but
//                          can't show right now, or null (switch still works)
//
// 1:1 calls keep using the fields the call already has (offPage,
// hiddenOnPage, callDescription), so the 1:1 calls tab reads them as before.
// Courses have nothing of their own for this, so their switch and line are
// kept on the storefront: answers.storefront.course = { on: [ids], lines:
// { [id]: text } }. The course itself, and the Courses tab, don't change.
// Live classes the same (answers.storefront.class), plus picks: { [id]:
// contractId }, the contract its Join button sells.
// Webinars the same (answers.storefront.webinar), one row per webinar
// (its series), whatever number of sessions it has.
// ------------------------------------------------------------

export const SHORT_DESCRIPTION_MAX = 200;

const callSource = {
  kind: 'call',
  label: '1:1 calls',
  tab: 'calls',
  tabLabel: '1:1 calls',
  empty: 'You haven’t made any 1:1 calls yet. Make one in the 1:1 calls tab and it shows up here, ready to switch on.',
  items: (answers) => {
    const all = buildProfileJson(getMyProfile(answers)).services;
    return myCallIds(answers)
      .map((id) => all.find((s) => s.id === id))
      .filter(Boolean);
  },
  // An older "Hidden" call counts as off: there's just On and Off now
  isOn: (answers, id) => isOnPage(answers, id) && !isHiddenOnPage(answers, id),
  withOn: (answers, id, on) => withHiddenOnPage(withOnPage(answers, id, on), id, false),
  lineOf: (answers, item) => item.description ?? '',
  withLine: (answers, id, text) => withCallChanges(answers, id, { callDescription: text }),
  urlOf: (answers, id) => offeringUrl(answers.handle, id),
  editsHere: true,
};

// ---------- Courses ----------
// Kept on the storefront, by kind, so a later kind can share the shape
const kindState = (answers, kind) => answers.storefront?.[kind] ?? {};
const withKindState = (answers, kind, change) => ({
  ...answers,
  storefront: { ...answers.storefront, [kind]: { ...kindState(answers, kind), ...change } },
});

// Only published courses: a draft has no landing page to send people to
const publishedCourses = () => loadCourses().filter(isPublished);

// One course in the raw service shape (mockProfile.js), for buildProfileJson.
// Its line: what they wrote here, else its subtitle. Its price: the Buy
// button's contract ("Free" or "₹1,999"; publishing needs one).
function courseService(answers, course, order) {
  const line = kindState(answers, 'course').lines?.[course.id];
  const duration = durationOf(course);
  return {
    id: course.id,
    kind: 'course',
    title: course.title ?? '',
    description: line ?? course.subtitle ?? '',
    priceLabel: servicePrice(buyContractOf(course)),
    lessonCount: lessonCount(course),
    durationText: duration ? durationText(duration) : '',
    href: courseLandingPath(course.id),
    image: null, // no cover on the card for now
    rating: null,
    ratingCount: 0,
    status: 'active',
    order,
  };
}

const courseSource = {
  kind: 'course',
  label: 'Courses',
  tab: 'courses',
  tabLabel: 'Courses',
  empty: 'No published courses yet. Publish a course in Courses and it shows up here, ready to switch on.',
  note: 'Only published courses show here. Don’t see one? Publish it in Courses.',
  items: (answers) =>
    buildProfileJson({ creator: {}, services: publishedCourses().map((c, i) => courseService(answers, c, i)) }).services,
  isOn: (answers, id) => (kindState(answers, 'course').on ?? []).includes(id),
  withOn: (answers, id, on) => {
    const rest = (kindState(answers, 'course').on ?? []).filter((x) => x !== id);
    return withKindState(answers, 'course', { on: on ? [...rest, id] : rest });
  },
  lineOf: (answers, item) => item.description ?? '',
  withLine: (answers, id, text) =>
    withKindState(answers, 'course', { lines: { ...kindState(answers, 'course').lines, [id]: text } }),
  urlOf: (answers, id) => courseLandingUrl(id),
  editsHere: false,
};

// ---------- Live classes ----------
// A class has no page of its own, and can have several contracts (monthly,
// 6 months…). The coach picks the one its card sells ("People join with");
// until they do, or if that one is turned off or unlinked later, it's the
// first of its contracts still open, in the order they were linked.

// The class's contracts people can still buy, in the order linked
const openContractsOf = (batch) =>
  (batch.contractIds ?? []).map((id) => getService(id)).filter((c) => c && c.status !== 'inactive');

// The contract its card sells, and whether that's a fallback from the one picked
function classContract(answers, batch) {
  const open = openContractsOf(batch);
  const picked = kindState(answers, 'class').picks?.[batch.id];
  const chosen = open.find((c) => c.id === picked);
  return { contract: chosen ?? open[0] ?? null, fellBack: Boolean(picked) && !chosen, open };
}

// A short first line from the class's description, to start its card text
function firstLine(text, max = SHORT_DESCRIPTION_MAX) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${cut.slice(0, stop > 40 ? stop : max).trim()}…`.slice(0, max);
}

// One class in the raw service shape, for buildProfileJson
function classService(answers, batch, order) {
  const line = kindState(answers, 'class').lines?.[batch.id];
  const { contract } = classContract(answers, batch);
  return {
    id: batch.id,
    kind: 'class',
    title: batch.title ?? '',
    description: line ?? firstLine(batch.description),
    priceLabel: contract ? servicePrice(contract) : 'No contract linked',
    contractId: contract?.id ?? null,
    href: contract ? contractCheckoutPath(contract.id) : '',
    image: null,
    rating: null,
    ratingCount: 0,
    status: 'active',
    order,
  };
}

const classSource = {
  kind: 'class',
  label: 'Live classes',
  tab: 'live-classes',
  tabLabel: 'Live classes',
  empty: 'You haven’t made any live classes yet. Make one in Live classes and it shows up here, ready to switch on.',
  // Every class, as its card shows it, with the contract it sells (null: none open)
  items: (answers) => {
    const raw = loadBatches().map((b, i) => classService(answers, b, i));
    const contractOf = Object.fromEntries(raw.map((r) => [r.id, r.contractId]));
    return buildProfileJson({ creator: {}, services: raw }).services.map((s) => ({ ...s, contractId: contractOf[s.id] }));
  },
  isOn: (answers, id) => (kindState(answers, 'class').on ?? []).includes(id),
  withOn: (answers, id, on) => {
    const rest = (kindState(answers, 'class').on ?? []).filter((x) => x !== id);
    return withKindState(answers, 'class', { on: on ? [...rest, id] : rest });
  },
  lineOf: (answers, item) => item.description ?? '',
  withLine: (answers, id, text) =>
    withKindState(answers, 'class', { lines: { ...kindState(answers, 'class').lines, [id]: text } }),
  // Its own link: the checkout its card sends people to
  urlOf: (answers, id) => {
    const batch = loadBatches().find((b) => b.id === id);
    const { contract } = batch ? classContract(answers, batch) : {};
    return contract ? contractCheckoutUrl(contract.id) : '';
  },
  editsHere: false,
  blockedOf: (answers, item) => (item.contractId ? null : 'Link a contract to this class in Live classes first.'),
  pickerOf: (answers, item) => {
    const batch = loadBatches().find((b) => b.id === item.id);
    if (!batch) return null;
    const { contract, fellBack, open } = classContract(answers, batch);
    if (!contract) return null;
    return {
      label: 'Join button takes people to',
      options: open.map((c) => ({ id: c.id, label: `${c.title} · ${servicePrice(c)}` })),
      value: contract.id,
      note: fellBack ? 'The contract you picked is turned off or no longer linked, so this one is used.' : null,
    };
  },
  withPick: (answers, id, contractId) =>
    withKindState(answers, 'class', { picks: { ...kindState(answers, 'class').picks, [id]: contractId } }),
};

// ---------- Webinars ----------
// Every session of a webinar is its own copy, and they share one link that
// opens the session on now, else the soonest still to come (currentRun).
// So there's one row per webinar, keyed by its series, and nothing to pick.
// With no session coming up, its card leaves the storefront on its own and
// comes back when they run it again; the switch stays as they set it.

// Published webinars, one per series, newest first: { id: seriesId, run }
function webinarSeries() {
  const saved = loadSaved();
  const all = (Array.isArray(saved?.funnels) ? saved.funnels : []).filter(
    (f) => f && typeof f === 'object' && f.type === 'webinar',
  );
  const seen = new Set();
  const out = [];
  [...all]
    .filter(isLive)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .forEach((w) => {
      const id = seriesIdOf(w, all);
      if (seen.has(id)) return;
      seen.add(id);
      const run = currentRun(id, all) ?? w;
      out.push({ id, run });
    });
  return out;
}

// A session still to come (or on now)
const hasUpcoming = (run) => webinarStatus(run) === 'upcoming';

// One webinar in the raw service shape, for buildProfileJson. Its words and
// price come from the session its link opens.
function webinarService(answers, { id, run }, order) {
  const a = run.answers ?? {};
  const line = kindState(answers, 'webinar').lines?.[id];
  return {
    id,
    kind: 'webinar',
    title: String(a.headline ?? '').trim() || 'Untitled webinar',
    description: line ?? firstLine(a.subheadline),
    priceLabel: webinarPrice(a).label,
    upcoming: hasUpcoming(run),
    href: liveHref(run),
    image: null,
    rating: null,
    ratingCount: 0,
    status: 'active',
    order,
  };
}

const webinarSource = {
  kind: 'webinar',
  label: 'Webinars',
  tab: 'page-builder',
  tabLabel: 'Webinars',
  empty: 'No published webinars yet. Publish a webinar in Webinars and it shows up here, ready to switch on.',
  note: 'Only published webinars show here. Don’t see one? Publish it in Webinars.',
  items: (answers) => {
    const raw = webinarSeries().map((w, i) => webinarService(answers, w, i));
    const upcoming = Object.fromEntries(raw.map((r) => [r.id, r.upcoming]));
    return buildProfileJson({ creator: {}, services: raw }).services.map((s) => ({ ...s, upcoming: upcoming[s.id] }));
  },
  isOn: (answers, id) => (kindState(answers, 'webinar').on ?? []).includes(id),
  withOn: (answers, id, on) => {
    const rest = (kindState(answers, 'webinar').on ?? []).filter((x) => x !== id);
    return withKindState(answers, 'webinar', { on: on ? [...rest, id] : rest });
  },
  lineOf: (answers, item) => item.description ?? '',
  withLine: (answers, id, text) =>
    withKindState(answers, 'webinar', { lines: { ...kindState(answers, 'webinar').lines, [id]: text } }),
  urlOf: (answers, id) => {
    const found = webinarSeries().find((w) => w.id === id);
    return found ? liveHref(found.run) : '';
  },
  editsHere: false,
  noticeOf: (answers, item) =>
    item.upcoming ? null : 'No upcoming session, so it’s hidden for now. Run it again in Webinars to show it.',
};

export const STOREFRONT_SOURCES = [callSource, courseSource, classSource, webinarSource];

// Switching one on fixes its prefilled line (a suggestion from its name,
// or a course's subtitle), so a later rename doesn't quietly rewrite it
export function withItemOn(answers, source, item, on) {
  const switched = source.withOn(answers, item.id, on);
  return on ? source.withLine(switched, item.id, source.lineOf(answers, item)) : switched;
}

// The creator's public storefront: the calls on it (getMyPage), the
// published courses they've switched on (each going to its landing page),
// then the live classes switched on (each going to its contract's checkout),
// then the webinars switched on that have a session coming up (each going
// to its shared link)
// (ProfilePage.jsx, ?mock=profile&source=mine)
export function getStorefrontPage(answers = loadAnswers()) {
  const page = getMyPage(answers);
  const start = page.services.length;
  const courses = publishedCourses()
    .filter((c) => courseSource.isOn(answers, c.id))
    .map((c, i) => courseService(answers, c, start + i));
  // Live classes switched on, while they still have a contract to sell
  const classes = loadBatches()
    .filter((b) => classSource.isOn(answers, b.id))
    .map((b, i) => classService(answers, b, start + courses.length + i))
    .filter((c) => c.contractId);
  // Webinars switched on, while a session is still to come
  const webinars = webinarSeries()
    .filter((w) => webinarSource.isOn(answers, w.id) && hasUpcoming(w.run))
    .map((w, i) => webinarService(answers, w, start + courses.length + classes.length + i));
  return { ...page, services: [...page.services, ...courses, ...classes, ...webinars] };
}
