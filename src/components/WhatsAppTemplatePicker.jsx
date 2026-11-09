import { useState } from 'react';
import { Plus } from 'lucide-react';
import Drawer from './Drawer';
import { PhoneMessage, sampleValuesFor } from './WhatsAppMessages';
import { goToWhatsAppSettings } from '../data/whatsappConnection';
import { isLegacy, messageFor, momentById, pickableOf } from '../data/whatsappTemplates';
import '../screens/EditFrame.css'; // es__btn, for the panel's buttons
import './WhatsAppTemplatePicker.css';

// ------------------------------------------------------------
// Which template one of a webinar's or a call's WhatsApp messages sends,
// opened from "Change" on its row (WhatsAppMessages.jsx): our default,
// and the coach's approved templates made for that same message (a
// 24-hour row lists only 24-hour ones):
//
//   Change the 24 hours before message                            ✕
//   ────────────────────────────────────────────────────────────────
//   ◉ call_24h_reminder   Our default           ┌──────────────┐
//   Yours                                       │ the selected │
//   ○ discovery_call_24h_reminder               │ one on a     │
//   ○ call_24h_reminder_1                       │ phone, kept  │
//   1 more isn’t approved by Meta yet …         │ in view      │
//                                               └──────────────┘
//   + Create a new template
//   ────────────────────────────────────────────────────────────────
//                                        Cancel   [Use this message]
//
// The phone sits beside the options, as in the template editor, so every
// pick shows at once. Too narrow for both, it goes above the options.
//
// Only approved ones can be picked: Meta lets nothing else go out. One
// for this message that isn't yet is counted, so the coach knows why it
// isn't listed.
// "Create a new template" opens Settings → WhatsApp → Templates on a new
// one for this message.
//
// kind: 'call' | 'webinar'
// momentId: the message being changed ('call-24h')
// current: the picked template's id, or null for our default
// own: all the coach's templates
// connection, offeringName, links: for the preview
// onUse(templateId | null), onClose()
// ------------------------------------------------------------

export default function WhatsAppTemplatePicker({
  kind,
  momentId,
  current,
  own,
  connection,
  offeringName,
  links,
  onUse,
  onClose,
}) {
  const moment = momentById(momentId);
  // Only templates made for this message: a 24-hour row lists 24-hour ones
  const pickable = pickableOf(own, kind).filter((t) => t.moment === momentId);
  const waiting = own.filter(
    (t) =>
      !isLegacy(t) && t.product === kind && t.moment === momentId && ['draft', 'review', 'rejected'].includes(t.status),
  ).length;
  // A pick that's gone (deleted, or no longer approved) shows as our default
  const start = pickable.some((t) => t.id === current) ? current : null;
  const [chosen, setChosen] = useState(start);
  const shown = messageFor(momentId, chosen ? { [momentId]: chosen } : {}, own);

  const option = (id, name, note) => (
    <label key={id ?? 'ours'} className={`wtk-pick ${chosen === id ? 'wtk-pick--on' : ''}`}>
      <input
        type="radio"
        name="wtk-pick"
        className="wtk-pick__radio"
        checked={chosen === id}
        onChange={() => setChosen(id)}
      />
      <span className="wtk-pick__name">{name}</span>
      {note && <span className="wtk-pick__note">{note}</span>}
    </label>
  );

  return (
    <Drawer
      className="wtk-drawer"
      title={`Change the ${moment.name.toLowerCase()} message`}
      sub={moment.when}
      onClose={onClose}
      footer={
        <>
          <span />
          <div className="wtk-picker__actions">
            <button type="button" className="es__btn es__btn--quiet" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="es__btn es__btn--primary"
              disabled={chosen === start}
              onClick={() => onUse(chosen)}
            >
              Use this message
            </button>
          </div>
        </>
      }
    >
      <div className="wtk-picker__layout">
        <fieldset className="wtk-picker">
          <legend className="wtk-picker__legend">Which template it sends</legend>

          {option(null, moment.template, 'Our default')}

          {pickable.length > 0 && (
            <>
              <p className="wtk-picker__group">Yours</p>
              {pickable.map((t) => option(t.id, t.name))}
            </>
          )}

          {pickable.length === 0 && (
            <p className="wtk-picker__empty">
              You haven’t got an approved template of your own for {moment.name.toLowerCase()} yet.
            </p>
          )}
          {waiting > 0 && (
            <p className="wtk-picker__waiting">
              {waiting === 1 ? '1 more of yours isn’t' : `${waiting} more of yours aren’t`} approved by Meta yet, so{' '}
              {waiting === 1 ? 'it can’t' : 'they can’t'} be picked.
            </p>
          )}

          <button
            type="button"
            className="wtk-picker__create"
            onClick={() => goToWhatsAppSettings({ page: 'whatsapp-templates', create: { product: kind, moment: momentId } })}
          >
            <Plus size={16} aria-hidden="true" />
            Create a new template
          </button>
        </fieldset>

        {/* Beside the options, and kept in view as they scroll: every pick shows here at once */}
        <aside className="wtk-picker__phone" aria-label="Preview" aria-live="polite">
          <p className="wtk-picker__legend">What students get</p>
          <PhoneMessage
            message={shown}
            kind={kind}
            sender={connection.name}
            values={sampleValuesFor(kind, connection, offeringName)}
            links={links}
          />
        </aside>
      </div>
    </Drawer>
  );
}