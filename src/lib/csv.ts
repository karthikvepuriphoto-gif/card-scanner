import type { SavedCard } from './types';

const COLUMNS = ['name', 'job title', 'company', 'phones', 'email', 'website', 'address', 'notes', 'saved'] as const;

export function toCsv(cards: SavedCard[]): string {
  const lines = [COLUMNS.join(',')];
  for (const card of cards) {
    const fields = card.fields;
    lines.push(
      [
        fields.name,
        fields.title,
        fields.company,
        fields.phones
          .map((phone) => phone.number.trim())
          .filter(Boolean)
          .join('; '),
        fields.email,
        fields.website,
        fields.address.replace(/\n/g, ', '),
        fields.notes,
        new Date(card.createdAt).toISOString(),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}
