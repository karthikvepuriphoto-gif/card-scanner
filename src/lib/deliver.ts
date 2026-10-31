import { planVCardDelivery, type ClientEnv } from './plan';
import { contactOpenUrl, handoffCacheUrl } from './urls';

const CACHE_NAME = 'vcard-handoff';

export interface ReadyDelivery {
  id: string;
  filename: string;
  vcf: string;
  cacheReady: boolean;
}

interface ForcedEnv {
  ios?: boolean;
  android?: boolean;
  standalone?: boolean;
  serviceWorkerControlled?: boolean;
}

declare global {
  interface Window {
    __cardScannerEnv?: ForcedEnv;
  }
}

export function detectEnvironment(): ClientEnv {
  const forced = window.__cardScannerEnv;
  const ua = navigator.userAgent;
  const iosDevice =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return {
    ios: forced?.ios ?? iosDevice,
    android: forced?.android ?? /Android/i.test(ua),
    standalone: forced?.standalone ?? standalone,
    serviceWorkerControlled: forced?.serviceWorkerControlled ?? Boolean(navigator.serviceWorker?.controller),
  };
}

export async function prepareHandoff(id: string, vcf: string, filename: string): Promise<boolean> {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return false;
  const controlled = await waitForController(15000);
  if (!controlled) return false;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    handoffCacheUrl(document.baseURI, id),
    new Response(vcf, {
      headers: {
        'Content-Type': 'text/vcard',
        'X-Filename': filename,
      },
    }),
  );
  return true;
}

export function openContact(delivery: ReadyDelivery): void {
  const env = detectEnvironment();
  const plan = planVCardDelivery({
    ...env,
    serviceWorkerControlled: env.serviceWorkerControlled && delivery.cacheReady,
  });
  if (plan.transport === 'service-worker') {
    const href = contactOpenUrl(document.baseURI, delivery.id, delivery.filename, plan.disposition);
    clickAnchor(href, { download: null, target: plan.target });
    return;
  }
  const blob = new Blob([delivery.vcf], { type: plan.mimeType });
  const href = URL.createObjectURL(blob);
  clickAnchor(href, {
    download: plan.useDownloadAttribute ? delivery.filename : null,
    target: plan.target === '_blank' && !plan.useDownloadAttribute ? '_blank' : null,
  });
  window.setTimeout(() => URL.revokeObjectURL(href), 15_000);
}

function clickAnchor(href: string, options: { download: string | null; target: string | null }): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  if (options.download) anchor.download = options.download;
  if (options.target) anchor.target = options.target;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

let controllerWait: Promise<boolean> | null = null;

function waitForController(timeoutMs: number): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(false);
  if (navigator.serviceWorker.controller) return Promise.resolve(true);
  if (!controllerWait) {
    controllerWait = new Promise((resolve) => {
      const finish = (ready: boolean) => {
        window.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        resolve(ready);
      };
      const onChange = () => finish(true);
      const timer = window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), timeoutMs);
      navigator.serviceWorker.addEventListener('controllerchange', onChange);
    });
  }
  return controllerWait;
}
