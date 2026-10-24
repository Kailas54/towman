import { LOGOMARK, LOGO_GAP, WORDMARK } from '../brand/paths';
import { CONFIG, whatsappLink } from '../config';

function lockupSvg(markColor = '#FF6600', wordColor = '#FFFFFF') {
  const gap = LOGO_GAP * LOGOMARK.h;
  const wordY = (LOGOMARK.h - WORDMARK.h) / 2;
  const width = LOGOMARK.w + gap + WORDMARK.w;
  return `<svg viewBox="0 0 ${width} ${LOGOMARK.h}" role="img" aria-label="Towman">
    <path fill="${markColor}" fill-rule="evenodd" d="${LOGOMARK.d}"/>
    <path transform="translate(${LOGOMARK.w + gap} ${wordY})" fill="${wordColor}" fill-rule="evenodd" d="${WORDMARK.d}"/>
  </svg>`;
}

function markSvg() {
  return `<svg viewBox="-10 -10 ${LOGOMARK.w + 20} ${LOGOMARK.h + 20}" aria-hidden="true"><path fill-rule="evenodd" d="${LOGOMARK.d}"/></svg>`;
}

export function injectBrand() {
  document.querySelectorAll<HTMLElement>('[data-logo]').forEach((el) => {
    el.innerHTML = el.dataset.logo === 'mark-draw' ? markSvg() : lockupSvg();
  });

  document.querySelectorAll<HTMLAnchorElement>('[data-wa]').forEach((a) => {
    a.href = whatsappLink(a.dataset.waMsg ?? 'Hi Towman, I need roadside assistance.');
  });
  document.querySelectorAll<HTMLAnchorElement>('[data-tel]').forEach((a) => (a.href = `tel:${CONFIG.phoneTel}`));
  document.querySelectorAll<HTMLAnchorElement>('[data-web]').forEach((a) => (a.href = `https://${CONFIG.website}`));
  document.querySelectorAll('[data-phone]').forEach((el) => (el.textContent = CONFIG.phoneDisplay));
  document.querySelectorAll('[data-website]').forEach((el) => (el.textContent = CONFIG.website));
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
}
