import { expect, test } from '@playwright/test';

test('sample card fills the form and save serves an iOS vCard', async ({ page }) => {
  await page.goto('/card-scanner/');
  await expect(page.getByRole('heading', { name: 'Card Scanner' })).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/scan_screen.png' });

  await page.getByRole('button', { name: 'Try sample' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Jordan Lee', { timeout: 90_000 });
  await expect(page.getByLabel('Job title')).toHaveValue('Product Designer');
  await expect(page.getByLabel('Company')).toHaveValue('Northwind Studio');
  await expect(page.getByLabel('Email')).toHaveValue('jordan.lee@northwind.studio');
  await expect(page.getByLabel('Website')).toHaveValue('www.northwind.studio');
  await expect(page.getByRole('textbox', { name: 'Phone' })).toHaveValue('+1 (415) 555-0148');
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(/123 Market Street, Suite 400/);
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(/San Francisco, CA 94105/);
  await page.screenshot({ path: '/opt/cursor/artifacts/review_form.png', fullPage: true });

  const save = page.getByRole('button', { name: 'Add to Contacts' });
  await expect(save).toBeEnabled();
  await expect(page.locator('[data-handoff="cache"]')).toBeVisible();

  await page.evaluate(() => {
    const record = { anchors: [] as { target: string; download: string | null; href: string }[] };
    (window as unknown as { __anchors: typeof record.anchors }).__anchors = record.anchors;
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      record.anchors.push({
        target: this.target,
        download: this.getAttribute('download'),
        href: this.href,
      });
      return original.call(this);
    };
  });

  await page.evaluate(() => {
    (window as Window & { __cardScannerEnv?: { ios: boolean; android: boolean; standalone: boolean } }).__cardScannerEnv = {
      ios: true,
      android: false,
      standalone: true,
    };
  });

  await save.click({ noWaitAfter: true });
  const opened = await page.evaluate(() => (window as unknown as { __anchors: { target: string; download: string | null; href: string }[] }).__anchors[0]);
  expect(opened, 'Save should open a vCard link').toBeTruthy();
  expect(opened.download).toBeNull();
  expect(opened.target).toBe('_blank');
  expect(opened.href).toContain('add-contact.vcf');
  expect(opened.href).toContain('d=inline');
  expect(opened.href).not.toContain('BEGIN');

  const delivered = await page.evaluate(async () => {
    const cache = await caches.open('vcard-handoff');
    const keys = await cache.keys();
    const key = keys.find((request) => request.url.includes('/vcard-cache/'));
    if (!key) return { error: 'missing handoff', keys: keys.map((item) => item.url) };
    const id = decodeURIComponent(key.url.split('/vcard-cache/')[1] ?? '');
    const url = new URL('add-contact.vcf', document.baseURI);
    url.searchParams.set('id', id);
    url.searchParams.set('name', 'Jordan-Lee.vcf');
    url.searchParams.set('d', 'inline');
    const response = await fetch(url.href);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    return { status: response.status, headers, body: await response.text() };
  });
  expect(delivered, JSON.stringify(delivered)).toMatchObject({ status: 200 });
  const headers = 'headers' in delivered ? delivered.headers : {};
  const body = 'body' in delivered ? delivered.body : '';
  expect(headers['content-type']).toContain('text/vcard');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-disposition']).toContain('inline;');
  expect(headers['content-disposition']).toContain('.vcf');
  expect(body).toContain('VERSION:3.0');
  expect(body).toContain('FN:Jordan Lee');
  expect(body).toContain('N:Lee;Jordan;;;');
  expect(body).toContain('ORG:Northwind Studio');
  expect(body).toContain('TITLE:Product Designer');
  expect(body).toContain('TEL;TYPE=VOICE:+1 (415) 555-0148');
  expect(body).toContain('EMAIL;TYPE=INTERNET:jordan.lee@northwind.studio');
  expect(body).toContain('URL:https://www.northwind.studio');
  expect(body).toContain('PHOTO;ENCODING=b;TYPE=JPEG:');
  expect(body).toContain('END:VCARD');
  for (const line of body.split('\r\n')) {
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  }

  await expect(page.getByRole('button', { name: 'Scan next card' })).toBeVisible();
  await page.getByRole('button', { name: 'View saved cards' }).click();
  await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Jordan Lee/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to contacts' })).toBeEnabled();
  await page.screenshot({ path: '/opt/cursor/artifacts/saved_list.png' });

  await page.getByRole('button', { name: 'Scan' }).click();
  await expect(page.getByRole('heading', { name: 'Card Scanner' })).toBeVisible();
});
