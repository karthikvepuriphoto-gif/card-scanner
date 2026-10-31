import { describe, expect, it } from 'vitest';
import { parseCard } from './parseCard';

const JORDAN = `
Jordan Lee
Product Designer
Northwind Studio

123 Market Street, Suite 400
San Francisco, CA 94105
+1 (415) 555-0148
jordan.lee@northwind.studio
www.northwind.studio
`;

const PRIYA = `
Dr. Priya N. Shah
Chief Technology Officer
Helios Labs, Inc.
M: +1 212 555 0199
O: 212.555.0100
priya.shah@helioslabs.com
https://helioslabs.com
88 Broad Street
New York, NY 10004
`;

const SAM = `
SAM OKONKWO
Account Executive | Brightline Partners
sam@brightline.co
+44 20 7946 0958
+44 7700 900123
brightline.co
`;

describe('parseCard', () => {
  it('reads a standard card', () => {
    const card = parseCard(JORDAN);
    expect(card.name).toBe('Jordan Lee');
    expect(card.title).toBe('Product Designer');
    expect(card.company).toBe('Northwind Studio');
    expect(card.phones.map((phone) => phone.number)).toEqual(['+1 (415) 555-0148']);
    expect(card.email).toBe('jordan.lee@northwind.studio');
    expect(card.website).toBe('www.northwind.studio');
    expect(card.address).toBe('123 Market Street, Suite 400\nSan Francisco, CA 94105');
  });

  it('keeps phone labels, a prefixed name, and a company suffix', () => {
    const card = parseCard(PRIYA);
    expect(card.name).toBe('Dr. Priya N. Shah');
    expect(card.title).toBe('Chief Technology Officer');
    expect(card.company).toBe('Helios Labs, Inc.');
    expect(card.phones).toEqual([
      { number: '+1 212 555 0199', kind: 'cell' },
      { number: '212.555.0100', kind: 'work' },
    ]);
    expect(card.email).toBe('priya.shah@helioslabs.com');
    expect(card.website).toBe('https://helioslabs.com');
    expect(card.address).toContain('88 Broad Street');
    expect(card.address).toContain('New York, NY 10004');
  });

  it('splits a title and company on one line and keeps both phones', () => {
    const card = parseCard(SAM);
    expect(card.name).toBe('Sam Okonkwo');
    expect(card.title).toBe('Account Executive');
    expect(card.company).toBe('Brightline Partners');
    expect(card.email).toBe('sam@brightline.co');
    expect(card.website).toBe('brightline.co');
    expect(card.phones.map((phone) => phone.number.replace(/\D/g, ''))).toEqual(['442079460958', '447700900123']);
  });

  it('repairs spaces around an @ sign and ignores a zip code', () => {
    const card = parseCard('Ada Lovelace\nAnalyst\nAnalytical Engines Ltd\nada @ engines.co.uk\nSW1A 1AA\n+44 20 7946 0001');
    expect(card.email).toBe('ada@engines.co.uk');
    expect(card.phones).toHaveLength(1);
    expect(card.address).not.toContain('+44');
  });
});
