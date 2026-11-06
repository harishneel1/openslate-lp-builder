import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, FileText, Loader2, ShieldCheck, Upload } from 'lucide-react';
import {
  BUSINESS_TYPES,
  DOC_MAX_MB,
  DOC_TYPES,
  aadhaarProblem,
  businessNameProblem,
  businessPanNameOf,
  businessPanProblem,
  businessTypeOf,
  cleanAadhaar,
  cleanGstin,
  cleanPan,
  docLabelOf,
  docProblem,
  docsFor,
  formatAadhaar,
  gstStateOf,
  gstinProblem,
  maskAadhaar,
  maskPan,
  panNameOf,
  panProblem,
} from '../data/payouts';
import { readPhoto } from '../utils/readPhoto';

// ------------------------------------------------------------
// Settings → Payment details → Identity: who the coach is paid as, for
// KYC (data/payouts.js). Two pieces here:
//
//   IdentityCard   the part on the page, by status:
//     none       "Verify your identity": what we need and why, and Start
//     checking   we're matching them with government records, with
//                what they sent
//     needs-fix  amber: what's wrong with which document, and Fix it
//     verified   what they sent, masked, with a green Verified pill
//
//   IdentitySetup  one screen a document or two. The first asks, once,
//   "Who are we paying?": an individual, or a business and its type.
//     Individual (2 screens)
//       1. Your PAN card: the PAN (we show who it's registered to), a photo
//       2. Your Aadhaar card: the 12 digits, a photo with all 12 showing
//     Business (3 screens)
//       1. Your business: its PAN and PAN card, and its certificate
//          (Certificate of Incorporation, partnership deed, …). A
//          proprietorship has no PAN of its own: its name and a proof
//          (GST certificate or Udyam) instead.
//       2. The person signing for it (owner, partner, director): their
//          PAN and Aadhaar, with a photo of each
//       3. GST: registered (GSTIN, which must carry the business's PAN,
//          and the certificate) or not
//     → Send for verification
//   A fix opens on the screen with the document that failed, everything
//   else as they left it; the problem stays on its field until it changes.
//
// Uploads are read in the browser (DocUpload): photos are shrunk to a
// small preview, PDFs are kept by name. The real product uploads the
// file itself to storage.
// ------------------------------------------------------------

// 'HN LEARNING PRIVATE LIMITED' → 'HN Learning Private Limited': words
// with no vowels (HN, LLP) stay in capitals
export const titleCase = (name) =>
  String(name ?? '').replace(/[A-Za-z]+/g, (w) =>
    /[aeiou]/i.test(w) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase(),
  );

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const fullDate = (ms) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------- On the page ----------

export function IdentityCard({ kyc, bankAdded = false, onStart, onFix }) {
  if (kyc.status === 'none') {
    return (
      <section className="po-part" aria-labelledby="po-id-title">
        <div className="po-part__head">
          <span className="po-tile" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div className="po-part__who">
            <h3 className="po-part__title" id="po-id-title">
              Verify your identity
            </h3>
            <p className="po-part__sub">Your PAN and Aadhaar, or your business’s documents</p>
          </div>
        </div>
        <div className="po-part__body">
          <p className="po-part__text">
            We need these to pay you and to file TDS in the right name. It takes a few minutes if you have your
            documents with you.
          </p>
          <button type="button" className="oh__add" onClick={onStart}>
            Start
          </button>
        </div>
      </section>
    );
  }

  const business = kyc.type === 'business';
  const bt = business ? businessTypeOf(kyc.businessType) : null;
  const pill =
    kyc.status === 'verified' ? (
      <span className="po-pill po-pill--done">Verified</span>
    ) : kyc.status === 'checking' ? (
      <span className="po-pill po-pill--processing">Checking</span>
    ) : (
      <span className="po-pill po-pill--refund">Needs a fix</span>
    );

  return (
    <section className="po-part" aria-labelledby="po-id-title">
      <div className="po-part__head">
        <span className="po-tile" aria-hidden="true">
          {kyc.status === 'checking' ? <Loader2 size={20} className="po-spin" /> : <ShieldCheck size={20} />}
        </span>
        <div className="po-part__who">
          <h3 className="po-part__title" id="po-id-title">
            {business ? 'Business' : 'Identity'}
          </h3>
          <p className="po-part__sub">
            {business ? `${titleCase(kyc.business.name)}, ${bt.as}` : `${titleCase(kyc.panName)}, as an individual`}
          </p>
        </div>
        {pill}
      </div>

      {kyc.status === 'checking' && (
        <p className="po-part__note po-part__note--checking" role="status">
          We’re matching {business ? 'these documents' : 'your PAN and Aadhaar'} with government records. This usually
          takes a few hours{bankAdded ? '.' : ', and you can add your bank account meanwhile.'}
        </p>
      )}

      {kyc.status === 'needs-fix' && (
        <div className="po-alert po-alert--fix po-part__alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="po-alert__grow">
            <p className="po-alert__title">
              {kyc.problems.length === 1
                ? `The ${docLabelOf(kyc.problems[0].doc, kyc)} needs a fix`
                : 'Some documents need a fix'}
            </p>
            {kyc.problems.map((p) => (
              <p key={`${p.doc}-${p.part}`}>{p.message}</p>
            ))}
            <p className="po-alert__more">Everything else you sent is fine and stays as it is.</p>
            <div className="po-alert__actions">
              <button type="button" className="oh__add" onClick={onFix}>
                Fix it
              </button>
            </div>
          </div>
        </div>
      )}

      <dl className="po-dl">
        {business && bt.panLetter && (
          <div>
            <dt>Business PAN</dt>
            <dd>
              {maskPan(kyc.business.pan)} · {titleCase(kyc.business.name)}
            </dd>
          </div>
        )}
        {business && !bt.panLetter && (
          <div>
            <dt>Business name</dt>
            <dd>{kyc.business.name}</dd>
          </div>
        )}
        <div>
          <dt>{business ? capital(bt.signer) : 'PAN'}</dt>
          <dd>
            {business ? `${titleCase(kyc.panName)} · PAN ${maskPan(kyc.pan)}` : `${maskPan(kyc.pan)} · ${titleCase(kyc.panName)}`}
          </dd>
        </div>
        <div>
          <dt>Aadhaar</dt>
          <dd>{maskAadhaar(kyc.aadhaar)}</dd>
        </div>
        {business && (
          <div>
            <dt>GSTIN</dt>
            <dd>{kyc.gstin ? `${kyc.gstin} · ${gstStateOf(kyc.gstin)}` : 'Not registered'}</dd>
          </div>
        )}
        <div>
          <dt>Documents</dt>
          <dd className="po-docs">
            {docsFor(kyc).map((d) => {
              const bad = kyc.problems.some((p) => p.doc === d);
              return (
                <span key={d} className={`po-doc-chip ${bad ? 'po-doc-chip--bad' : ''}`}>
                  {bad ? <AlertTriangle size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                  {capital(docLabelOf(d, kyc))}
                  {bad && <span className="oh__sr-only"> (needs a fix)</span>}
                </span>
              );
            })}
          </dd>
        </div>
        {kyc.verifiedAt && (
          <div>
            <dt>Verified on</dt>
            <dd>{fullDate(kyc.verifiedAt)}</dd>
          </div>
        )}
      </dl>

      {kyc.status === 'verified' && (
        <p className="po-part__foot">Verified details can’t be changed here. If they need to, contact support.</p>
      )}
    </section>
  );
}

// ---------- Sending or fixing it ----------

const STEPS = { individual: ['pan', 'aadhaar'], business: ['business', 'person', 'gst'] };

// The screen a document is on
const stepOfDoc = (doc, kind) =>
  kind === 'business'
    ? { businessPan: 'business', certificate: 'business', pan: 'person', aadhaar: 'person', gst: 'gst' }[doc]
    : doc;

// start: what they sent before (fixing), or null; problems: what to fix.
// onSubmit({ type, businessType, business, pan, panName, aadhaar, gstin,
// docs }) → false if it couldn't be saved
export function IdentitySetup({ start, problems = [], onCancel, onSubmit }) {
  const fixing = problems.length > 0;
  const [kind, setKind] = useState(start?.type ?? 'individual');
  const [businessType, setBusinessType] = useState(start?.businessType ?? null);
  const [businessPan, setBusinessPan] = useState(start?.business?.pan ?? '');
  const [businessName, setBusinessName] = useState(start?.business?.name ?? '');
  const [pan, setPan] = useState(start?.pan ?? '');
  const [aadhaar, setAadhaar] = useState(start?.aadhaar ?? '');
  const [gstRegistered, setGstRegistered] = useState(start ? Boolean(start.gstin) : null);
  const [gstin, setGstin] = useState(start?.gstin ?? '');
  const [docs, setDocs] = useState(
    start?.docs ?? { pan: null, aadhaar: null, businessPan: null, certificate: null, gst: null },
  );
  const steps = STEPS[kind];
  const [index, setIndex] = useState(() =>
    fixing ? Math.max(0, STEPS[start.type].indexOf(stepOfDoc(problems[0].doc, start.type))) : 0,
  );
  const step = steps[index];
  const last = index === steps.length - 1;
  const [tried, setTried] = useState(fixing);
  // The check's problems, by `${doc}-${part}`, until that field changes
  const [checkProblems, setCheckProblems] = useState(() =>
    Object.fromEntries(problems.map((p) => [`${p.doc}-${p.part}`, p.message])),
  );
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(null);

  const bt = kind === 'business' ? businessTypeOf(businessType) : null;
  const panName = panNameOf(pan);
  const businessPanName = bt?.panLetter ? businessPanNameOf(businessPan, businessType) : '';
  const clear = (key) => setCheckProblems((c) => (c[key] ? { ...c, [key]: undefined } : c));
  const fromCheck = (key) => checkProblems[key] ?? null;

  // The keyboard goes to the screen's first field, or the first one to fix
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const key = Object.keys(checkProblems).find(
        (k) => checkProblems[k] && stepOfDoc(k.split('-')[0], kind) === step,
      );
      const target = key && document.getElementById(`po-${key}`);
      // Choosing who's paid comes first, so nothing jumps past it
      if (target) target.focus();
      else if (!(index === 0 && !fixing)) first.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const personErrors = () => ({
    'pan-number': panProblem(pan) ?? fromCheck('pan-number'),
    'pan-file': docProblem(docs.pan, 'PAN card') ?? fromCheck('pan-file'),
    'aadhaar-number': aadhaarProblem(aadhaar) ?? fromCheck('aadhaar-number'),
    'aadhaar-file': docProblem(docs.aadhaar, 'Aadhaar card') ?? fromCheck('aadhaar-file'),
  });
  const pick = (all, keys) => Object.fromEntries(keys.map((k) => [k, all[k]]));

  let errors = {};
  if (step === 'pan') errors = pick(personErrors(), ['pan-number', 'pan-file']);
  if (step === 'aadhaar') errors = pick(personErrors(), ['aadhaar-number', 'aadhaar-file']);
  if (step === 'person') errors = personErrors();
  if (step === 'business') {
    errors = { type: bt ? null : 'Choose what kind of business it is.' };
    if (bt && !bt.panLetter) {
      errors['business-name'] = businessNameProblem(businessName);
    }
    if (bt?.panLetter) {
      errors['businessPan-number'] = businessPanProblem(businessPan, businessType) ?? fromCheck('businessPan-number');
      errors['businessPan-file'] = docProblem(docs.businessPan, 'business’s PAN card') ?? fromCheck('businessPan-file');
    }
    if (bt) {
      errors['certificate-file'] = docProblem(docs.certificate, bt.certificate) ?? fromCheck('certificate-file');
    }
  }
  if (step === 'gst') {
    errors = { 'gst-choice': gstRegistered === null ? 'Choose one.' : null };
    if (gstRegistered) {
      errors['gst-number'] = gstinProblem(gstin, bt?.panLetter ? businessPan : pan) ?? fromCheck('gst-number');
      errors['gst-file'] = docProblem(docs.gst, 'GST certificate') ?? fromCheck('gst-file');
    }
  }
  const hasError = Object.values(errors).some(Boolean);
  const show = (key) => (tried ? errors[key] : null);

  const next = () => {
    setTried(true);
    if (hasError) return;
    if (!last) {
      setTried(fixing);
      setIndex(index + 1);
      return;
    }
    const ok = onSubmit({
      type: kind,
      businessType,
      business: { pan: bt?.panLetter ? businessPan : '', name: bt?.panLetter ? businessPanName : businessName.trim() },
      pan,
      panName,
      aadhaar,
      gstin: gstRegistered ? gstin : '',
      docs,
    });
    setSaveFailed(ok === false);
  };

  const back = () => {
    setTried(fixing);
    setIndex(index - 1);
  };

  const setDoc = (d) => (doc) => {
    setDocs((all) => ({ ...all, [d]: doc }));
    clear(`${d}-file`);
  };

  // The person's PAN and Aadhaar fields, on their own screens
  // (individual) or together (the business's signer)
  const panFields = (
    <>
      <CodeField
        id="po-pan-number"
        label={bt ? `${capital(bt.signer)}’s PAN` : 'PAN'}
        value={pan}
        placeholder="ABCPE1234F"
        inputRef={step === 'pan' || step === 'person' ? first : undefined}
        onChange={(v) => {
          setPan(cleanPan(v));
          clear('pan-number');
        }}
        onEnter={next}
        error={show('pan-number')}
        ok={panName && `Registered to ${panName}`}
        hint={bt ? 'Their personal PAN. Its 4th letter is P.' : 'It’s on your PAN card, under “Permanent Account Number”.'}
      />
      <DocUpload
        id="po-pan-file"
        label={`Photo of ${bt ? 'their' : 'your'} PAN card`}
        note="The front, with all four corners in view."
        value={docs.pan}
        onChange={setDoc('pan')}
        error={show('pan-file')}
      />
    </>
  );
  const aadhaarFields = (
    <>
      <CodeField
        id="po-aadhaar-number"
        label={bt ? `${capital(bt.signer)}’s Aadhaar number` : 'Aadhaar number'}
        value={formatAadhaar(aadhaar)}
        placeholder="1234 5678 9012"
        numeric
        inputRef={step === 'aadhaar' ? first : undefined}
        onChange={(v) => {
          setAadhaar(cleanAadhaar(v));
          clear('aadhaar-number');
        }}
        onEnter={next}
        error={show('aadhaar-number')}
        hint="The 12 digits on the front of the card."
      />
      <DocUpload
        id="po-aadhaar-file"
        label={`Photo of ${bt ? 'their' : 'your'} Aadhaar card`}
        note="The side with the photo. All 12 digits must be visible, not masked."
        value={docs.aadhaar}
        onChange={setDoc('aadhaar')}
        error={show('aadhaar-file')}
      />
    </>
  );

  const choosing = index === 0 && !fixing;
  const titles = {
    pan: ['Your PAN card', 'We need it to pay you, and to deduct and file TDS in your name.'],
    aadhaar: ['Your Aadhaar card', 'We match it with your PAN to confirm it’s you.'],
    business: ['Your business', 'We pay the business, so we need to see it’s registered.'],
    person: bt?.panLetter
      ? [
          `The ${bt.signer} signing for it`,
          `Any one ${bt.signer}’s personal PAN and Aadhaar, to confirm who’s behind ${titleCase(businessPanName) || 'the business'}.`,
        ]
      : ['You, the owner', 'Your personal PAN and Aadhaar. A proprietorship is paid through its owner’s PAN.'],
    gst: ['GST registration', 'If the business is registered for GST, we check it matches. If it isn’t, that’s fine.'],
  };
  const [title, help] = titles[step];

  return (
    <div className="po po-setup">
      <div className="po-setup__top">
        <button type="button" className="po-back" onClick={index === 0 ? onCancel : back}>
          <ArrowLeft size={16} aria-hidden="true" /> {index === 0 ? 'Cancel' : 'Back'}
        </button>
        <p className="po-setup__step">
          Step {index + 1} of {steps.length}
        </p>
      </div>

      {choosing && (
        <>
          <h3 className="po-setup__title">Who are we paying?</h3>
          <p className="po-setup__help">You choose this once. It decides which documents we ask for.</p>
          <fieldset className="po-kind">
            <legend className="oh__sr-only">You’re getting paid as</legend>
            {[
              ['individual', 'You, as an individual', 'In your own name, with your personal PAN'],
              ['business', 'Your business', 'A proprietorship, partnership, company or LLP'],
            ].map(([id, name, sub]) => (
              <label key={id} className={`po-kind__option ${kind === id ? 'po-kind__option--on' : ''}`}>
                <input
                  type="radio"
                  name="po-kind"
                  value={id}
                  checked={kind === id}
                  onChange={() => {
                    setKind(id);
                    setTried(false);
                  }}
                />
                <span>
                  <span className="po-kind__name">{name}</span>
                  <span className="po-kind__sub">{sub}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <hr className="po-setup__rule" />
        </>
      )}

      {choosing ? (
        <h4 className="po-setup__subtitle">{title}</h4>
      ) : (
        <h3 className="po-setup__title">{title}</h3>
      )}
      <p className="po-setup__help">{help}</p>

      {step === 'pan' && panFields}
      {step === 'aadhaar' && aadhaarFields}
      {step === 'person' && (
        <>
          {panFields}
          {aadhaarFields}
        </>
      )}

      {step === 'business' && (
        <>
          <fieldset className="po-field po-types" aria-describedby="po-type-note">
            <legend className="po-field__label">What kind of business?</legend>
            <div className="po-types__grid">
              {BUSINESS_TYPES.map((t) => (
                <label key={t.id} className={`po-type ${businessType === t.id ? 'po-type--on' : ''}`}>
                  <input
                    type="radio"
                    name="po-type"
                    value={t.id}
                    checked={businessType === t.id}
                    disabled={fixing}
                    onChange={() => {
                      setBusinessType(t.id);
                      setTried(false);
                    }}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="po-field__note" id="po-type-note">
              {show('type') ? <span className="po-field__error">{show('type')}</span> : 'As it’s registered.'}
            </p>
          </fieldset>

          {bt && !bt.panLetter && (
            <>
              <CodeField
                id="po-business-name"
                label="Business name"
                value={businessName}
                plain
                onChange={setBusinessName}
                onEnter={next}
                error={show('business-name')}
                hint="As it appears on your GST certificate or Udyam registration."
              />
              <DocUpload
                id="po-certificate-file"
                label="GST certificate or Udyam registration"
                note="Either one, showing the business name. Your own PAN comes next."
                value={docs.certificate}
                onChange={setDoc('certificate')}
                error={show('certificate-file')}
              />
            </>
          )}

          {bt?.panLetter && (
            <>
              <CodeField
                id="po-businessPan-number"
                label="Business PAN"
                value={businessPan}
                placeholder={`AAG${bt.panLetter}H4821K`}
                onChange={(v) => {
                  setBusinessPan(cleanPan(v));
                  clear('businessPan-number');
                }}
                onEnter={next}
                error={show('businessPan-number')}
                ok={businessPanName && `Registered to ${businessPanName}`}
                hint={`The business’s own PAN, not yours. Its 4th letter is ${bt.panLetter}.`}
              />
              <DocUpload
                id="po-businessPan-file"
                label="Photo of the business’s PAN card"
                note="The front, with all four corners in view."
                value={docs.businessPan}
                onChange={setDoc('businessPan')}
                error={show('businessPan-file')}
              />
              <DocUpload
                id="po-certificate-file"
                label={bt.certificateShort}
                note={
                  bt.id === 'partnership'
                    ? 'Every page, ideally as one PDF.'
                    : 'The one from the Ministry of Corporate Affairs. The PDF you were sent is best.'
                }
                value={docs.certificate}
                onChange={setDoc('certificate')}
                error={show('certificate-file')}
              />
            </>
          )}
        </>
      )}

      {step === 'gst' && (
        <>
          <fieldset className="po-field po-types" aria-describedby="po-gst-choice-note">
            <legend className="oh__sr-only">Is the business registered for GST?</legend>
            <div className="po-types__grid po-types__grid--two">
              {[
                [true, 'Registered for GST'],
                [false, 'Not registered'],
              ].map(([value, label]) => (
                <label key={label} className={`po-type ${gstRegistered === value ? 'po-type--on' : ''}`}>
                  <input
                    type="radio"
                    name="po-gst"
                    ref={value ? first : undefined}
                    checked={gstRegistered === value}
                    onChange={() => {
                      setGstRegistered(value);
                      setTried(fixing);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="po-field__note" id="po-gst-choice-note">
              {show('gst-choice') && <span className="po-field__error">{show('gst-choice')}</span>}
            </p>
          </fieldset>

          {gstRegistered && (
            <>
              <CodeField
                id="po-gst-number"
                label="GSTIN"
                value={gstin}
                placeholder="33AAGCH4821K1ZM"
                onChange={(v) => {
                  setGstin(cleanGstin(v));
                  clear('gst-number');
                }}
                onEnter={next}
                error={show('gst-number')}
                ok={!gstinProblem(gstin, bt?.panLetter ? businessPan : pan) && `Registered in ${gstStateOf(gstin)}`}
                hint="15 characters, on your GST certificate. It has the business’s PAN in it."
              />
              <DocUpload
                id="po-gst-file"
                label="GST certificate"
                note="Form GST REG-06, the PDF from the GST portal."
                value={docs.gst}
                onChange={setDoc('gst')}
                error={show('gst-file')}
              />
            </>
          )}
        </>
      )}

      <div className="po-actions">
        <button type="button" className="oh__add" onClick={next}>
          {last ? 'Send for verification' : 'Continue'}
        </button>
      </div>
      {saveFailed && (
        <p className="po-field__error po-setup__fine" role="alert">
          This browser couldn’t save your documents. Try smaller photos, or PDFs.
        </p>
      )}
      {last && !saveFailed && (
        <p className="po-setup__fine">
          We check these with government records. It usually takes a few hours, and you can add your bank account
          meanwhile.
        </p>
      )}
    </div>
  );
}

// ---------- A typed field: PAN, Aadhaar, GSTIN, a name ----------
// ok: a green line once it's right (who a PAN is registered to);
// plain: ordinary text rather than a code in capitals
function CodeField({ id, label, value, placeholder, onChange, onEnter, error, ok, hint, numeric, plain, inputRef }) {
  return (
    <div className="po-field">
      <label className="po-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className={`po-input ${plain ? '' : 'po-input--code'} ${error ? 'po-input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete="off"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={`${id}-note`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
      <p className="po-field__note" id={`${id}-note`}>
        {error ? (
          <span className="po-field__error">{error}</span>
        ) : ok ? (
          <span className="po-field__ok">
            <Check size={14} aria-hidden="true" /> {ok}
          </span>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}

// ---------- A document: pick, drop, see, replace ----------

// Reads a picked file into a document ({ name, kind, size, preview }).
// Throws an Error with a message that's safe to show.
async function readDocument(file) {
  if (!DOC_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or PDF.');
  if (file.size > DOC_MAX_MB * 1024 * 1024) {
    throw new Error(`That file is over ${DOC_MAX_MB} MB. Choose a smaller one.`);
  }
  if (file.type === 'application/pdf') return { name: file.name, kind: 'pdf', size: file.size, preview: null };
  const preview = await readPhoto(file, { maxSide: 720 });
  return { name: file.name, kind: 'image', size: file.size, preview };
}

const sizeLabel = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function DocUpload({ id, label, note, value, onChange, error }) {
  const input = useRef(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState(null);
  const [over, setOver] = useState(false);

  const take = async (file) => {
    if (!file) return;
    setReading(true);
    setReadError(null);
    try {
      onChange(await readDocument(file));
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
        accept={DOC_TYPES.join(',')}
        className="oh__sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-doc={id}
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
            aria-describedby={`${id}-note`}
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
        {message ? <span className="po-field__error">{message}</span> : note}
      </p>
    </div>
  );
}