import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Receipt } from 'lucide-react';
import {
  NOTE_MAX,
  addressLine,
  addressProblem,
  cleanPin,
  displayNameProblem,
  loadInvoiceSettings,
  onInvoiceSettingsChange,
  pinProblem,
  saveInvoiceSettings,
} from '../data/invoiceSettings';
import { invoiceIdentity } from '../data/payouts';

// ------------------------------------------------------------
// Settings → Payment details → Your invoices: what buyers see on the
// invoice for each purchase (data/invoiceSettings.js). Two pieces:
//
//   InvoicesCard   on the page: the name on invoices, whether they're
//                  emailed (On / Off pill), the address, GST, the note,
//                  and Edit invoice details
//   InvoiceSetup   the form:
//     Email buyers an invoice            [switch]
//     Name on invoices, Address, PIN
//     GST   from the verified business, nothing to type: GSTIN, legal
//           name, state, and "Registered address is the same as above"
//           (or its own address and PIN). Before the business is verified,
//           or for an individual, a line saying what invoices do instead.
//     Note on invoices (up to 500 characters, with a count)
//     → Save changes
//
// Unlike TagMango's, GST isn't typed a second time, and the name on
// invoices can be a brand: when it differs from the business's legal
// name, the invoice prints the legal name under it.
// ------------------------------------------------------------

// The saved settings now, re-read when they change
export function useInvoiceSettings() {
  const [, setTick] = useState(0);
  useEffect(() => onInvoiceSettingsChange(() => setTick((n) => n + 1)), []);
  return loadInvoiceSettings();
}

// What the GST part says, from identity (kyc from payoutState)
function gstOf(kyc) {
  const business = invoiceIdentity();
  if (business?.gstin) return { kind: 'registered', ...business };
  if (kyc.type === 'business' && kyc.status !== 'verified' && kyc.gstin) return { kind: 'pending' };
  return { kind: 'none' };
}

// ---------- On the page ----------

export function InvoicesCard({ kyc, onEdit }) {
  const s = useInvoiceSettings();
  const gst = gstOf(kyc);

  return (
    <div className="po-part">
      <div className="po-part__head">
        <span className="po-tile po-tile--inv" aria-hidden="true">
          <Receipt size={20} />
        </span>
        <div className="po-part__who">
          <h4 className="po-part__title">{s.displayName}</h4>
          <p className="po-part__sub">{s.send ? 'Emailed to buyers with every purchase' : 'Not emailed to buyers'}</p>
        </div>
        {s.send ? (
          <span className="po-pill po-pill--done">On</span>
        ) : (
          <span className="po-pill po-pill--off">Off</span>
        )}
      </div>

      <dl className="po-dl">
        <div>
          <dt>Address</dt>
          <dd>{addressLine(s.address, s.pin)}</dd>
        </div>
        <div>
          <dt>GST</dt>
          <dd>
            {gst.kind === 'registered'
              ? `${gst.gstin} · ${gst.name}, ${gst.state}`
              : gst.kind === 'pending'
                ? 'Added once your business is verified'
                : 'Not registered, so GST isn’t charged'}
          </dd>
        </div>
        {gst.kind === 'registered' && (
          <div>
            <dt>Registered address</dt>
            <dd>{s.regSame ? 'Same as above' : addressLine(s.regAddress, s.regPin)}</dd>
          </div>
        )}
        <div>
          <dt>Note on invoices</dt>
          <dd className={s.note ? 'po-dd--note' : 'po-dd--none'}>{s.note || 'None'}</dd>
        </div>
      </dl>

      <div className="po-card__foot">
        <button type="button" className="oh__edit" onClick={onEdit}>
          Edit invoice details
        </button>
      </div>
    </div>
  );
}

// ---------- The form ----------
// onDone(): back to the page (saved or cancelled)

export function InvoiceSetup({ kyc, onDone }) {
  const start = loadInvoiceSettings();
  const [send, setSend] = useState(start.send);
  const [displayName, setDisplayName] = useState(start.displayName);
  const [address, setAddress] = useState(start.address);
  const [pin, setPin] = useState(start.pin);
  const [regSame, setRegSame] = useState(start.regSame);
  const [regAddress, setRegAddress] = useState(start.regAddress);
  const [regPin, setRegPin] = useState(start.regPin);
  const [note, setNote] = useState(start.note);
  const [tried, setTried] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(null);
  const gst = gstOf(kyc);
  const ownReg = gst.kind === 'registered' && !regSame;

  useEffect(() => {
    const id = requestAnimationFrame(() => first.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const errors = {
    displayName: displayNameProblem(displayName),
    address: addressProblem(address),
    pin: pinProblem(pin),
    regAddress: ownReg ? addressProblem(regAddress) : null,
    regPin: ownReg ? pinProblem(regPin) : null,
  };
  const show = (key) => (tried ? errors[key] : null);

  const save = () => {
    setTried(true);
    const firstBad = Object.keys(errors).find((k) => errors[k]);
    if (firstBad) {
      document.getElementById(`inv-${firstBad}`)?.focus();
      return;
    }
    const ok = saveInvoiceSettings({
      send,
      displayName: displayName.trim(),
      address: address.trim(),
      pin,
      regSame,
      regAddress: regAddress.trim(),
      regPin,
      note: note.trim(),
    });
    setSaveFailed(!ok);
    if (ok) onDone();
  };

  return (
    <div className="po po-setup">
      <div className="po-setup__top">
        <button type="button" className="po-back" onClick={onDone}>
          <ArrowLeft size={16} aria-hidden="true" /> Cancel
        </button>
      </div>

      <h3 className="po-setup__title">Your invoices</h3>
      <p className="po-setup__help">What buyers see on the invoice for each purchase.</p>

      <div className="po-switch-row">
        <div>
          <p className="po-switch-row__label" id="inv-send-label">
            Email buyers an invoice
          </p>
          <p className="po-switch-row__sub" id="inv-send-sub">
            With every purchase. You can still download any invoice from Sales → Transactions.
          </p>
        </div>
        <button
          ref={first}
          type="button"
          role="switch"
          aria-checked={send}
          aria-labelledby="inv-send-label"
          aria-describedby="inv-send-sub"
          className="po-switch"
          onClick={() => setSend((v) => !v)}
        >
          <span className="po-switch__knob" aria-hidden="true" />
        </button>
      </div>

      <h4 className="po-setup__subtitle po-setup__subtitle--gap">On every invoice</h4>
      <p className="po-setup__help">Shown at the top, as the seller.</p>

      <TextField
        id="inv-displayName"
        label="Name on invoices"
        value={displayName}
        onChange={setDisplayName}
        error={show('displayName')}
        hint={
          gst.kind === 'registered'
            ? `Your brand, if you like. When it’s different, ${gst.name} is printed under it.`
            : 'Your name or your brand.'
        }
        autoComplete="organization"
      />
      <TextField
        id="inv-address"
        label="Address"
        value={address}
        onChange={setAddress}
        error={show('address')}
        hint="Street, area and city."
        autoComplete="street-address"
      />
      <TextField
        id="inv-pin"
        label="PIN code"
        value={pin}
        onChange={(v) => setPin(cleanPin(v))}
        error={show('pin')}
        numeric
        short
        autoComplete="postal-code"
      />

      <h4 className="po-setup__subtitle po-setup__subtitle--gap">GST</h4>
      {gst.kind === 'registered' ? (
        <>
          <div className="po-gst-box">
            <Check size={16} aria-hidden="true" />
            <div>
              <p className="po-gst-box__id">GSTIN {gst.gstin}</p>
              <p>
                {gst.name}, {gst.state}. From your verified business, so invoices include GST.
              </p>
            </div>
          </div>
          <label className="po-check">
            <input type="checkbox" checked={regSame} onChange={(e) => setRegSame(e.target.checked)} />
            Registered address is the same as above
          </label>
          {!regSame && (
            <>
              <TextField
                id="inv-regAddress"
                label="Registered address"
                value={regAddress}
                onChange={setRegAddress}
                error={show('regAddress')}
                hint="As on your GST certificate."
              />
              <TextField
                id="inv-regPin"
                label="Registered address PIN code"
                value={regPin}
                onChange={(v) => setRegPin(cleanPin(v))}
                error={show('regPin')}
                numeric
                short
              />
            </>
          )}
        </>
      ) : (
        <p className="po-setup__help po-gst-none">
          {gst.kind === 'pending'
            ? 'Your GSTIN goes on invoices once your business is verified. Until then, invoices say GST isn’t charged.'
            : 'You’re not registered for GST, so invoices say GST isn’t charged.'}
        </p>
      )}

      <h4 className="po-setup__subtitle po-setup__subtitle--gap">Note on invoices</h4>
      <p className="po-setup__help">Printed at the bottom of every invoice. Optional.</p>
      <div className="po-field">
        <label className="oh__sr-only" htmlFor="inv-note">
          Note on invoices
        </label>
        <textarea
          id="inv-note"
          className="po-input po-textarea"
          value={note}
          maxLength={NOTE_MAX}
          rows={4}
          placeholder="Thank you for your purchase! Sessions can be moved up to 24 hours before they start."
          aria-describedby="inv-note-count"
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
        />
        <p className="po-field__note po-field__count" id="inv-note-count">
          {note.length} / {NOTE_MAX}
        </p>
      </div>

      <div className="po-actions">
        <button type="button" className="oh__add" onClick={save}>
          Save changes
        </button>
      </div>
      {saveFailed && (
        <p className="po-field__error po-setup__fine" role="alert">
          This browser couldn’t save your changes. Try again.
        </p>
      )}
    </div>
  );
}

function TextField({ id, label, value, onChange, error, hint, numeric, short, autoComplete }) {
  return (
    <div className="po-field">
      <label className="po-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`po-input ${short ? 'po-input--short' : ''} ${error ? 'po-input--error' : ''}`}
        value={value}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete={autoComplete ?? 'off'}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? `${id}-note` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {(hint || error) && (
        <p className="po-field__note" id={`${id}-note`}>
          {error ? <span className="po-field__error">{error}</span> : hint}
        </p>
      )}
    </div>
  );
}