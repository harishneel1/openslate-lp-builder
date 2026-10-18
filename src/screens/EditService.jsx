import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import EditFrame, { EditPanel, EditPlaceholder, useEditDraft } from './EditFrame';
import CallDetailsInput, { ShortDescriptionField } from '../components/CallDetailsInput';
import CallAboutInput from '../components/CallAboutInput';
import { MY_CALL_ID } from '../data/myProfile';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { CALL_DEFAULTS, callAboutOf, callDescriptionOf, callDetailsComplete } from '../data/callDetails';
import '../components/QuestionInput.css'; // field styles the call details use
import './EditService.css';

// The call's answers this screen edits. Anything else in the answers is left alone.
const FIELDS = [
  'callTitle',
  'callDuration',
  'callFormat',
  'callPricing',
  'callPrice',
  'callComparePrice',
  'callDescription',
  'callAbout',
];

// ------------------------------------------------------------
// Editing one offering, opened from its card on the offerings home:
// Basics (name, length, format, price) and Descriptions (short and long).
// Changes stay on this screen until Save (see EditFrame.jsx).
//
// serviceId null: "Add a new offering" (a placeholder for now).
// onSave(changes): merges the changed answers into the saved ones.
// ------------------------------------------------------------
export default function EditService({ answers, serviceId, onBack, onSave }) {
  if (!serviceId) {
    return <EditPlaceholder title="Add a new offering" sub="Adding offerings from here is on its way." onBack={onBack} />;
  }
  return <EditCall answers={answers} onBack={onBack} onSave={onSave} />;
}

function EditCall({ answers, onBack, onSave }) {
  // What's saved, with the starting choices filled in, so the form opens unchanged.
  // The short description is fixed to what's on the page now: during setup it
  // follows the name, but renaming a live call shouldn't rewrite its description.
  const saved = useMemo(
    () => ({ ...CALL_DEFAULTS, ...answers, callDescription: callDescriptionOf(answers) }),
    [answers],
  );
  const edit = useEditDraft(saved, FIELDS);
  const { draft, formKey, handleChange } = edit;

  // What's stopping a save, if anything
  const problem = !callDetailsComplete(draft)
    ? 'Add a name and a price (or make it free) to save'
    : callAboutOf(draft).trim() === ''
      ? 'Add a long description to save'
      : null;

  const save = () => {
    if (!edit.dirty || problem) return;
    const changes = edit.changes();
    // Still following the name? Keep the text that's showing, so a rename doesn't change it
    if (answers.callDescription === undefined && !('callDescription' in changes)) {
      changes.callDescription = saved.callDescription;
    }
    onSave(changes);
    edit.saved();
  };

  return (
    <EditFrame
      edit={edit}
      title={saved.callTitle || 'Your call'}
      sub="Changes show up on your page once you save them."
      onBack={onBack}
      onSave={save}
      problem={problem}
      viewHref={pageUrl(saved.handle)}
    >
      <EditPanel id="es-basics" title="Basics" sub="The name, length, format and price people see before they book.">
        <CallDetailsInput key={formKey} answers={draft} onChange={handleChange} showDescription={false} />
      </EditPanel>

      <EditPanel
        id="es-descriptions"
        title="Descriptions"
        sub="What people read about your call before they book."
        className="es__fields"
      >
        <ShortDescriptionField
          key={`short-${formKey}`}
          answers={draft}
          onChange={handleChange}
          note={
            <WhereItShows
              text="Shows on your call’s card at"
              href={pageUrl(saved.handle)}
              label={`${PAGE_DOMAIN}/${saved.handle}`}
            />
          }
        />
        <CallAboutInput
          key={`about-${formKey}`}
          answers={draft}
          onChange={handleChange}
          label="Long description"
          showNote={false}
          note={<WhereItShows text="Shows on" href={BOOKING_HREF} label="your booking page" />}
        />
      </EditPanel>
    </EditFrame>
  );
}

// Their call's booking page (the same link as Preview on the offerings home)
const BOOKING_HREF = `?mock=book&service=${MY_CALL_ID}`;

// One line under a description: where it shows, with a link to see it.
// The link opens the live page, so it shows what's saved.
function WhereItShows({ text, href, label }) {
  return (
    <span className="es__where">
      {text}{' '}
      <a href={href} target="_blank" rel="noopener">
        {label}
        <ExternalLink size={13} aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </span>
  );
}