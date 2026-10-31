import type { ContactFields, PhoneKind } from './types';

export interface VCardInput {
  fields: ContactFields;
  photoBase64?: string;
  uid?: string;
}

export function toVCard({ fields, photoBase64, uid }: VCardInput): string {
  const name = fields.name.trim();
  const company = fields.company.trim();
  const fn = name || company || 'Contact';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (uid) lines.push(`UID:${escapeVCard(uid)}`);
  if (name) {
    const parts = splitPersonalName(name);
    lines.push(
      `N:${escapeVCard(parts.family)};${escapeVCard(parts.given)};${escapeVCard(parts.additional)};${escapeVCard(parts.prefix)};${escapeVCard(parts.suffix)}`,
    );
  } else {
    lines.push('N:;;;;');
  }
  lines.push(`FN:${escapeVCard(fn)}`);
  if (company) lines.push(`ORG:${escapeVCard(company)}`);
  if (fields.title.trim()) lines.push(`TITLE:${escapeVCard(fields.title.trim())}`);
  for (const phone of fields.phones) {
    const number = phone.number.trim();
    if (!number) continue;
    lines.push(`TEL;TYPE=${telType(phone.kind)}:${escapeVCard(number)}`);
  }
  if (fields.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(fields.email.trim())}`);
  const website = normalizeWebsite(fields.website);
  if (website) lines.push(`URL:${escapeVCard(website)}`);
  if (fields.address.trim()) lines.push(`ADR;TYPE=WORK:${formatAdr(fields.address)}`);
  if (fields.notes.trim()) lines.push(`NOTE:${escapeVCard(fields.notes.trim())}`);
  if (photoBase64) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photoBase64.replace(/\s+/g, '')}`);
  }
  lines.push('END:VCARD');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export function toVCardBundle(cards: VCardInput[]): string {
  return cards.map((card) => toVCard(card)).join('');
}

export function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\n|\r/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, '')}`;
}

export function splitPersonalName(full: string): {
  family: string;
  given: string;
  additional: string;
  prefix: string;
  suffix: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  let prefix = '';
  let suffix = '';
  if (parts.length && /^(dr|mr|mrs|ms|mx|prof|sir)\.?$/i.test(parts[0] ?? '')) prefix = parts.shift() ?? '';
  if (parts.length > 1 && /^(jr|sr|ii|iii|iv|phd|md|esq)\.?$/i.test(parts[parts.length - 1] ?? '')) {
    suffix = parts.pop() ?? '';
  }
  if (parts.length === 0) return { family: '', given: '', additional: '', prefix, suffix };
  if (parts.length === 1) return { family: '', given: parts[0] ?? '', additional: '', prefix, suffix };
  return {
    family: parts[parts.length - 1] ?? '',
    given: parts[0] ?? '',
    additional: parts.slice(1, -1).join(' '),
    prefix,
    suffix,
  };
}

export function formatAdr(address: string): string {
  const oneLine = address
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(', ');
  const match = oneLine.match(/^(.*),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return `;;${escapeVCard(oneLine)};;;;`;
  return `;;${escapeVCard(match[1] ?? '')};${escapeVCard((match[2] ?? '').trim())};${escapeVCard((match[3] ?? '').toUpperCase())};${escapeVCard(match[4] ?? '')};`;
}

function telType(kind: PhoneKind): string {
  switch (kind) {
    case 'cell':
      return 'CELL';
    case 'work':
      return 'WORK';
    case 'home':
      return 'HOME';
    case 'fax':
      return 'FAX';
    default:
      return 'VOICE';
  }
}

/** Fold a logical vCard line at 75 octets, per RFC 6350 / vCard 3.0. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  let first = true;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = first ? 75 : 74;
    if (current && currentBytes + size > limit) {
      parts.push(first ? current : ` ${current}`);
      first = false;
      current = char;
      currentBytes = size;
    } else {
      current += char;
      currentBytes += size;
    }
  }
  if (current) parts.push(first ? current : ` ${current}`);
  return parts.join('\r\n');
}

export function unfoldVCard(vcf: string): string {
  return vcf.replace(/\r\n[ \t]/g, '');
}
