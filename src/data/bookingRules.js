// ------------------------------------------------------------
// A call's booking rules: the settings beside its weekly hours.
// Each is a key on the call's hours (availabilityStore.js) and a
// list of [value, label] choices.
// ------------------------------------------------------------
export const BOOKING_RULES = [
  {
    key: 'bufferMins',
    label: 'Break between calls',
    hint: 'Applies to every other 1:1 calls',
    options: [0, 5, 10, 15, 30, 45, 60].map((v) => [v, v === 0 ? 'No break' : `${v} minutes`]),
  },
  {
    key: 'minNoticeMins',
    label: 'Minimum notice',
    hint: 'How soon before a call people can still book it.',
    options: [[60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [720, '12 hours'], [1440, '1 day'], [2880, '2 days']],
  },
  {
    key: 'bookAheadDays',
    label: 'How far ahead people can book',
    hint: 'Times further out than this stay hidden.',
    options: [[7, '1 week'], [14, '2 weeks'], [30, '30 days'], [60, '60 days'], [90, '90 days']],
  }
];