import { useMemo, useState } from 'react';
import EditFrame, { EditPanel, useEditDraft } from './EditFrame';
import QuestionsInput from '../components/QuestionsInput';
import { FeeField, ScheduleFields, feeProblem, scheduleProblem } from '../components/BatchFields';
import { DESCRIPTION_MAX, TITLE_MAX } from '../data/batches';
import { storeBatch } from '../data/batchSave';
import { cleanQuestions, questionsProblem } from '../data/callQuestions';
import '../components/QuestionInput.css';

// ------------------------------------------------------------
// A batch's editor, from Edit on its row or its page. Every section open,
// in one column, with the save bar every editor has (EditFrame.jsx):
//
//   Name and description
//   Schedule        days, start time, length (BatchFields.jsx)
//   Monthly fee     what people who join from now pay
//   Questions       what they're asked before joining
//
// Saving writes the batch and its contract together (storeBatch), so the
// batch's page, its join page and its contract all show the change.
//
// Round 1: a new fee is what people pay when they join from now on.
// What members already in the batch pay at their next renewal comes with
// renewals, in round 2.
//
// batch: the saved batch. exitRef: the focus bar's way back (asks first
// about unsaved changes). onBack(): back to the batch's page.
// onSaved(batch): after a save.
// ------------------------------------------------------------

const FIELDS = ['title', 'description', 'days', 'startTime', 'durationMins', 'price', 'questions'];

export default function EditBatch({ batch, exitRef, onBack, onSaved }) {
  // The fee is typed as text, so the saved one is text here too
  const saved = useMemo(() => ({ ...batch, price: String(batch.price) }), [batch]);
  const edit = useEditDraft(saved, FIELDS);
  const { draft } = edit;
  const [failed, setFailed] = useState(false);

  const change = (field, value) => edit.handleChange(value, field);

  const problem = !draft.title.trim()
    ? 'Give your batch a name.'
    : scheduleProblem(draft) ?? feeProblem(draft.price) ?? questionsProblem(draft.questions)?.text ?? null;

  const save = () => {
    if (problem) return;
    const stored = storeBatch({
      ...batch,
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      price: Number(draft.price),
      questions: cleanQuestions(draft.questions),
    });
    if (!stored) {
      setFailed(true);
      return;
    }
    setFailed(false);
    edit.saved();
    onSaved?.(stored);
  };

  return (
    <EditFrame
      edit={edit}
      title={`Edit ${batch.title}`}
      sub="Changes show on your batch’s page and its contract when you save."
      onBack={onBack}
      onSave={save}
      problem={edit.dirty ? problem : null}
      message={failed ? 'We couldn’t save in this browser. Free up some space and try again.' : null}
      backLabel="Your batch"
      exitRef={exitRef}
    >
      <EditPanel id="eb-about" title="Name and description">
        <div key={`about-${edit.formKey}`} className="es__fields">
          <label className="qinput__field">
            <span className="qinput__label">Name</span>
            <input
              className="qinput__text qinput__field-input"
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(e) => change('title', e.target.value)}
            />
          </label>
          <label className="qinput__field">
            <span className="qinput__label">Description</span>
            <textarea
              className="qinput__text qinput__field-input qinput__field-input--long"
              rows={6}
              value={draft.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => change('description', e.target.value)}
            />
          </label>
        </div>
      </EditPanel>

      <EditPanel id="eb-schedule" title="Schedule" sub="Classes from now on follow the new times.">
        <ScheduleFields key={`schedule-${edit.formKey}`} value={draft} onChange={change} showProblem />
      </EditPanel>

      <EditPanel id="eb-fee" title="Monthly fee" sub="What people who join from now on pay.">
        <FeeField key={`fee-${edit.formKey}`} value={draft} onChange={change} showProblem />
      </EditPanel>

      <EditPanel
        id="eb-questions"
        title="Questions before they join"
        sub="We always ask their name, email and phone. Members who already joined keep the answers they gave."
      >
        <QuestionsInput
          key={`questions-${edit.formKey}`}
          value={draft.questions}
          onChange={(list) => change('questions', list)}
        />
      </EditPanel>
    </EditFrame>
  );
}