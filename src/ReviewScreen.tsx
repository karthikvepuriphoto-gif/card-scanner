import { useEffect, useState } from 'react';
import { openContact, prepareHandoff } from './lib/deliver';
import { normalizeFields } from './lib/db';
import { photoForVCard } from './lib/image';
import { contactFilename } from './lib/plan';
import type { ContactFields, PhoneKind } from './lib/types';
import { toVCard } from './lib/vcard';
import { TextField } from './ui';

const KINDS: { value: PhoneKind; label: string }[] = [
  { value: 'voice', label: 'Phone' },
  { value: 'cell', label: 'Mobile' },
  { value: 'work', label: 'Work' },
  { value: 'home', label: 'Home' },
  { value: 'fax', label: 'Fax' },
];

interface ReviewScreenProps {
  id: string;
  photoUrl: string;
  photo: Blob;
  fields: ContactFields;
  existing: boolean;
  banner: string;
  duplicate: boolean;
  onChange: (fields: ContactFields) => void;
  onBack: () => void;
  onDelete?: () => void;
  onSaved: (fields: ContactFields) => void;
}

export function ReviewScreen({
  id,
  photoUrl,
  photo,
  fields,
  existing,
  banner,
  duplicate,
  onChange,
  onBack,
  onDelete,
  onSaved,
}: ReviewScreenProps) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cachedVcf, setCachedVcf] = useState('');
  const [handoffSettled, setHandoffSettled] = useState(false);

  useEffect(() => {
    let cancel = false;
    setPhotoBase64(null);
    photoForVCard(photo)
      .then((value) => {
        if (!cancel) setPhotoBase64(value);
      })
      .catch(() => {
        if (!cancel) setPhotoBase64('');
      });
    return () => {
      cancel = true;
    };
  }, [photo]);

  const filename = contactFilename(fields.name || fields.company);
  const vcf =
    photoBase64 === null
      ? ''
      : toVCard({
          fields: normalizeFields(fields),
          photoBase64: photoBase64 || undefined,
          uid: id,
        });

  useEffect(() => {
    if (!vcf) return;
    let cancel = false;
    prepareHandoff(id, vcf, filename)
      .then((ready) => {
        if (cancel) return;
        if (ready) setCachedVcf(vcf);
        setHandoffSettled(true);
      })
      .catch(() => {
        if (!cancel) setHandoffSettled(true);
      });
    return () => {
      cancel = true;
    };
  }, [filename, id, vcf]);

  function update(patch: Partial<ContactFields>) {
    onChange({ ...fields, ...patch });
  }

  function save() {
    if (!vcf || !handoffSettled) return;
    const normalized = normalizeFields(fields);
    openContact({ id, filename, vcf, cacheReady: cachedVcf === vcf });
    onSaved(normalized);
  }

  const phones = fields.phones.length ? fields.phones : [{ number: '', kind: 'voice' as const }];

  return (
    <section className="screen">
      <header className="topbar">
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
        <h1>{existing ? 'Edit card' : 'Review'}</h1>
        {existing && onDelete ? (
          <button type="button" className="ghost danger" onClick={onDelete}>
            Delete
          </button>
        ) : (
          <span className="top-spacer" />
        )}
      </header>
      <form
        className="review"
        // www.example.com is not a valid HTML url, so browser validation must not block Save.
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <figure className="card-photo">
          <img src={photoUrl} alt="Scanned business card" />
        </figure>
        {banner && (
          <p className="banner" role="status">
            {banner}
          </p>
        )}
        {duplicate && (
          <p className="banner" role="status">
            A saved card already uses this email. You can still add it.
          </p>
        )}
        <TextField label="Name" value={fields.name} autoComplete="name" onChange={(name) => update({ name })} />
        <TextField label="Job title" value={fields.title} autoComplete="organization-title" onChange={(title) => update({ title })} />
        <TextField label="Company" value={fields.company} autoComplete="organization" onChange={(company) => update({ company })} />
        <div className="field">
          <span>Phone</span>
          {phones.map((phone, index) => (
            <div className="phone-row" key={`${index}-${phone.kind}`}>
              <input
                aria-label={phones.length > 1 ? `Phone ${index + 1}` : 'Phone'}
                inputMode="tel"
                autoComplete="tel"
                value={phone.number}
                onChange={(event) => {
                  const next = phones.slice();
                  next[index] = { ...phone, number: event.target.value };
                  update({ phones: next });
                }}
              />
              <select
                aria-label={`Type for phone ${index + 1}`}
                value={phone.kind}
                onChange={(event) => {
                  const next = phones.slice();
                  next[index] = { ...phone, kind: event.target.value as PhoneKind };
                  update({ phones: next });
                }}
              >
                {KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
              {phones.length > 1 && (
                <button
                  type="button"
                  className="text-btn"
                  aria-label={`Remove phone ${index + 1}`}
                  onClick={() => update({ phones: phones.filter((_, item) => item !== index) })}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="text-btn add-phone" onClick={() => update({ phones: [...phones, { number: '', kind: 'voice' }] })}>
            Add another phone
          </button>
        </div>
        <TextField label="Email" value={fields.email} type="email" inputMode="email" autoComplete="email" onChange={(email) => update({ email })} />
        <TextField label="Website" value={fields.website} inputMode="url" autoComplete="url" onChange={(website) => update({ website })} />
        <TextField label="Address" value={fields.address} autoComplete="street-address" multiline onChange={(address) => update({ address })} />
        <TextField label="Notes" value={fields.notes} multiline onChange={(notes) => update({ notes })} />
        <div className="dock dock-form">
          <button type="submit" className="primary" data-handoff={cachedVcf === vcf ? 'cache' : 'blob'} disabled={!vcf || !handoffSettled}>
            {vcf && handoffSettled ? 'Add to Contacts' : 'Preparing contact…'}
          </button>
          <p className="fine">Opens your phone’s Add to Contacts sheet, and keeps the card on this device.</p>
        </div>
      </form>
    </section>
  );
}
