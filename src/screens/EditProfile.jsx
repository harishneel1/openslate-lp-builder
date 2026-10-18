import { useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import EditFrame, { EditPanel, useEditDraft } from './EditFrame';
import QuestionInput from '../components/QuestionInput';
import HandleInput from '../components/HandleInput';
import { myPageQuestions } from '../data/myPageQuestions';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import '../components/QuestionInput.css';
import './EditProfile.css';

// The same questions as setup, so the fields and their rules match exactly
const ABOUT = myPageQuestions.find((q) => q.id === 'about'); // photo, name, bio
const LINK = myPageQuestions.find((q) => q.id === 'handle');

const FIELDS = ['photo', 'name', 'bio', 'handle'];

const filled = (v) => String(v ?? '').trim() !== '';

// ------------------------------------------------------------
// Editing their profile, from the "Your profile" panel on the
// offerings home: photo, name and bio, and the link to their page.
// Changes stay on this screen until Save (see EditFrame.jsx).
// A new link asks first: the old one stops working.
// ------------------------------------------------------------
export default function EditProfile({ answers, onBack, onSave }) {
  const saved = useMemo(() => ({ ...answers }), [answers]);
  const edit = useEditDraft(saved, FIELDS);
  const { draft, formKey } = edit;
  const [confirming, setConfirming] = useState(false); // "Change your link?" showing

  const linkError = LINK.validate(draft.handle ?? '');
  const problem = !filled(draft.name)
    ? 'Add your name to save'
    : !filled(draft.bio)
      ? 'Add a few lines about you to save'
      : linkError
        ? 'Fix your link to save'
        : null;

  const linkChanged = draft.handle !== saved.handle;

  // Any edit closes the "Change your link?" question
  const handleChange = (value, id) => {
    setConfirming(false);
    edit.handleChange(value, id);
  };

  const commit = () => {
    onSave(edit.changes());
    edit.saved();
    setConfirming(false);
  };

  const save = () => {
    if (!edit.dirty || problem) return;
    if (linkChanged) setConfirming(true);
    else commit();
  };

  return (
    <EditFrame
      edit={edit}
      title="Your profile"
      sub="Changes show up on your page once you save them."
      onBack={onBack}
      onSave={save}
      problem={problem}
      viewHref={pageUrl(saved.handle)}
      confirm={
        confirming
          ? {
              title: 'Change your link?',
              body: <LinkChange from={saved.handle} to={draft.handle} />,
              confirmLabel: 'Change link',
              onConfirm: commit,
              onCancel: () => setConfirming(false),
            }
          : null
      }
    >
      <EditPanel id="ep-about" title="Who you are" sub="The top of your page: the first thing visitors read.">
        <QuestionInput key={formKey} question={ABOUT} answers={draft} onChange={handleChange} />
      </EditPanel>

      <EditPanel
        id="ep-link"
        title="Your link"
        sub="The link you share so people can find your page. If you change it, your old link stops working."
      >
        <HandleInput
          key={formKey}
          question={LINK}
          value={draft.handle ?? ''}
          error={linkError}
          onChange={(v) => handleChange(v, 'handle')}
          onSubmit={() => {}}
          autoFocus={false}
          current={saved.handle}
        />
      </EditPanel>
    </EditFrame>
  );
}

// Old link (crossed out) → new link, with only the part after the slash
// in bold, since that's all that changes. Then what it means for them.
function LinkChange({ from, to }) {
  return (
    <>
      <div className="ep-change">
        <p className="ep-change__link ep-change__link--old">
          <span className="sr-only">From </span>
          <s>
            <span className="ep-change__domain">{PAGE_DOMAIN}/</span>
            <span className="ep-change__handle">{from}</span>
          </s>
        </p>
        <ArrowDown className="ep-change__arrow" size={18} aria-hidden="true" />
        <p className="ep-change__link ep-change__link--new">
          <span className="sr-only">to </span>
          <span className="ep-change__domain">{PAGE_DOMAIN}/</span>
          <strong className="ep-change__handle">{to}</strong>
        </p>
      </div>
      <p className="ep-change__note">
        Anyone who opens your old link will see “page not found”. Update it in your Instagram bio and anywhere else
        you’ve shared it.
      </p>
    </>
  );
}