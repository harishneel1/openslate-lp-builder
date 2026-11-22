import { useRef, useState } from 'react';
import { ExternalLink, FileText, Loader2, Upload } from 'lucide-react';
import {
  BUSINESS_TYPES,
  COUNTRY,
  DOCUMENTS,
  DOC_FILE_TYPES,
  DOC_MAX_MB,
  GET_REGISTERED,
  STATES,
  addressHint,
  addressLine,
  businessTypeOf,
  docsFor,
  docsSentence,
  editBusiness,
  legalNameHint,
} from '../data/whatsappBusiness';
import { readPhoto } from '../utils/readPhoto';
import './WhatsAppBusinessForm.css';

// ------------------------------------------------------------
// Settings → WhatsApp, before connecting: the coach's business, as Meta
// will verify it (data/whatsappBusiness.js). WhatsAppSettings.jsx shows
// these pieces, one step at a time:
//
//   BusinessType     step 1, "What kind of business are you?", with the
//                    documents that type can use under it
//   IndividualNote   under it, for an individual with no registration:
//                    Meta verifies businesses, not people, so GST or MSME first
//   BusinessDetails  step 2: one document from that type's list, the legal
//                    name and address exactly as on it
//   BusinessSummary  step 4 (Review), and the connected screen's side
//                    panel: the same details, read-only
//
//   Step 2, BusinessDetails:
//   │ Which document will you upload?  [GST certificate ▾]│
//   │ ┌ ⤒ Upload a photo or PDF ┐                         │
//   │ Legal business name  [                       ]      │
//   │   Exactly as on your GST certificate.               │
//   │ Registered address                                  │
//   │   Building, street   [                       ]      │
//   │   Area (optional)    [                       ]      │
//   │   City [        ]   State [            ▾]           │
//   │   PIN code [      ] Country  India                  │
//
// Everything is saved as it's typed (editBusiness), so leaving and coming
// back keeps it. Nothing comes from Payment details: this starts empty.
// A problem shows once its field has been left.
// ------------------------------------------------------------

// ---------- What kind of business are you? ----------
// record: the saved details; onDropped(label): choosing another type took
// off a document that doesn't fit it
export function BusinessType({ record, onDropped, error }) {
  const choose = (type) => {
    const { dropped } = editBusiness({ type });
    if (dropped) onDropped(dropped);
  };
  const docs = record.type && record.type !== 'individual' ? docsSentence(record.type) : null;

  return (
    <fieldset className="wab-type" aria-describedby="wab-type-docs">
      <legend className="wab-type__q" id="wab-type-label">
        What kind of business are you?
      </legend>
      <div className="wab-type__grid" id="wab-type">
        {BUSINESS_TYPES.map((t) => {
          const on = record.type === t.id;
          return (
            <label key={t.id} className={`po-kind__option wab-type__option ${on ? 'po-kind__option--on' : ''}`}>
              <input type="radio" name="wab-type" value={t.id} checked={on} onChange={() => choose(t.id)} />
              <span>
                <span className="po-kind__name">{t.label}</span>
                <span className="po-kind__sub">{t.sub}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="wab-type__docs" id="wab-type-docs" aria-live="polite">
        {error ? (
          <span className="po-field__error">{error}</span>
        ) : docs ? (
          <>
            You’ll need one of these: <strong>{docs}</strong>.
          </>
        ) : record.type === 'individual' ? null : (
          'This decides which documents you can use.'
        )}
      </p>
    </fieldset>
  );
}

// ---------- An individual, with nothing registered ----------
// Not an error: the way forward, and that emails keep going meanwhile
export function IndividualNote() {
  return (
    <div className="wab-solo" role="status">
      <h3 className="wab-solo__title">Meta verifies businesses, not individuals</h3>
      <p className="wab-solo__text">
        To send WhatsApp reminders, you need a business registration in your name. Get one of these first:
      </p>
      <ul className="wab-solo__list">
        {GET_REGISTERED.map((g) => (
          <li key={g.label}>
            {g.href ? (
              <a className="wab-solo__link" href={g.href} target="_blank" rel="noreferrer">
                {g.label}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : (
              <strong>{g.label}</strong>
            )}
            <span className="wab-solo__why">{g.text}</span>
          </li>
        ))}
      </ul>
      <p className="wab-solo__text">
        Once you have it, choose <strong>Sole proprietor</strong> above. Your email reminders keep going out meanwhile.
      </p>
    </div>
  );
}

// ---------- Your business details ----------
// record: the saved details (a business, not an individual)
// problems: businessProblems(record)
// dropped: the label of a document just taken off by a change of type
export function BusinessDetails({ record, problems, dropped }) {
  const [left, setLeft] = useState({}); // fields they've been in and left
  const leave = (field) => () => setLeft((l) => ({ ...l, [field]: true }));
  const show = (field) => (left[field] ? problems[field] : null);
  const docs = docsFor(record.type);
  const doc = DOCUMENTS[record.docType];
  const set = (field) => (e) => editBusiness({ [field]: e.target.value });
  const setAddress = (field) => (e) => editBusiness({ address: { [field]: e.target.value } });
  const inputClass = (field) => `po-input ${show(field) ? 'po-input--error' : ''}`;

  return (
    <div className="wab">

      {dropped && (
        <p className="wab__dropped" role="status">
          Your {dropped} was removed: it isn’t used for this kind of business. Choose one from the list.
        </p>
      )}

      {/* The document first: the name and address are copied from it */}
      <div className="po-field">
        <label className="po-field__label" htmlFor="wab-docType">
          Which document will you upload?
        </label>
        <select
          id="wab-docType"
          className={`${inputClass('docType')} wab__select`}
          value={record.docType ?? ''}
          onChange={set('docType')}
          onBlur={leave('docType')}
          aria-invalid={Boolean(show('docType'))}
          aria-describedby="wab-docType-note"
        >
          <option value="" disabled>
            Choose a document
          </option>
          {docs.map((id) => (
            <option key={id} value={id}>
              {DOCUMENTS[id].label}
            </option>
          ))}
        </select>
        <p className="po-field__note" id="wab-docType-note">
          {show('docType') ? (
            <span className="po-field__error">{show('docType')}</span>
          ) : (
            (doc?.note ?? 'Any one of these is enough.')
          )}
        </p>
      </div>

      {doc && (
        <DocumentUpload
          id="wab-doc"
          label={`Your ${doc.sentence ?? doc.label}`}
          value={record.doc}
          error={show('doc')}
          onChange={(file) => editBusiness({ doc: file })}
        />
      )}

      <div className="po-field">
        <label className="po-field__label" htmlFor="wab-legalName">
          Legal business name
        </label>
        <input
          id="wab-legalName"
          className={inputClass('legalName')}
          value={record.legalName}
          maxLength={120}
          autoComplete="organization"
          onChange={set('legalName')}
          onBlur={leave('legalName')}
          aria-invalid={Boolean(show('legalName'))}
          aria-describedby="wab-legalName-note"
        />
        <p className="po-field__note" id="wab-legalName-note">
          {show('legalName') ? <span className="po-field__error">{show('legalName')}</span> : legalNameHint(record)}
        </p>
      </div>

      <fieldset className="wab__address" aria-describedby="wab-address-note">
        <legend className="po-field__label">Registered address</legend>
        <p className="po-field__note wab__address-note" id="wab-address-note">
          {addressHint(record)}
        </p>

        <Field id="wab-line1" label="Building and street" error={show('line1')}>
          <input
            id="wab-line1"
            className={inputClass('line1')}
            value={record.address.line1}
            maxLength={120}
            autoComplete="address-line1"
            onChange={setAddress('line1')}
            onBlur={leave('line1')}
            aria-invalid={Boolean(show('line1'))}
          />
        </Field>
        <Field id="wab-area" label="Area or locality (optional)">
          <input
            id="wab-area"
            className="po-input"
            value={record.address.area}
            maxLength={120}
            autoComplete="address-line2"
            onChange={setAddress('area')}
          />
        </Field>
        <div className="po-field-row wab__row">
          <Field id="wab-city" label="City" error={show('city')}>
            <input
              id="wab-city"
              className={inputClass('city')}
              value={record.address.city}
              maxLength={60}
              autoComplete="address-level2"
              onChange={setAddress('city')}
              onBlur={leave('city')}
              aria-invalid={Boolean(show('city'))}
            />
          </Field>
          <Field id="wab-state" label="State" error={show('state')}>
            <select
              id="wab-state"
              className={`${inputClass('state')} wab__select`}
              value={record.address.state}
              onChange={setAddress('state')}
              onBlur={leave('state')}
              aria-invalid={Boolean(show('state'))}
            >
              <option value="" disabled>
                Choose
              </option>
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="po-field-row wab__row">
          <Field id="wab-pin" label="PIN code" error={show('pin')}>
            <input
              id="wab-pin"
              className={inputClass('pin')}
              value={record.address.pin}
              inputMode="numeric"
              maxLength={7}
              autoComplete="postal-code"
              onChange={setAddress('pin')}
              onBlur={leave('pin')}
              aria-invalid={Boolean(show('pin'))}
            />
          </Field>
          <Field id="wab-country" label="Country">
            <input id="wab-country" className="po-input" value={COUNTRY} readOnly aria-readonly="true" />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}

// One field of the address, with its problem under it once there is one
function Field({ id, label, error = null, children }) {
  return (
    <div className="po-field">
      <label className="po-field__label wab__sublabel" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p className="po-field__note" role="alert">
          <span className="po-field__error">{error}</span>
        </p>
      )}
    </div>
  );
}

// ---------- The document: pick, drop, see, replace ----------
// As KYC's upload (IdentitySetup.jsx), with its look (po-upload). The real
// product uploads the file itself to storage.

async function readDocument(file) {
  if (!DOC_FILE_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or PDF.');
  if (file.size > DOC_MAX_MB * 1024 * 1024) throw new Error(`That file is over ${DOC_MAX_MB} MB. Choose a smaller one.`);
  if (file.type === 'application/pdf') return { name: file.name, kind: 'pdf', size: file.size, preview: null };
  const preview = await readPhoto(file, { maxSide: 720 });
  return { name: file.name, kind: 'image', size: file.size, preview };
}

const sizeLabel = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const NOTE = 'The whole page, with every corner and the name and address readable.';

function DocumentUpload({ id, label, value, onChange, error }) {
  const input = useRef(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState(null);
  const [over, setOver] = useState(false);

  const take = async (file) => {
    if (!file) return;
    setReading(true);
    setReadError(null);
    try {
      const read = await readDocument(file);
      if (!onChange(read)?.saved) setReadError('Couldn’t keep that file in this browser. Try a smaller photo or a PDF.');
    } catch (e) {
      setReadError(e.message);
    } finally {
      setReading(false);
    }
  };

  const message = readError ?? error;
  const pick = () => input.current?.click();

  return (
    <div className="po-field">
      <span className="po-field__label" id={`${id}-label`}>
        {label}
      </span>
      <input
        ref={input}
        type="file"
        accept={DOC_FILE_TYPES.join(',')}
        className="oh__sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {value ? (
        <div className={`po-upload po-upload--done ${message ? 'po-upload--error' : ''}`}>
          {value.preview ? (
            <img className="po-upload__thumb" src={value.preview} alt={label} />
          ) : (
            <span className="po-upload__file" aria-hidden="true">
              <FileText size={22} />
            </span>
          )}
          <div className="po-upload__meta">
            <p className="po-upload__name">{value.name}</p>
            <p className="po-upload__size">
              {value.kind === 'pdf' ? 'PDF' : 'Photo'}, {sizeLabel(value.size)}
            </p>
          </div>
          <button
            type="button"
            id={id}
            className="oh__edit"
            onClick={pick}
            disabled={reading}
            aria-label={`Replace ${label.toLowerCase()}`}
          >
            {reading ? <Loader2 size={16} className="po-spin" aria-hidden="true" /> : null}
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          className={`po-upload po-upload--empty ${over ? 'po-upload--over' : ''} ${message ? 'po-upload--error' : ''}`}
          onClick={pick}
          disabled={reading}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-note`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="po-upload__icon" aria-hidden="true">
            {reading ? <Loader2 size={20} className="po-spin" /> : <Upload size={20} />}
          </span>
          <span className="po-upload__cta">{reading ? 'Reading…' : 'Upload a photo or PDF'}</span>
          <span className="po-upload__hint">
            <span className="po-upload__drop">Or drop it here. </span>JPG, PNG or PDF, up to {DOC_MAX_MB} MB.
          </span>
        </button>
      )}

      <p className="po-field__note" id={`${id}-note`} role={message ? 'alert' : undefined}>
        {message ? <span className="po-field__error">{message}</span> : NOTE}
      </p>
    </div>
  );
}

// ---------- Once sent: the same details, read-only ----------
// Used before connecting again (they went with an earlier setup) and in
// the connected screen's side panel (WhatsAppConnected.jsx).
export function BusinessSummary({ record }) {
  const doc = DOCUMENTS[record.docType];
  const sent = record.sentAt
    ? new Date(record.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <dl className="wab-facts">
      <div className="wab-facts__row">
        <dt>Business type</dt>
        <dd>{businessTypeOf(record.type)?.label ?? 'Not given'}</dd>
      </div>
      <div className="wab-facts__row">
        <dt>Legal name</dt>
        <dd>{record.legalName || 'Not given'}</dd>
      </div>
      <div className="wab-facts__row">
        <dt>Registered address</dt>
        <dd>{addressLine(record.address)}</dd>
      </div>
      <div className="wab-facts__row">
        <dt>Document</dt>
        <dd>
          {doc ? doc.label : 'Not given'}
          {record.doc && <span className="wab-facts__file">{record.doc.name}</span>}
        </dd>
      </div>
      {sent && (
        <div className="wab-facts__row">
          <dt>Sent</dt>
          <dd>{sent}</dd>
        </div>
      )}
    </dl>
  );
}
