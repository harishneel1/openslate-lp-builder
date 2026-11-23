import { useState } from 'react';
import EditFrame, { EditPanel, useEditDraft } from './EditFrame';
import ContractPicker from '../components/ContractPicker';
import {
  DescriptionField,
  MeetingField,
  CreateContractLink,
  ThumbnailField,
  TitleField,
  WHO_CAN_JOIN,
  classProblem,
  contractsProblem,
} from '../components/BatchFields';
import { tidyMeeting } from '../data/batches';
import { storeBatch } from '../data/batchSave';
import '../components/QuestionInput.css';

// ------------------------------------------------------------
// A class's editor, from Edit on its row or its page. The same fields as
// Create a class (BatchFields.jsx), every section open, in one column,
// with the save bar every editor has (EditFrame.jsx), as a 1:1 call's:
//
//   Title and thumbnail
//   Meeting         always Zoom (shown, nothing to change)
//   Who can join    the linked contracts
//   Description
//
// Its classes' dates and times are on its page (Classes tab), not here.
// Linking or unlinking a
// contract changes who can join straight away; the contracts themselves
// are changed on the Contracts page.
//
// batch: the saved class. exitRef: the focus bar's way back (asks first
// about unsaved changes). onBack(): back to the class's page.
// onSaved(batch): after a save.
// ------------------------------------------------------------

const FIELDS = ['title', 'thumbnail', 'meeting', 'contractIds', 'description'];

export default function EditBatch({ batch, exitRef, onBack, onSaved }) {
  const edit = useEditDraft(batch, FIELDS);
  const { draft } = edit;
  const [failed, setFailed] = useState(false);

  const change = (field, value) => edit.handleChange(value, field);
  const problem = classProblem(draft);

  const save = () => {
    if (problem) return;
    const stored = storeBatch({
      ...batch,
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      meeting: tidyMeeting(),
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
      sub="Changes show on your class’s page as soon as you save."
      onBack={onBack}
      onSave={save}
      problem={edit.dirty ? problem : null}
      message={failed ? 'We couldn’t save in this browser. Free up some space and try again.' : null}
      backLabel="Your class"
      exitRef={exitRef}
    >
      <EditPanel id="eb-about" title="Title and thumbnail">
        <div key={`about-${edit.formKey}`} className="es__fields">
          <TitleField value={draft} onChange={change} showProblem />
          <ThumbnailField value={draft} onChange={change} />
        </div>
      </EditPanel>

      <EditPanel id="eb-meeting" title="Meeting">
        <MeetingField />
      </EditPanel>

      <EditPanel
        id="eb-who"
        title="Who can join"
        sub={WHO_CAN_JOIN}
      >
        <div key={`who-${edit.formKey}`} className="es__fields">
          <CreateContractLink />
          <ContractPicker value={draft.contractIds} onChange={(ids) => change('contractIds', ids)} />
          {contractsProblem(draft) && (
            <span className="qinput__error" role="alert">
              {contractsProblem(draft)}
            </span>
          )}
        </div>
      </EditPanel>

      <EditPanel id="eb-description" title="Description">
        <div key={`description-${edit.formKey}`} className="es__fields">
          <DescriptionField value={draft} onChange={change} />
        </div>
      </EditPanel>
    </EditFrame>
  );
}
