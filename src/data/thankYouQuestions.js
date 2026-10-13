// ------------------------------------------------------------
// Thank you page: whether people join a group after signing up,
// and on which app. That's the only part that changes from one
// webinar to the next; the rest of the page comes from answers
// they've already given.
//
// Answers are stored flat, like the landing page ones:
//   groupApp:  one of GROUP_OPTIONS (below)
//   groupLink: the group's invite link (not asked when there's no group)
// ------------------------------------------------------------

export const GROUP_OPTIONS = {
  whatsapp: 'Yes, on WhatsApp',
  telegram: 'Yes, on Telegram',
  none: 'No group',
};

// The link as they pasted it, minus spaces. A missing https:// is fine
// here; add it when building the page.
const clean = (value) => String(value ?? '').trim();

const withoutScheme = (link) => link.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

// Each returns an error message, or null when the link looks right
function checkWhatsApp(value) {
  const link = withoutScheme(clean(value));
  if (/^chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(link)) return null;
  if (/^(wa\.me|api\.whatsapp\.com)\//i.test(link)) {
    return "That's a chat with one person, not a group. In WhatsApp, open the group, tap its name, then Invite via link.";
  }
  return "This doesn't look like a WhatsApp group link. It should start with chat.whatsapp.com/";
}

function checkTelegram(value) {
  const link = withoutScheme(clean(value));
  if (/^(t\.me|telegram\.me)\/\S+/i.test(link)) return null;
  return "This doesn't look like a Telegram link. It should start with t.me/";
}

export const thankYouQuestions = [
  {
    id: 'groupApp',
    reviewLabel: 'Group',
    section: 'thankYou',
    type: 'choice',
    question: 'Do you want people to join a group after signing up?',
    options: Object.values(GROUP_OPTIONS),
    default: GROUP_OPTIONS.whatsapp,
    required: true,
  },

  // One screen; its wording and check follow the app picked above.
  // Skipped when there's no group.
  {
    id: 'groupLink',
    reviewLabel: 'Group link',
    section: 'thankYou',
    type: 'text',
    inputMode: 'url',
    showIf: { field: 'groupApp', in: [GROUP_OPTIONS.whatsapp, GROUP_OPTIONS.telegram] },
    variantsBy: 'groupApp',
    variants: {
      [GROUP_OPTIONS.whatsapp]: {
        question: 'Paste your WhatsApp group invite link',
        helper: 'In WhatsApp, open the group, tap its name, then Invite via link.',
        example: 'https://chat.whatsapp.com/AbC123xyz',
        validate: checkWhatsApp,
        setupSteps: [
          'In WhatsApp, tap New group, add yourself, and give it a name.',
          'Open the group, tap its name, then Invite via link.',
          'Tap Copy link and paste it here.',
        ],
      },
      [GROUP_OPTIONS.telegram]: {
        question: 'Paste your Telegram group link',
        helper: 'In Telegram, open the group, tap its name, then Invite link.',
        example: 'https://t.me/+AbC123xyz',
        validate: checkTelegram,
        setupSteps: [
          'In Telegram, tap the pencil icon, then New Group. Give it a name.',
          'Open the group, tap its name, then Invite link.',
          'Copy the link and paste it here.',
        ],
      },
    },
    nextHint: 'Paste your link to continue',
    // Not ready yet? They can finish without it; the overview then flags it
    setupTitle: "Don't have a group yet?",
    laterLabel: "I'll add it later",
    required: true,
  },
];

// They want a group but the link is empty or doesn't pass its check
export function groupLinkMissing(answers) {
  const app = answers.groupApp;
  if (app === GROUP_OPTIONS.whatsapp) return checkWhatsApp(answers.groupLink) !== null;
  if (app === GROUP_OPTIONS.telegram) return checkTelegram(answers.groupLink) !== null;
  return false;
}

// For the overview card: "WhatsApp group" with its link, or "No group".
// missing: they want a group but haven't added a working link yet.
export function joinSummary(answers) {
  const app = answers.groupApp;
  if (!app) return null;
  if (app === GROUP_OPTIONS.none) return { label: 'No group', link: null, missing: false };
  const label = app === GROUP_OPTIONS.telegram ? 'Telegram group' : 'WhatsApp group';
  const missing = groupLinkMissing(answers);
  return { label, link: missing ? null : clean(answers.groupLink), missing };
}