/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { vcardHttpResponse } from './lib/vcardResponse';
import { handoffCacheUrl } from './lib/urls';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

const HANDOFF_CACHE = 'vcard-handoff';

self.addEventListener('install', () => {
  void self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.pathname.endsWith('/add-contact.vcf')) return;
  event.respondWith(serveVCard(url));
});

precacheAndRoute(self.__WB_MANIFEST);

async function serveVCard(url: URL): Promise<Response> {
  const id = url.searchParams.get('id') ?? '';
  const disposition = url.searchParams.get('d') === 'attachment' ? 'attachment' : 'inline';
  const filename = url.searchParams.get('name') || 'contact.vcf';
  const cache = await caches.open(HANDOFF_CACHE);
  const cached = id ? await cache.match(handoffCacheUrl(self.registration.scope, id)) : undefined;
  const vcf = cached ? await cached.text() : '';
  const built = vcardHttpResponse(vcf, filename, disposition);
  return new Response(built.body, { status: built.status, headers: built.headers });
}
