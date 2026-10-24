import 'lenis/dist/lenis.css';
import './styles/main.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { injectBrand } from './ui/brand';
import { initContactForm } from './ui/contact';
import { initInteractions, introHero } from './ui/interactions';
import { buildStoryTimeline } from './story/timeline';
import { detectQuality } from './scene/quality';
import type { Experience } from './scene/Experience';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;

const preloader = document.querySelector<HTMLElement>('[data-preloader]')!;
const bar = document.querySelector<HTMLElement>('[data-preloader-bar]')!;
const pct = document.querySelector<HTMLElement>('[data-preloader-pct]')!;
const canvas = document.querySelector<HTMLCanvasElement>('[data-webgl]')!;
const storyEl = document.querySelector<HTMLElement>('[data-story]')!;
const hud = document.querySelector<HTMLElement>('[data-hud]')!;

const shown = { v: 0 };
function setProgress(p: number) {
  bar.style.transform = `scaleX(${p})`;
  gsap.to(shown, { v: p * 100, duration: 0.5, onUpdate: () => (pct.textContent = String(Math.round(shown.v))) });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.body.classList.add('is-loading');
injectBrand();
initContactForm();
setProgress(0.12);

async function boot() {
  // Truck livery text is drawn to canvas, so its fonts must be loaded before the scene is built.
  const fonts = Promise.all([document.fonts.load('700 40px Orbitron'), document.fonts.load('700 40px "Zalando Sans"')]).then(
    () => document.fonts.ready,
  );
  await Promise.race([fonts, wait(3000)]);
  setProgress(0.4);
  await frame();

  let experience: Experience | null = null;
  try {
    const { Experience } = await import('./scene/Experience');
    experience = new Experience(canvas, detectQuality());
    setProgress(0.8);
    await frame();
    experience.warmup();
    if (import.meta.env.DEV) Object.assign(window, { __exp: experience, __st: ScrollTrigger });
  } catch (err) {
    console.warn('WebGL unavailable, continuing without the 3D scene.', err);
    canvas.remove();
    document.body.classList.add('no-webgl');
  }
  setProgress(1);

  const lenis = reduceMotion ? null : new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis?.on('scroll', ScrollTrigger.update);

  // The 3D scene only renders while the story is on screen; the HUD hides as the story ends.
  let storyBottom = 0;
  const measure = () => (storyBottom = storyEl.offsetTop + storyEl.offsetHeight);
  measure();
  ScrollTrigger.addEventListener('refresh', measure);
  let hudOff = false;
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
    const y = window.scrollY;
    const off = y > storyBottom - window.innerHeight * 1.15;
    if (off !== hudOff) hud.classList.toggle('is-off', (hudOff = off));
    experience?.setActive(!document.hidden && y < storyBottom);
    experience?.tick(time);
  });
  gsap.ticker.lagSmoothing(0);

  buildStoryTimeline(storyEl, touch);

  initInteractions(lenis);

  await wait(500);
  gsap.to(preloader, {
    autoAlpha: 0,
    duration: 0.9,
    ease: 'power2.inOut',
    onComplete: () => preloader.remove(),
  });
  document.body.classList.remove('is-loading');
  introHero();
  ScrollTrigger.refresh();
}

boot();
