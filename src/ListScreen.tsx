import { useEffect, useState } from 'react';
import { toCsv } from './lib/csv';
import { openContact, prepareHandoff, type ReadyDelivery } from './lib/deliver';
import { photoForVCard } from './lib/image';
import { contactFilename } from './lib/plan';
import type { SavedCard } from './lib/types';
import { toVCard, toVCardBundle } from './lib/vcard';
import { Thumb } from './ui';

interface ListScreenProps {
  cards: SavedCard[];
  onBack: () => void;
  onScan: () => void;
  onOpen: (card: SavedCard) => void;
  onDelete: (id: string) => void;
}

export function ListScreen({ cards, onBack, onScan, onOpen, onDelete }: ListScreenProps) {
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [rows, setRows] = useState<Record<string, ReadyDelivery>>({});
  const [bundle, setBundle] = useState<ReadyDelivery | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const ready: Record<string, ReadyDelivery> = {};
      const inputs: { fields: SavedCard['fields']; photoBase64?: string; uid: string }[] = [];
      for (const card of cards) {
        const photoBase64 = card.photo.size ? await photoForVCard(card.photo).catch(() => undefined) : undefined;
        const filename = contactFilename(card.fields.name || card.fields.company);
        const vcf = toVCard({ fields: card.fields, photoBase64, uid: card.id });
        const cacheReady = await prepareHandoff(card.id, vcf, filename).catch(() => false);
        ready[card.id] = { id: card.id, filename, vcf, cacheReady };
        inputs.push({ fields: card.fields, photoBase64, uid: card.id });
        if (cancel) return;
        setRows({ ...ready });
      }
      if (!inputs.length) {
        if (!cancel) setBundle(null);
        return;
      }
      const all = toVCardBundle(inputs);
      const cacheReady = await prepareHandoff('all-cards', all, 'cards.vcf').catch(() => false);
      if (!cancel) setBundle({ id: 'all-cards', filename: 'cards.vcf', vcf: all, cacheReady });
    })();
    return () => {
      cancel = true;
    };
  }, [cards]);

  const needle = query.trim().toLowerCase();
  const visible = cards.filter((card) => {
    if (!needle) return true;
    const haystack = [
      card.fields.name,
      card.fields.title,
      card.fields.company,
      card.fields.email,
      card.fields.website,
      card.fields.address,
      card.fields.notes,
      ...card.fields.phones.map((phone) => phone.number),
    ]
      .join('\n')
      .toLowerCase();
    return haystack.includes(needle);
  });

  function downloadCsv() {
    const blob = new Blob([toCsv(cards)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'cards.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 4000);
  }

  return (
    <section className="screen">
      <header className="topbar">
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
        <h1>Saved</h1>
        <button type="button" className="ghost" onClick={onScan}>
          Scan
        </button>
      </header>
      <div className="list-tools">
        <label className="search">
          <span className="sr-only">Search saved cards</span>
          <input value={query} placeholder="Search name, company, phone, email" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="export-row">
          <button type="button" className="secondary" disabled={!bundle} onClick={() => bundle && openContact(bundle)}>
            Export .vcf
          </button>
          <button type="button" className="secondary" disabled={!cards.length} onClick={downloadCsv}>
            Export CSV
          </button>
        </div>
      </div>
      {cards.length === 0 ? (
        <div className="empty">
          <p>No cards yet.</p>
          <button type="button" className="primary" onClick={onScan}>
            Scan a card
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="empty">Nothing matches “{query.trim()}”.</p>
      ) : (
        <ul className="card-list">
          {visible.map((card) => {
            const delivery = rows[card.id];
            return (
              <li key={card.id}>
                <button type="button" className="card-row" onClick={() => onOpen(card)}>
                  <Thumb photo={card.photo} alt="" />
                  <span>
                    <strong>{card.fields.name || card.fields.company || 'Untitled card'}</strong>
                    <small>{[card.fields.title, card.fields.company].filter(Boolean).join(' · ') || card.fields.email || 'No details yet'}</small>
                  </span>
                </button>
                <div className="row-actions">
                  <button type="button" className="secondary" disabled={!delivery} onClick={() => delivery && openContact(delivery)}>
                    {delivery ? 'Add to contacts' : 'Preparing…'}
                  </button>
                  {confirmId === card.id ? (
                    <>
                      <button type="button" className="secondary danger" onClick={() => onDelete(card.id)}>
                        Delete
                      </button>
                      <button type="button" className="text-btn" onClick={() => setConfirmId('')}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="text-btn" onClick={() => setConfirmId(card.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
