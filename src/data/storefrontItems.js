import { buildProfileJson } from './buildProfileJson';
import {
  getMyProfile,
  isHiddenOnPage,
  isOnPage,
  myCallIds,
  withCallChanges,
  withHiddenOnPage,
  withOnPage,
} from './myProfile';

// ------------------------------------------------------------
// What the storefront page lists: everything the creator has made,
// grouped by type, each with an On/Off switch and the short description
// on its card. The page only talks to this file, so a new type (webinars,
// courses, …) is one more entry in STOREFRONT_SOURCES, not a new screen.
//
// Each source says:
//   kind        matches serviceKinds.js ('call', 'webinar', 'course', …)
//   label       the group's heading ('1:1 calls')
//   tab         the sidebar tab where these are made ('calls')
//   empty       the note when they haven't made any yet
//   items(a)    everything of this kind they've made, as its card shows
//               it (buildProfileJson), newest first
//   isOn(a,id)  shown on the storefront
//   withOn(a,id,on)        switched on or off
//   lineOf(a,item)         the short description on its card
//   withLine(a,id,text)    the short description changed
//
// For now only 1:1 calls are listed. They keep using the fields the call
// already has (offPage, hiddenOnPage, callDescription), so the 1:1 calls
// tab reads them as before and doesn't change.
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
};

export const STOREFRONT_SOURCES = [callSource];

// Switching one on fixes its prefilled line (a suggestion from its name),
// so renaming it later doesn't quietly rewrite what's on its card
export function withItemOn(answers, source, item, on) {
  const switched = source.withOn(answers, item.id, on);
  return on ? source.withLine(switched, item.id, source.lineOf(answers, item)) : switched;
}
