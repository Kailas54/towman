import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type Lenis from 'lenis';

const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function introHero() {
  const title = document.querySelector<HTMLElement>('.hero__title');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  if (title) {
    SplitText.create(title, {
      type: 'lines,words',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) => gsap.from(self.words, { yPercent: 110, duration: 1.3, stagger: 0.06, ease: 'expo.out', delay: 0.1 }),
    });
  }
  tl.from('.hero .eyebrow, .hero__lead, .hero__ctas, .scroll-cue', { y: 30, autoAlpha: 0, duration: 1.1, stagger: 0.1 }, 0.4);
  // Opacity only: .nav and .wa-fab transition `transform` in CSS for hide-on-scroll / hover.
  tl.from('.nav', { autoAlpha: 0, duration: 1 }, 0.3);
  tl.from('.wa-fab', { autoAlpha: 0, duration: 0.9 }, 1);
  return tl;
}

function reveals() {
  document.querySelectorAll<HTMLElement>('.content [data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.words, {
          yPercent: 110,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.04,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        }),
    });
  });

  gsap.utils.toArray<HTMLElement>('.section__lead, .section .eyebrow, .chips, .contact__direct').forEach((el) => {
    gsap.from(el, { y: 30, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
    gsap.from(group.children, {
      y: 50,
      autoAlpha: 0,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.09,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });

  gsap.from('.form', { y: 60, autoAlpha: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.form', start: 'top 88%', once: true } });

  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => (el.textContent = String(Math.round(obj.v))),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  const line = document.querySelector<HTMLElement>('[data-steps-line]');
  if (line) {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 861px)', () => {
      gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '[data-steps]', start: 'top 75%', end: 'bottom 55%', scrub: true } });
    });
    mm.add('(max-width: 860px)', () => {
      gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '[data-steps]', start: 'top 70%', end: 'bottom 60%', scrub: true } });
    });
  }

  const visual = document.querySelector<HTMLElement>('[data-parallax] img');
  if (visual) {
    gsap.fromTo(visual, { xPercent: -8, scale: 0.96 }, { xPercent: 6, scale: 1.02, ease: 'none', scrollTrigger: { trigger: visual, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}

function marquee() {
  const track = document.querySelector<HTMLElement>('[data-marquee]');
  if (!track) return;
  track.innerHTML += track.innerHTML;
  const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    trigger: track,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 600, 5);
      gsap.to(loop, { timeScale: boost * (self.direction < 0 ? -1 : 1), duration: 0.3, overwrite: true });
      gsap.to(loop, { timeScale: self.direction < 0 ? -1 : 1, duration: 1.2, delay: 0.3 });
    },
  });
}

function tiltCards() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      ry((px - 0.5) * 10);
      rx((0.5 - py) * 10);
    });
    card.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}

function magneticButtons() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('.btn--wa').forEach((btn) => {
    const x = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.25);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    btn.addEventListener('pointerleave', () => {
      x(0);
      y(0);
    });
  });
}

function navBehaviour(lenis: Lenis | null) {
  const nav = document.querySelector<HTMLElement>('[data-nav]')!;
  const navH = () => nav.offsetHeight;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', self.direction === 1 && y > window.innerHeight * 1.5);
    },
  });

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      const target = id === '#top' || id === '#story' ? 0 : document.querySelector<HTMLElement>(id);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: typeof target === 'number' ? 0 : -navH() + 1, duration: 1.8 });
      else if (typeof target === 'number') window.scrollTo({ top: 0 });
      else target.scrollIntoView();
    });
  });
}

function fabHint() {
  const fab = document.querySelector<HTMLElement>('.wa-fab');
  if (!fab) return;
  window.setTimeout(() => {
    fab.classList.add('is-hinting');
    window.setTimeout(() => fab.classList.remove('is-hinting'), 4000);
  }, 7000);
}

export function initInteractions(lenis: Lenis | null) {
  reveals();
  marquee();
  tiltCards();
  magneticButtons();
  navBehaviour(lenis);
  fabHint();
}
