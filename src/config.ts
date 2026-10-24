export const CONFIG = {
  // International format, digits only (no "+", spaces or leading zeros), e.g. 9715XXXXXXXX.
  whatsappNumber: '971586012288',
  phoneDisplay: '+971 58 601 2288',
  phoneTel: '+971586012288',
  website: 'towman.ae',
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
