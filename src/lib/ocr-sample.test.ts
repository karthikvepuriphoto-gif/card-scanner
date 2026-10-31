import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import Tesseract from 'tesseract.js';
import { parseCard } from './parseCard';

describe('sample business card', () => {
  it('scans public/samples/jordan-lee.png into contact fields', async () => {
    const worker = await Tesseract.createWorker('eng');
    try {
      await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
      const image = await readFile(new URL('../../public/samples/jordan-lee.png', import.meta.url));
      const result = await worker.recognize(image);
      const card = parseCard(result.data.text);
      expect(card.name).toBe('Jordan Lee');
      expect(card.title).toBe('Product Designer');
      expect(card.company).toBe('Northwind Studio');
      expect(card.email).toBe('jordan.lee@northwind.studio');
      expect(card.website).toBe('www.northwind.studio');
      expect(card.phones[0]?.number).toContain('415');
      expect(card.phones[0]?.number).toContain('555-0148');
      expect(card.address).toContain('123 Market Street');
      expect(card.address).toContain('San Francisco');
      expect(card.address).toContain('94105');
    } finally {
      await worker.terminate();
    }
  }, 90_000);
});
