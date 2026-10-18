import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getMyProfile } from '../data/myProfile';
import './EditService.css';

// ------------------------------------------------------------
// Editing one offering, opened from its card on the offerings home,
// or making a new one (serviceId null, from "Add a new offering").
// A placeholder for now: shows which one, and the way back.
// ------------------------------------------------------------
export default function EditService({ answers, serviceId, onBack }) {
  const service = useMemo(
    () => (serviceId ? getMyProfile(answers).services.find((s) => s.id === serviceId) ?? null : null),
    [answers, serviceId],
  );
  const adding = !serviceId;

  return (
    <div className="es">
      <button type="button" className="es__back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Your offerings page
      </button>
      <h1 className="es__title">{adding ? 'Add a new offering' : service?.title || 'Edit offering'}</h1>
      <p className="es__soon">
        {adding ? 'Adding offerings from here is on its way.' : 'The editor for this offering is on its way.'}
      </p>
    </div>
  );
}