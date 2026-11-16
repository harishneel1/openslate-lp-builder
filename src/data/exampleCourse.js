// ------------------------------------------------------------
// The example course: what a finished, well-made course landing page
// looks like. A made-up course by Meera Joshi, the same made-up coach as
// the storefront's example (mockProfile.js). It's original writing,
// modelled on what makes strong Udemy pages work: an outcome-led title,
// specific things students will learn, and a curriculum with real
// substance.
//
// Shown by the real landing page (CourseLandingPage.jsx, example mode)
// at ?mock=course-example, and later beside the course editor's Landing
// page and Pricing steps as a guide, with each part highlighted as the
// coach fills in the matching field. Being the same page as a real
// course's, its parts are always where the highlights point.
//
// It only has what a coach can fill in (or what fills in by itself: the
// instructor's stats, reviews from students), so coaches never look for a
// field that doesn't exist. Everything is shaped as a real course is
// (courses.js), so the page reads it the same way.
//
// EXAMPLE_COURSE      a course, as saved (sections, lessons with content
//                     kinds and resources, outcomes…)
// EXAMPLE_INSTRUCTOR  { name, photo, bio, stats: { students, courses,
//                     rating, reviews } }: what the Instructor part shows
// EXAMPLE_OFFER       what the Buy box shows (as offerOf in the page)
// EXAMPLE_RATING      { average, count, students }: the strip under the
//                     title, and the reviews' summary
// EXAMPLE_REVIEWS     [{ id, name, stars, when, text }], newest first
// The cover is a royalty-free photo at public/course-yoga.jpg; until it's
// added, the page shows our orange with the title (CoverArt.jsx).
// ------------------------------------------------------------

// Lessons, short to write: [title, kind, resources?]
//   kind: 'video' | 'text' | 'pdf'
//   resources: [[name, ext, type, bytes]]
let n = 0;
const lesson = (title, kind = 'video', resources = []) => {
  n += 1;
  const id = `ex-les-${n}`;
  const content =
    kind === 'text'
      ? { kind: 'text', html: `<p>${title}</p>` }
      : { kind, fileId: `file:ex-${n}`, name: `${title}.${kind === 'pdf' ? 'pdf' : 'mp4'}`, ext: kind === 'pdf' ? 'PDF' : 'MP4', bytes: 0 };
  return {
    id,
    title,
    content,
    description: '',
    resources: resources.map(([name, ext, type, bytes], i) => ({ id: `${id}-res-${i}`, fileId: `file:ex-${n}-${i}`, name, ext, type, bytes })),
  };
};

const section = (id, title, lessons) => ({ id, title, lessons });

export const EXAMPLE_COURSE = {
  id: 'course-example',
  title: 'Yoga for Everyday Strength: 30 Days to a Steadier Body and Calmer Mind',
  subtitle: 'Asana, breathwork and meditation in 20-minute sessions you can do at home, before work',
  status: 'published',
  cover: { src: '/course-yoga.jpg', name: 'course-yoga.jpg' },
  updatedAt: '2026-10-28T09:00:00.000Z',
  outcomes: [
    'Build a 20-minute daily practice you’ll actually keep, with a plan for each of the 30 days',
    'Move safely through 40 key postures, with an easier and a harder version of each',
    'Use three breathing techniques to calm yourself down in under five minutes',
    'Ease the back, neck and hip stiffness that comes from long days at a desk',
    'Put together your own short flows for mornings, evenings and low-energy days',
    'Sit for a 10-minute meditation without fidgeting or losing track',
    'Know which postures to skip or change if you have a sore back, knees or wrists',
    'Wind down at night with a 15-minute Yoga Nidra practice for deeper sleep',
  ],
  requirements: [
    'A yoga mat, or a folded blanket on a non-slip floor',
    'No experience needed: every posture starts from the very beginning',
    'If you’re recovering from an injury or are pregnant, check with your doctor first',
  ],
  audience: [
    'Complete beginners who want a calm, step-by-step start',
    'People with desk jobs and stiff backs, necks or hips',
    'Anyone who’s tried yoga videos before but never stuck with them',
    'Runners and gym-goers who want better mobility and fewer niggles',
  ],
  description:
    '<p>Most people who try yoga at home give up within a week. Not because yoga is hard, but because a random video every few days doesn’t add up to anything. This course gives you a plan: one short session a day, for 30 days, each one building on the last.</p>' +
    '<p>We start with the foundations, breath and alignment, so every posture after them feels steady and safe. Then we build strength standing up, open up the hips, hamstrings and back on the floor, and finish each week with breathwork and meditation to calm the mind. Every posture comes with an easier and a harder version, so it works whatever your body is like today.</p>' +
    '<p>By day 30 you’ll have a practice of your own: you’ll know how to put together a 20-minute flow for the morning, a gentle one for the evening, and a breathing exercise for the moments in between. No flexibility needed to start. Just a mat, twenty minutes and a little patience.</p>',
  contractIds: [],
  sections: [
    section('ex-sec-1', 'Start here', [
      lesson('Welcome: how this course works'),
      lesson('Setting up your space at home'),
      lesson('Your 30-day plan', 'pdf', [['30-day-practice-tracker.pdf', 'PDF', 'document', 420000]]),
    ]),
    section('ex-sec-2', 'Foundations: breath and alignment', [
      lesson('The full yogic breath'),
      lesson('Finding a neutral spine'),
      lesson('Mountain pose: the posture behind every posture'),
      lesson('Hands, feet and the floor'),
      lesson('How to make any posture easier or harder', 'text'),
      lesson('Five alignment mistakes, and how to fix them'),
      lesson('Foundations flow: 15 minutes', 'video', [['foundations-posture-guide.pdf', 'PDF', 'document', 1800000]]),
    ]),
    section('ex-sec-3', 'Standing strength', [
      lesson('Warrior I and Warrior II'),
      lesson('Triangle and extended side angle'),
      lesson('Chair pose and its variations'),
      lesson('Balancing: tree and eagle'),
      lesson('Sun salutation A, step by step'),
      lesson('Sun salutation B'),
      lesson('Standing flow: 20 minutes', 'video', [['morning-flow-checklist.pdf', 'PDF', 'document', 260000]]),
    ]),
    section('ex-sec-4', 'Floor and flexibility', [
      lesson('Cat-cow and spinal waves'),
      lesson('Hips: low lunge and lizard'),
      lesson('Hamstrings without the strain'),
      lesson('Gentle backbends: sphinx and bridge'),
      lesson('Twists for a stiff back'),
      lesson('Yoga at your desk', 'text', [['desk-stretches-printable.pdf', 'PDF', 'document', 640000]]),
      lesson('Floor flow: 20 minutes'),
    ]),
    section('ex-sec-5', 'Breath and meditation', [
      lesson('Box breathing for stressful moments'),
      lesson('Alternate nostril breathing'),
      lesson('Cooling breath for hot days'),
      lesson('Your first 10-minute meditation'),
      lesson('Body scan'),
      lesson('Yoga Nidra for sleep: 15 minutes', 'video', [['yoga-nidra-for-sleep.mp3', 'MP3', 'other', 14000000]]),
      lesson('Breathwork cheat sheet', 'pdf'),
    ]),
    section('ex-sec-6', 'Your 30-day plan', [
      lesson('Week 1: building the habit', 'text'),
      lesson('Week 2: adding strength'),
      lesson('Week 3: going deeper'),
      lesson('Week 4: your own sequence'),
      lesson('How to build your own flow', 'text', [['build-your-own-flow-worksheet.pdf', 'PDF', 'document', 380000]]),
      lesson('What to do after day 30'),
    ]),
  ],
};

export const EXAMPLE_INSTRUCTOR = {
  name: 'Meera Joshi',
  photo: '/meera.jpg',
  headline: 'Yoga teacher (500-hour RYT) and coach',
  bio:
    'I’ve taught yoga for 12 years, first in a small studio in Pune and now online, to students in 14 countries. ' +
    'I trained in Hatha and Vinyasa in Rishikesh, and before that I spent a decade in corporate HR, so I know exactly what long days at a desk do to a back.\n\n' +
    'My classes are slow, clear and practical. You don’t need to be flexible, and you don’t need an hour: just twenty minutes, a mat, and the willingness to show up again tomorrow.',
  stats: { students: 2840, courses: 3, rating: 4.8, reviews: 212 },
};

// What the Buy box shows. href '#': the example's Buy now goes nowhere.
export const EXAMPLE_OFFER = { state: 'buy', href: '#', free: false, amount: '₹2,499', compare: '₹4,999', monthly: false };

export const EXAMPLE_RATING = { average: 4.8, count: 126, students: 1240 };

// Mixed lengths and a few 4s, as real reviews are; all 5s reads as fake
export const EXAMPLE_REVIEWS = [
  {
    id: 'ex-rev-1',
    name: 'Ananya R.',
    stars: 5,
    when: '1 week ago',
    text: 'I’ve started yoga at least five times and never lasted. The 30-day plan is what made the difference: I always knew what today’s session was, and 20 minutes is short enough that I had no excuse. Day 30 was last Sunday.',
  },
  {
    id: 'ex-rev-2',
    name: 'Rohit S.',
    stars: 5,
    when: '2 weeks ago',
    text: 'My lower back used to hurt by 4 pm every day. Two weeks of the floor flows and it’s mostly gone.',
  },
  {
    id: 'ex-rev-3',
    name: 'Kavya M.',
    stars: 4,
    when: '3 weeks ago',
    text: 'Clear and calm teaching, and I love that every pose has an easier version. I’d have liked a couple more evening flows, but the Yoga Nidra lesson alone is worth it. I sleep better.',
  },
  {
    id: 'ex-rev-4',
    name: 'Daniel K.',
    stars: 5,
    when: '1 month ago',
    text: 'As a runner I needed mobility, not spirituality, and this delivers. Practical, no fluff.',
  },
  {
    id: 'ex-rev-5',
    name: 'Priya N.',
    stars: 5,
    when: '1 month ago',
    text: 'Meera explains alignment better than any studio teacher I’ve had. The “five alignment mistakes” lesson fixed things I’d been doing wrong for years.',
  },
  {
    id: 'ex-rev-6',
    name: 'Sameer T.',
    stars: 4,
    when: '2 months ago',
    text: 'Good structure and lovely pacing. Some of the standing poses were hard for me at first, but the easier versions helped and I’m getting there.',
  },
  {
    id: 'ex-rev-7',
    name: 'Laura B.',
    stars: 5,
    when: '2 months ago',
    text: 'Box breathing before meetings has honestly changed my work days. Didn’t expect that from a yoga course.',
  },
  {
    id: 'ex-rev-8',
    name: 'Neha G.',
    stars: 5,
    when: '3 months ago',
    text: 'Perfect for a total beginner. Nothing felt rushed and I never felt silly.',
  },
];