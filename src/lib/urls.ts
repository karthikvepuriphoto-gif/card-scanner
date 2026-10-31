/** Resolve a path against the app base, which may be a directory or index.html. */
export function withBase(base: string, path: string): string {
  const normalized = base.endsWith('/') ? base : new URL('./', base).href;
  return new URL(path, normalized).href;
}

export function handoffCacheUrl(base: string, id: string): string {
  return withBase(base, `vcard-cache/${encodeURIComponent(id)}`);
}

/** Short navigation URL. The vCard body stays in the Cache API, not the query string. */
export function contactOpenUrl(
  base: string,
  id: string,
  filename: string,
  disposition: 'inline' | 'attachment',
): string {
  const url = new URL(withBase(base, 'add-contact.vcf'));
  url.searchParams.set('id', id);
  url.searchParams.set('name', filename);
  url.searchParams.set('d', disposition);
  return url.href;
}
