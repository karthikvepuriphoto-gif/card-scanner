export interface ClientEnv {
  ios: boolean;
  android: boolean;
  standalone: boolean;
  serviceWorkerControlled: boolean;
}

export interface VCardPlan {
  mimeType: 'text/vcard';
  /**
   * iOS Safari saves a download-attribute blob as contact.vcf.txt and skips Contacts.
   * The attribute stays off on iOS. Android blob downloads use it so Chrome offers
   * the contacts app. A service-worker response sets Content-Disposition instead.
   */
  useDownloadAttribute: boolean;
  disposition: 'inline' | 'attachment';
  target: '_blank' | '_self';
  transport: 'service-worker' | 'blob';
  contentTypeOptions: 'nosniff';
}

export function planVCardDelivery(env: ClientEnv): VCardPlan {
  if (env.ios) {
    return {
      mimeType: 'text/vcard',
      useDownloadAttribute: false,
      disposition: 'inline',
      // Home Screen web apps swallow an in-place vCard navigation. A new context
      // is handed to Safari, which presents Create New Contact for text/vcard.
      target: '_blank',
      transport: env.serviceWorkerControlled ? 'service-worker' : 'blob',
      contentTypeOptions: 'nosniff',
    };
  }
  if (env.android) {
    return {
      mimeType: 'text/vcard',
      useDownloadAttribute: !env.serviceWorkerControlled,
      disposition: 'attachment',
      target: '_blank',
      transport: env.serviceWorkerControlled ? 'service-worker' : 'blob',
      contentTypeOptions: 'nosniff',
    };
  }
  return {
    mimeType: 'text/vcard',
    useDownloadAttribute: true,
    disposition: 'attachment',
    target: '_self',
    transport: 'blob',
    contentTypeOptions: 'nosniff',
  };
}

export function contactFilename(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'contact'}.vcf`;
}
