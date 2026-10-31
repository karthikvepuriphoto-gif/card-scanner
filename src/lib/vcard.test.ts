import { describe, expect, it } from 'vitest';
import { contactFilename, planVCardDelivery } from './plan';
import { contactOpenUrl } from './urls';
import { vcardHttpResponse } from './vcardResponse';
import { formatAdr, toVCard, unfoldVCard } from './vcard';
import type { ContactFields } from './types';

const jordan: ContactFields = {
  name: 'Jordan Lee',
  title: 'Product Designer',
  company: 'Northwind Studio',
  phones: [{ number: '+1 (415) 555-0148', kind: 'voice' }],
  email: 'jordan.lee@northwind.studio',
  website: 'www.northwind.studio',
  address: '123 Market Street, Suite 400\nSan Francisco, CA 94105',
  notes: 'Met at the ferry building',
};

describe('vCard 3.0', () => {
  it('builds a folded card with the photo and escaped address', () => {
    const photo = 'A'.repeat(180);
    const vcf = toVCard({ fields: jordan, photoBase64: photo, uid: 'card-1' });
    expect(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(vcf.trimEnd().endsWith('END:VCARD')).toBe(true);
    const flat = unfoldVCard(vcf);
    expect(flat).toContain('N:Lee;Jordan;;;');
    expect(flat).toContain('FN:Jordan Lee');
    expect(flat).toContain('ORG:Northwind Studio');
    expect(flat).toContain('TITLE:Product Designer');
    expect(flat).toContain('TEL;TYPE=VOICE:+1 (415) 555-0148');
    expect(flat).toContain('EMAIL;TYPE=INTERNET:jordan.lee@northwind.studio');
    expect(flat).toContain('URL:https://www.northwind.studio');
    expect(flat).toContain('ADR;TYPE=WORK:;;123 Market Street\\, Suite 400;San Francisco;CA;94105;');
    expect(flat).toContain('NOTE:Met at the ferry building');
    expect(flat).toContain(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`);
    expect(flat).toContain('UID:card-1');
    for (const line of vcf.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('puts a prefix and additional name in N', () => {
    const vcf = unfoldVCard(
      toVCard({
        fields: {
          ...jordan,
          name: 'Dr. Priya N. Shah',
          company: 'Helios Labs, Inc.',
          phones: [{ number: '+1 212 555 0199', kind: 'cell' }],
        },
      }),
    );
    expect(vcf).toContain('N:Shah;Priya;N.;Dr.;');
    expect(vcf).toContain('ORG:Helios Labs\\, Inc.');
    expect(vcf).toContain('TEL;TYPE=CELL:+1 212 555 0199');
  });

  it('formats a freeform address when there is no state and zip', () => {
    expect(formatAdr('88 Broad Street')).toBe(';;88 Broad Street;;;;');
  });
});

describe('contact delivery plan', () => {
  const base = { ios: false, android: false, standalone: false, serviceWorkerControlled: false };

  it('asks iOS Safari for the contact sheet, including from a home-screen app', () => {
    for (const standalone of [false, true]) {
      for (const serviceWorkerControlled of [false, true]) {
        const plan = planVCardDelivery({ ...base, ios: true, standalone, serviceWorkerControlled });
        expect(plan.mimeType).toBe('text/vcard');
        expect(plan.contentTypeOptions).toBe('nosniff');
        expect(plan.useDownloadAttribute).toBe(false);
        expect(plan.disposition).toBe('inline');
        expect(plan.target).toBe('_blank');
        expect(plan.transport).toBe(serviceWorkerControlled ? 'service-worker' : 'blob');
      }
    }
  });

  it('uses a vCard attachment on Android so the contacts app can open it', () => {
    const plan = planVCardDelivery({ ...base, android: true, serviceWorkerControlled: true });
    expect(plan.mimeType).toBe('text/vcard');
    expect(plan.disposition).toBe('attachment');
    expect(plan.transport).toBe('service-worker');
    expect(plan.useDownloadAttribute).toBe(false);
    const blob = planVCardDelivery({ ...base, android: true });
    expect(blob.useDownloadAttribute).toBe(true);
    expect(blob.transport).toBe('blob');
  });

  it('downloads a .vcf on desktop', () => {
    const plan = planVCardDelivery(base);
    expect(plan.useDownloadAttribute).toBe(true);
    expect(plan.transport).toBe('blob');
    expect(plan.mimeType).toBe('text/vcard');
  });

  it('keeps the vCard body out of the URL', () => {
    const url = contactOpenUrl('https://karthikvepuriphoto-gif.github.io/card-scanner/', 'card 1', 'Jordan-Lee.vcf', 'inline');
    expect(url).toContain('/card-scanner/add-contact.vcf?');
    expect(url).toContain('d=inline');
    expect(url).toContain('name=Jordan-Lee.vcf');
    expect(url).not.toContain('BEGIN');
    expect(url).not.toContain('555');
    expect(contactFilename('Jordan Lee')).toBe('Jordan-Lee.vcf');
  });

  it('serves text/vcard with nosniff and a .vcf filename', () => {
    const response = vcardHttpResponse('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jordan Lee\r\nEND:VCARD\r\n', 'Jordan-Lee.vcf', 'inline');
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toBe('text/vcard; charset=utf-8');
    expect(response.headers['Content-Disposition']).toBe('inline; filename="Jordan-Lee.vcf"');
    expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(response.headers['Cache-Control']).toBe('no-store');
    const bad = vcardHttpResponse('hello', 'x.vcf', 'inline');
    expect(bad.status).toBe(400);
  });
});
