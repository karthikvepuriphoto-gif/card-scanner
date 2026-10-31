export interface VCardHttpResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

/**
 * Headers iOS Safari uses to present Add to Contacts instead of saving a .vcf.txt file.
 * Content-Type must be text/vcard, nosniff stops the iOS 18 plain-text sniff, and the
 * filename keeps the .vcf extension. Inline disposition asks Safari for the contact
 * sheet; attachment is what Chrome on Android hands to the contacts app.
 */
export function vcardHttpResponse(
  vcf: string,
  filename: string,
  disposition: 'inline' | 'attachment',
): VCardHttpResponse {
  const safeName = (filename || 'contact.vcf').replace(/[\r\n"]/g, '').replace(/[^\w.\- ]+/g, '') || 'contact.vcf';
  const named = safeName.toLowerCase().endsWith('.vcf') ? safeName : `${safeName}.vcf`;
  if (!vcf.includes('BEGIN:VCARD') || !vcf.includes('END:VCARD')) {
    return {
      status: 400,
      body: 'Not a vCard',
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    };
  }
  return {
    status: 200,
    body: vcf,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `${disposition}; filename="${named}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  };
}
