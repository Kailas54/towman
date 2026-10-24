export const CONFIG = {
  // International format, digits only (no "+", spaces or leading zeros), e.g. 9715XXXXXXXX.
  whatsappNumber: '971500000000',
  phoneDisplay: '984 953',
  phoneTel: '984953',
  website: 'towman.ae',
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
