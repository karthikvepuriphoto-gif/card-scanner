import { useCallback, useEffect, useState } from 'react';
import { deleteCard, listCards, normalizeFields, putCard } from './lib/db';
import { preprocessForOcr, shrinkImage } from './lib/image';
import { recognizeCard, setOcrProgress } from './lib/ocr';
import { parseCard } from './lib/parseCard';
import type { ContactFields, PhoneKind, SavedCard } from './lib/types';
import { ListScreen } from './ListScreen';
import { ReviewScreen } from './ReviewScreen';
import { SavedScreen } from './SavedScreen';
import { ScanScreen } from './ScanScreen';

interface Draft {
  id: string;
  photo: Blob;
  photoUrl: string;
  fields: ContactFields;
  existing: boolean;
  createdAt: number;
  banner: string;
}

type Route = { name: 'scan' } | { name: 'review'; draft: Draft } | { name: 'saved'; draft: Draft } | { name: 'list' };

function blankPhone(): { number: string; kind: PhoneKind } {
  return { number: '', kind: 'voice' };
}

export function App() {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'scan' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setCards(await listCards());
  }, []);

  useEffect(() => {
    void reload().catch(() => setError('Saved cards could not be opened on this browser.'));
  }, [reload]);

  function go(next: Route) {
    setRoute((current) => {
      const currentUrl = 'draft' in current ? current.draft.photoUrl : '';
      const nextUrl = 'draft' in next ? next.draft.photoUrl : '';
      if (currentUrl && currentUrl !== nextUrl) URL.revokeObjectURL(currentUrl);
      return next;
    });
  }

  async function scanBlob(blob: Blob) {
    setBusy(true);
    setError('');
    setStatus('Reading the card…');
    setOcrProgress(setStatus);
    let banner = '';
    let text = '';
    try {
      const stored = await shrinkImage(blob, 1600, 0.86);
      try {
        const prepared = await preprocessForOcr(blob);
        text = await recognizeCard(prepared);
      } catch {
        banner = 'Text recognition did not finish. Type the details, then add the contact.';
      }
      const parsed = parseCard(text);
      if (!text.trim() && !banner) banner = 'No text found. Type the details, then add the contact.';
      if (!parsed.phones.length) parsed.phones = [blankPhone()];
      go({
        name: 'review',
        draft: {
          id: crypto.randomUUID(),
          photo: stored,
          photoUrl: URL.createObjectURL(stored),
          fields: parsed,
          existing: false,
          createdAt: Date.now(),
          banner,
        },
      });
    } catch {
      setError('That photo could not be read. Try another shot, closer and with the card flat.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  async function scanSample() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/jordan-lee.png`);
      if (!response.ok) throw new Error('missing sample');
      await scanBlob(await response.blob());
    } catch {
      setError('The sample card could not be loaded.');
    }
  }

  function openSaved(card: SavedCard) {
    go({
      name: 'review',
      draft: {
        id: card.id,
        photo: card.photo,
        photoUrl: URL.createObjectURL(card.photo),
        fields: {
          ...card.fields,
          phones: card.fields.phones.length ? card.fields.phones : [blankPhone()],
        },
        existing: true,
        createdAt: card.createdAt,
        banner: '',
      },
    });
  }

  async function handleSaved(fields: ContactFields) {
    if (route.name !== 'review') return;
    const draft = route.draft;
    const record: SavedCard = {
      id: draft.id,
      createdAt: draft.createdAt,
      updatedAt: Date.now(),
      photo: draft.photo,
      fields: normalizeFields(fields),
    };
    try {
      await putCard(record);
      await reload();
    } catch {
      setError('The contact file opened, but this phone could not store the card.');
    }
    setRoute({ name: 'saved', draft: { ...draft, fields: record.fields, banner: '' } });
  }

  async function remove(id: string) {
    await deleteCard(id);
    await reload();
    if (route.name === 'review') go({ name: 'list' });
  }

  const duplicate =
    route.name === 'review' &&
    cards.some(
      (card) =>
        card.id !== route.draft.id &&
        card.fields.email &&
        card.fields.email.toLowerCase() === route.draft.fields.email.trim().toLowerCase(),
    );

  return (
    <div className="app">
      {route.name === 'scan' && (
        <ScanScreen
          count={cards.length}
          busy={busy}
          status={status}
          error={error}
          onOpenList={() => go({ name: 'list' })}
          onCapture={(blob) => void scanBlob(blob)}
          onSample={() => void scanSample()}
        />
      )}
      {route.name === 'review' && (
        <ReviewScreen
          id={route.draft.id}
          photo={route.draft.photo}
          photoUrl={route.draft.photoUrl}
          fields={route.draft.fields}
          existing={route.draft.existing}
          banner={route.draft.banner}
          duplicate={duplicate}
          onChange={(fields) => setRoute({ name: 'review', draft: { ...route.draft, fields } })}
          onBack={() => go(route.draft.existing ? { name: 'list' } : { name: 'scan' })}
          onDelete={route.draft.existing ? () => void remove(route.draft.id) : undefined}
          onSaved={(fields) => void handleSaved(fields)}
        />
      )}
      {route.name === 'saved' && (
        <SavedScreen
          name={route.draft.fields.name || route.draft.fields.company}
          photoUrl={route.draft.photoUrl}
          onScanNext={() => go({ name: 'scan' })}
          onViewList={() => go({ name: 'list' })}
        />
      )}
      {route.name === 'list' && (
        <ListScreen
          cards={cards}
          onBack={() => go({ name: 'scan' })}
          onScan={() => go({ name: 'scan' })}
          onOpen={openSaved}
          onDelete={(id) => void remove(id)}
        />
      )}
    </div>
  );
}
