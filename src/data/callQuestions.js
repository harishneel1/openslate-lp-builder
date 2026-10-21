// ------------------------------------------------------------
// Invitee questions: what a call asks people on checkout, after
// their name, email and phone (always asked, not editable here).
// Set per call in Edit service ("Invitee form"), saved on the
// call's answers as callQuestions:
//
//   [{ id, text, type, required, options }]
//   type:
//     short     one line ("What's your current CTC?")
//     long      a paragraph ("What's your biggest challenge right now?")
//     choice    pick one, as radio buttons ("Experience: 0–2 / 3–5 / 5+ years")
//     multi     pick any number, as checkboxes ("Which areas do you want help with?")
//     dropdown  pick one, from a menu (for longer lists, like a city)
//     phone     a phone number, with a country code
//   options  used by choice, multi and dropdown (HAS_OPTIONS); [] for the
//            others. Every option must be filled in (a new one starts
//            with three boxes).
//
// A call that's never had its questions edited asks the one every
// call used to ask (DEFAULT_QUESTIONS), so older calls work unchanged.
// An empty list is a choice: then only name, email and phone are asked.
//
// Each booking saves the questions as they were asked, with the
// answers: answers: [{ question, answer }] (bookingsStore.js), so a
// question reworded or removed later doesn't change old bookings.
// ------------------------------------------------------------

export const QUESTION_TYPES = [
  { id: 'short', label: 'One line', example: 'Short answers, like a number or a name' },
  { id: 'long', label: 'Paragraph', example: 'A few sentences, for open questions' },
  { id: 'choice', label: 'Single choice', example: 'They pick one option' },
  { id: 'multi', label: 'Checkboxes', example: 'They pick as many options as apply' },
  { id: 'dropdown', label: 'Dropdown', example: 'They pick one option from a menu' },
  { id: 'phone', label: 'Phone number', example: 'A number, with its country code' },
];

// The types that are a list of options the creator writes
export const HAS_OPTIONS = ['choice', 'multi', 'dropdown'];
export const hasOptions = (type) => HAS_OPTIONS.includes(type);

export const typeLabel = (type) => QUESTION_TYPES.find((t) => t.id === type)?.label ?? 'One line';

export const MAX_QUESTIONS = 10; // past this, checkout starts to feel like a survey
export const MAX_OPTIONS = 10;
export const QUESTION_MAX = 200; // characters in a question
export const OPTION_MAX = 80; // characters in an option
export const ANSWER_MAX = { short: 200, long: 2000 };

export const FIRST_CHOICES = 3; // a new choice question starts with this many empty options

export const DEFAULT_QUESTIONS = [
  { id: 'q-topic', text: 'What would you like to talk about?', type: 'long', required: false, options: [] },
];

// What checkout asks: every question (to stop asking one, they delete it)
export const askedQuestions = (list) => list;

// A call's questions: what it saved, or the default for one that never changed them
export const questionsOf = (call) => (Array.isArray(call?.callQuestions) ? call.callQuestions : DEFAULT_QUESTIONS);

const newId = () => `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// A blank question, ready to fill in
export const newQuestion = () => ({ id: newId(), text: '', type: 'short', required: false, options: [] });

// Changing a question's type. One with options opens with three empty ones to
// fill in (keeping any it had, so single choice ↔ checkboxes ↔ dropdown keeps
// them); the others don't use options.
export function withType(question, type) {
  if (!hasOptions(type)) return { ...question, type };
  const options = question.options.length > 0 ? question.options : Array(FIRST_CHOICES).fill('');
  return { ...question, type, options };
}

// Ready to save: text trimmed, options only on the types that have them
export function cleanQuestions(list) {
  return list.map((q) => ({
    id: q.id,
    text: q.text.trim(),
    type: q.type,
    required: Boolean(q.required),
    options: hasOptions(q.type) ? q.options.map((o) => o.trim()) : [],
  }));
}

export const sameQuestions = (a, b) => JSON.stringify(cleanQuestions(a)) === JSON.stringify(cleanQuestions(b));

// What's stopping these questions from being saved, if anything:
// { id: the question to fix, text: what to do }, or null
export function questionsProblem(list) {
  for (let i = 0; i < list.length; i += 1) {
    const q = list[i];
    const n = i + 1;
    if (!q.text.trim()) return { id: q.id, text: `Write question ${n}, or remove it` };
    if (hasOptions(q.type)) {
      const options = q.options.map((o) => o.trim().toLowerCase());
      if (options.some((o) => !o)) return { id: q.id, text: `Fill in every choice for question ${n}, or remove the empty ones` };
      if (options.length < 2) return { id: q.id, text: `Give question ${n} at least two choices` };
      if (new Set(options).size !== options.length) return { id: q.id, text: `Question ${n} has the same choice twice` };
    }
  }
  return null;
}

// While the section's closed: "Name, email, phone and 3 questions"
export function questionsSummary(list) {
  if (list.length === 0) return 'Name, email and phone. No questions.';
  const count = list.length === 1 ? '1 question' : `${list.length} questions`;
  return `Name, email, phone and ${count}`;
}

// One field's problem, shown under it once they've left it (QuestionsInput.jsx)
export function fieldProblems(q) {
  const options = q.options.map((o) => o.trim().toLowerCase());
  return {
    text: q.text.trim() ? null : 'Write the question',
    options: q.options.map((o, i) =>
      !o.trim() ? 'Write this choice, or remove it' : options.indexOf(options[i]) !== i ? 'Same as another choice' : null,
    ),
  };
}

// ---------- On checkout ----------

// What they've answered, as checkout keeps it:
//   multi: the options ticked, in the creator's order, e.g. ['Resume', 'Interviews']
//   phone: { code: '+91', number: '98765 43210' }
//   the rest: the text, or the option picked
export const emptyAnswer = (q) => (q.type === 'multi' ? [] : q.type === 'phone' ? { code: '+91', number: '' } : '');

const phoneDigits = (value) => String(value?.number ?? '').replace(/\D/g, '');

// Each question's error, by id: a required one left empty, or a phone
// number that can't be right. Others are fine.
export function checkAnswers(questions, values) {
  return Object.fromEntries(
    questions.map((q) => {
      const value = values[q.id] ?? emptyAnswer(q);
      if (q.type === 'phone') {
        const digits = phoneDigits(value);
        if (!digits) return [q.id, q.required ? 'Enter a phone number' : null];
        return [q.id, digits.length < 6 || digits.length > 15 ? 'Enter a valid phone number' : null];
      }
      const empty = q.type === 'multi' ? value.length === 0 : !String(value).trim();
      if (!q.required || !empty) return [q.id, null];
      const message =
        q.type === 'multi' ? 'Choose at least one' : hasOptions(q.type) ? 'Choose an answer' : 'Answer this question';
      return [q.id, message];
    }),
  );
}

// One answer as the booking saves it: text ('' if skipped)
function answerText(q, value) {
  if (q.type === 'multi') return q.options.filter((o) => (value ?? []).includes(o)).join(', ');
  if (q.type === 'phone') return phoneDigits(value) ? `${value.code} ${value.number.trim()}` : '';
  return String(value ?? '').trim();
}

// What the booking saves: every question as asked, with what they answered
export const answersFor = (questions, values) =>
  questions.map((q) => ({ question: q.text, answer: answerText(q, values[q.id]) }));