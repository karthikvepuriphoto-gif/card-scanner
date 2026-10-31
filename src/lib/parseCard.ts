import type { ContactFields, PhoneKind, PhoneNumber } from './types';

const TITLE_RE =
  /\b(chief\s+\w+\s+officer|ceo|cfo|cto|coo|cmo|cio|founder|co-founder|president|vice president|\bvp\b|director|manager|designer|engineer|developer|architect|consultant|analyst|specialist|coordinator|producer|photographer|editor|marketing|sales|account executive|associate|owner|principal|recruiter|attorney|lawyer|counsel|professor|head of|officer|intern|strategist|advisor|representative)\b/i;

const COMPANY_RE =
  /\b(incorporated|inc|l\.?l\.?c|ltd|limited|corp|corporation|company|gmbh|plc|group|studio|studios|labs|laboratories|agency|partners|llp|associates|consulting|solutions|holdings|enterprises)\b\.?/i;

const STREET_RE =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|suite|ste|floor|fl|p\.?\s*o\.?\s*box)\b\.?/i;

const CITY_STATE_ZIP_RE = /,\s*[A-Za-z]{2}\s+\d{5}(?:-\d{4})?\b/;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s,;<>()]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|studio|design|ai|app|dev|biz|info|me|us|uk|ca|de|fr|au|nz|eu|xyz)(?:\/[^\s,;<>()]*)?/gi;

const PHONE_RE =
  /(?:\+\d{1,3}[\s().-]*)?(?:\(?\d{1,4}\)?[\s().-]*){1,5}\d{2,6}(?:\s*(?:x|ext\.?|#)\s*\d{1,6})?/gi;

export function normalizeOcr(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑–—]/g, '-')
    .replace(/(\S)\s+@\s+(\S)/g, '$1@$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseCard(raw: string): ContactFields {
  const lines = normalizeOcr(raw)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap(splitPipes);

  const emails: string[] = [];
  const websites: string[] = [];
  const phones: PhoneNumber[] = [];
  const content: string[] = [];

  for (const line of lines) {
    const { kind, stripped } = stripPhoneLabel(line);
    let rest = stripped;
    const foundEmails = takeMatches(rest, EMAIL_RE).map((value) => value.replace(/[),.;]+$/, ''));
    emails.push(...foundEmails);
    rest = removeAll(rest, foundEmails);
    const foundUrls = takeMatches(rest, URL_RE)
      .map((value) => value.replace(/[.)\],]+$/, ''))
      .filter((value) => !value.includes('@'));
    websites.push(...foundUrls);
    rest = removeAll(rest, foundUrls);
    const foundPhones = takePhones(rest);
    for (const number of foundPhones) phones.push({ number, kind });
    rest = removeAll(rest, foundPhones).replace(/^[\s|:;,-]+|[\s|:;,-]+$/g, '').trim();
    if (rest && !/^[\W_]+$/.test(rest)) content.push(rest);
  }

  const addressLines: string[] = [];
  const identity: string[] = [];
  for (const line of content) {
    if (isAddressLine(line)) addressLines.push(line);
    else identity.push(line);
  }

  const used = new Set<number>();
  const companyIdx = bestIndex(identity, scoreCompany, 3, used);
  const company = companyIdx >= 0 ? identity[companyIdx] : '';
  if (companyIdx >= 0) used.add(companyIdx);

  const titleIdx = bestIndex(identity, scoreTitle, 3, used);
  const title = titleIdx >= 0 ? identity[titleIdx] : '';
  if (titleIdx >= 0) used.add(titleIdx);

  const nameIdx = bestIndex(identity, scoreName, 1, used);
  let name = nameIdx >= 0 ? identity[nameIdx] : '';
  if (nameIdx >= 0) used.add(nameIdx);

  const leftover = identity.filter((_, index) => !used.has(index));
  if (!name && leftover.length) name = leftover.shift() ?? '';
  let resolvedTitle = title;
  let resolvedCompany = company;
  if (!resolvedTitle) {
    const index = leftover.findIndex((line) => scoreTitle(line) > 0);
    if (index >= 0) resolvedTitle = leftover.splice(index, 1)[0] ?? '';
  }
  if (!resolvedCompany) {
    const index = leftover.findIndex((line) => scoreCompany(line) > 0);
    if (index >= 0) resolvedCompany = leftover.splice(index, 1)[0] ?? '';
    else if (leftover[0] && leftover[0].length <= 48 && scoreName(leftover[0]) === 0) {
      resolvedCompany = leftover.shift() ?? '';
    }
  }

  const extraEmails = emails.slice(1).filter(Boolean);
  const extraSites = websites.slice(1).filter(Boolean);
  const notes = [...leftover, ...extraEmails, ...extraSites].join('\n');

  return {
    name: cleanName(name),
    title: resolvedTitle.trim(),
    company: resolvedCompany.trim(),
    phones: dedupePhones(phones),
    email: emails[0]?.trim() ?? '',
    website: websites[0]?.trim() ?? '',
    address: addressLines.join('\n'),
    notes,
  };
}

function splitPipes(line: string): string[] {
  if (!/[|•·]/.test(line)) return [line];
  const parts = line.split(/\s*[|•·]\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [line];
}

function stripPhoneLabel(line: string): { kind: PhoneKind; stripped: string } {
  const word = line.match(/^\s*(mobile|cell|office|work|phone|tel|fax|home)\b\s*[:.\-]?\s*(.*)$/i);
  if (word) return { kind: mapKind(word[1] ?? ''), stripped: word[2] ?? '' };
  const letter = line.match(/^\s*([mofh])\s*[:.\-]\s*(.*)$/i);
  if (letter) return { kind: mapKind(letter[1] ?? ''), stripped: letter[2] ?? '' };
  return { kind: 'voice', stripped: line };
}

function mapKind(label: string): PhoneKind {
  const value = label.toLowerCase();
  if (value === 'm' || value === 'mobile' || value === 'cell') return 'cell';
  if (value === 'o' || value === 'office' || value === 'work') return 'work';
  if (value === 'f' || value === 'fax') return 'fax';
  if (value === 'h' || value === 'home') return 'home';
  return 'voice';
}

function takeMatches(line: string, pattern: RegExp): string[] {
  return [...line.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => match[0]);
}

function takePhones(line: string): string[] {
  const out: string[] = [];
  for (const match of line.matchAll(new RegExp(PHONE_RE.source, PHONE_RE.flags))) {
    const raw = match[0].trim().replace(/\s+/g, ' ').replace(/^[(.\s-]+/, '');
    const compact = raw.replace(/\s/g, '');
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    if (/^\d{5}(?:-\d{4})?$/.test(compact)) continue;
    out.push(raw);
  }
  return out;
}

function removeAll(line: string, parts: string[]): string {
  let out = line;
  for (const part of parts) {
    const index = out.indexOf(part);
    if (index >= 0) out = `${out.slice(0, index)} ${out.slice(index + part.length)}`;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function isAddressLine(line: string): boolean {
  if (CITY_STATE_ZIP_RE.test(line) || /\bP\.?\s*O\.?\s*Box\b/i.test(line)) return true;
  const hasDigit = /\d/.test(line);
  if (!hasDigit) {
    return /\b(street|avenue|boulevard|suite|floor|road|drive|lane|court|place)\b/i.test(line);
  }
  return STREET_RE.test(line);
}

function scoreTitle(line: string): number {
  if (line.length > 64) return 0;
  return TITLE_RE.test(line) ? 4 : 0;
}

function scoreCompany(line: string): number {
  if (line.length > 64) return 0;
  return COMPANY_RE.test(line) ? 4 : 0;
}

function scoreName(line: string): number {
  if (scoreTitle(line) >= 4 || scoreCompany(line) >= 4) return 0;
  if (/\d|@/.test(line) || line.length > 48) return 0;
  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 5) return 0;
  const wordOk = words.every(
    (word) => /^[A-Z][\p{L}'’.-]*\.?$/u.test(word) || /^(de|da|di|van|von|der|la|le)$/i.test(word),
  );
  if (!wordOk) return 0;
  return 2 + words.length;
}

function bestIndex(
  lines: string[],
  score: (line: string) => number,
  minimum: number,
  used: Set<number>,
): number {
  let best = -1;
  let bestScore = minimum - 1;
  lines.forEach((line, index) => {
    if (used.has(index)) return;
    const value = score(line);
    if (value > bestScore) {
      best = index;
      bestScore = value;
    }
  });
  return bestScore >= minimum ? best : -1;
}

function cleanName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /\p{L}/u.test(trimmed)) {
    return trimmed.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_match, boundary: string, letter: string) => {
      return `${boundary}${letter.toUpperCase()}`;
    });
  }
  return trimmed;
}

function dedupePhones(phones: PhoneNumber[]): PhoneNumber[] {
  const seen = new Set<string>();
  const out: PhoneNumber[] = [];
  for (const phone of phones) {
    const key = phone.number.replace(/\D/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(phone);
  }
  return out;
}
