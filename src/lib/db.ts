import type { ContactFields, SavedCard } from './types';

const DB_NAME = 'card-scanner';
const STORE = 'cards';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the card database'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Card database request failed'));
  });
}

export async function listCards(): Promise<SavedCard[]> {
  const db = await openDb();
  try {
    const cards = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<SavedCard[]>);
    return cards.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function putCard(card: SavedCard): Promise<void> {
  const db = await openDb();
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    await requestToPromise(store.put(card));
  } finally {
    db.close();
  }
}

export async function deleteCard(id: string): Promise<void> {
  const db = await openDb();
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    await requestToPromise(store.delete(id));
  } finally {
    db.close();
  }
}

export function normalizeFields(fields: ContactFields): ContactFields {
  return {
    name: fields.name.trim(),
    title: fields.title.trim(),
    company: fields.company.trim(),
    phones: fields.phones
      .map((phone) => ({ ...phone, number: phone.number.trim() }))
      .filter((phone) => phone.number),
    email: fields.email.trim(),
    website: fields.website.trim(),
    address: fields.address.trim(),
    notes: fields.notes.trim(),
  };
}
