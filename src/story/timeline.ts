import { gsap } from 'gsap';
import { story } from './state';

const STATUS: [number, string][] = [
  [0, 'SOS received'],
  [1.2, 'En route'],
  [3.0, 'On site'],
  [4.4, 'Deploying bed'],
  [6.5, 'Winching'],
  [8.6, 'Secured'],
  [10, 'Back on the road'],
];

export function buildStoryTimeline(root: HTMLElement, touch: boolean) {
  const hero = root.querySelector<HTMLElement>('.hero')!;
  const captions = gsap.utils.toArray<HTMLElement>('.caption', root);
  const status = document.querySelector<HTMLElement>('[data-hud-status]');
  const progress = document.querySelector<HTMLElement>('[data-hud-progress]');
  const percent = document.querySelector<HTMLElement>('[data-hud-percent]');
  const dots = gsap.utils.toArray<HTMLElement>('[data-hud-dot]');

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      scrub: touch ? 0.6 : 1,
      onUpdate: (self) => updateHud(self.progress),
    },
  });

  const cam = story.cam;
  const camTo = (at: number, duration: number, vars: Partial<typeof cam>, ease = 'sine.inOut') =>
    tl.to(cam, { ...vars, duration, ease }, at);
  const set = (at: number, duration: number, vars: Partial<typeof story>, ease = 'none') =>
    tl.to(story, { ...vars, duration, ease }, at);

  // Arrival
  tl.to(hero, { autoAlpha: 0, y: -60, duration: 0.45, ease: 'power1.in' }, 0);
  camTo(0, 1.2, { x: 5, y: 2.2, z: -17, tx: 2, ty: 1, tz: -4 });
  set(0.6, 2.2, { arrive: 1 }, 'power2.out');
  set(0.9, 0.8, { lookTruck: 0.55 }, 'sine.inOut');
  set(1.2, 0.3, { beacons: 1 });
  camTo(1.2, 1.6, { x: 2, y: 3.2, z: -19, tx: 10, ty: 1, tz: -4 });
  set(2.3, 0.2, { brake: 1 });
  set(2.4, 0.6, { lookTruck: 0 }, 'sine.inOut');

  // Reverse up to the car (screen-left is +X: the truck backs in from the left)
  set(2.9, 0.15, { reverse: 1 });
  set(3.0, 1.3, { backup: 1 }, 'sine.inOut');
  camTo(2.8, 1.6, { x: 8, y: 3.2, z: -22, tx: 8, ty: 2.2, tz: -5.4 });
  set(4.3, 0.15, { reverse: 0, brake: 0.25 });

  // Bed slides back and tilts down
  set(4.4, 0.7, { slide: 1 }, 'power1.inOut');
  set(5.1, 0.7, { tilt: 1 }, 'power1.inOut');
  camTo(4.4, 1.4, { x: -4.5, y: 3.4, z: -16, tx: 5.5, ty: 1.1, tz: -5.4 });

  // Hook up
  set(5.8, 0.6, { cable: 1 }, 'power1.out');
  camTo(5.8, 0.7, { x: -0.5, y: 1.7, z: -11.5, tx: 3.4, ty: 0.7, tz: -5.4 });

  // Winch the car onto the deck
  set(6.5, 2.0, { winch: 1 }, 'sine.inOut');
  set(6.5, 1.0, { smoke: 0 });
  camTo(6.5, 2.0, { x: 7, y: 4.8, z: -18.5, tx: 6.5, ty: 1.5, tz: -5.4 });

  // Bed returns to the road position
  set(8.6, 0.6, { tilt: 0 }, 'power1.inOut');
  set(9.2, 0.7, { slide: 0 }, 'power1.inOut');
  camTo(8.6, 1.3, { x: 21, y: 2.8, z: -17, tx: 9.5, ty: 1.5, tz: -5.4 });

  // Drive off into the dawn
  set(10, 2.2, { depart: 1 }, 'power2.in');
  set(10, 0.8, { camFollow: 1 }, 'sine.in');
  camTo(10, 2.2, { x: 17, y: 4.2, z: -21, tx: 15, ty: 3.6, tz: -4 });
  set(10.6, 1.6, { dawn: 1 });

  const windows: [number, number | null][] = [
    [0.45, 1.7],
    [1.8, 3.9],
    [4.3, 5.75],
    [5.9, 8.45],
    [8.7, 9.95],
    [10.4, null],
  ];
  captions.forEach((el, i) => {
    const [a, b] = windows[i] ?? [0, null];
    tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, a);
    if (b !== null) tl.to(el, { autoAlpha: 0, y: -40, duration: 0.35, ease: 'power2.in' }, b - 0.35);
  });

  const total = tl.duration();
  let lastStatus = '';
  function updateHud(p: number) {
    const t = p * total;
    let label = STATUS[0][1];
    let chapter = 0;
    STATUS.forEach(([at, text], i) => {
      if (t >= at) {
        label = text;
        chapter = i;
      }
    });
    if (status && label !== lastStatus) {
      status.textContent = label;
      lastStatus = label;
    }
    if (progress) progress.style.transform = `scaleY(${p})`;
    if (percent) percent.textContent = String(Math.round(p * 100)).padStart(3, '0');
    dots.forEach((d, i) => d.classList.toggle('is-active', i <= Math.min(chapter, dots.length - 1)));
  }
  updateHud(0);

  return tl;
}
