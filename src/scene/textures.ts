import * as THREE from 'three';
import { LOGOMARK, WORDMARK } from '../brand/paths';

export const BRAND = {
  blue: '#00159B',
  orange: '#FF6600',
  white: '#FFFFFF',
  black: '#000000',
  navy: '#060b22',
} as const;

const markPath = new Path2D(LOGOMARK.d);
const wordPath = new Path2D(WORDMARK.d);

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Draws the logomark with its top-left corner at (x, y) and the given height. */
export function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  const s = h / LOGOMARK.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fill(markPath, 'evenodd');
  ctx.restore();
  return LOGOMARK.w * s;
}

export function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  const s = h / WORDMARK.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fill(wordPath, 'evenodd');
  ctx.restore();
  return WORDMARK.w * s;
}

/** Full horizontal lockup: mark + wordmark, vertically centred like the master artwork. */
function drawLockup(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, markColor: string, wordColor: string) {
  const mw = drawMark(ctx, x, y, h, markColor);
  const wh = h * (WORDMARK.h / LOGOMARK.h);
  return mw + h * 0.17 + drawWordmark(ctx, x + mw + h * 0.17, y + (h - wh) / 2, wh, wordColor);
}

const DISPLAY_FONT = `'Conthrax', 'Orbitron', sans-serif`;

/** Lower body panel on the chassis between the cab and rear wheels. */
export function makeSkirtTexture() {
  const W = 2048;
  const H = 372;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = BRAND.blue;
  ctx.fillRect(0, 0, W, H);

  // Orange diagonal block with the mark, as on the vehicle livery.
  ctx.fillStyle = BRAND.orange;
  ctx.beginPath();
  ctx.moveTo(W * 0.66, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(W * 0.6, H);
  ctx.closePath();
  ctx.fill();
  drawMark(ctx, W * 0.79, H * 0.16, H * 0.68, BRAND.white);

  drawLockup(ctx, W * 0.06, H * 0.2, H * 0.36, BRAND.white, BRAND.white);
  ctx.fillStyle = BRAND.white;
  ctx.font = `600 ${H * 0.1}px 'Zalando Sans', sans-serif`;
  ctx.fillText('Towman Recovery Service', W * 0.2, H * 0.78);
  return toTexture(c);
}

/** The thin blue strip along the side of the flatbed deck. */
export function makeDeckStripTexture() {
  const W = 2048;
  const H = 128;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = BRAND.blue;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = BRAND.orange;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * 0.27, 0);
  ctx.lineTo(W * 0.24, H);
  ctx.lineTo(0, H);
  ctx.fill();

  ctx.fillStyle = BRAND.white;
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${H * 0.36}px ${DISPLAY_FONT}`;
  const fit = (text: string, x: number, maxW: number, align: CanvasTextAlign) => {
    ctx.save();
    const w = ctx.measureText(text).width;
    const s = Math.min(1, maxW / w);
    ctx.translate(x, H * 0.52);
    ctx.scale(s, 1);
    ctx.textAlign = align;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  fit('LOCATION DETAILS', W * 0.02, W * 0.2, 'left');
  fit('WWW.TOWMAN.AE', W * 0.29, W * 0.22, 'left');
  fit('[FOR FAST RECOVERY] · CALL 984 953', W * 0.98, W * 0.44, 'right');
  return toTexture(c);
}

/** Cab side door art: blue body with a large cropped mark and an orange sweep at the sill. */
export function makeCabTexture() {
  const W = 1024;
  const H = 1024;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = BRAND.blue;
  ctx.fillRect(0, 0, W, H);
  drawMark(ctx, W * 0.3, H * 0.38, H * 0.78, BRAND.white);
  ctx.fillStyle = BRAND.orange;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.84);
  ctx.lineTo(W, H * 0.7);
  ctx.lineTo(W, H * 0.8);
  ctx.lineTo(0, H);
  ctx.fill();
  drawWordmark(ctx, W * 0.06, H * 0.47, H * 0.045, BRAND.white);

  // Front wheel well. Texture spans cab x 2.2→4.35 m and y 0.8→2.75 m; wheel sits at x 3.3, y 0.5.
  ctx.fillStyle = '#05060a';
  ctx.beginPath();
  ctx.ellipse(((3.3 - 2.2) / 2.15) * W, H * (1 + 0.3 / 1.95), (0.64 / 2.15) * W, (0.64 / 1.95) * H, 0, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

export function makeHeadboardTexture() {
  const W = 240;
  const H = 800;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = BRAND.orange;
  ctx.fillRect(0, 0, W, H);
  const mh = W * 0.74 * (LOGOMARK.h / LOGOMARK.w);
  drawMark(ctx, W * 0.13, H * 0.3, mh, BRAND.white);
  return toTexture(c);
}

export function makeRoadTexture() {
  const W = 1024;
  const H = 1024;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#12141b';
  ctx.fillRect(0, 0, W, H);

  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n + 2;
  }
  ctx.putImageData(img, 0, 0);

  // Road is 15 m wide; canvas top = shoulder side (z = -7.5).
  const zToY = (z: number) => ((z + 7.5) / 15) * H;
  const line = (z: number, width: number, color: string, dashed = false) => {
    ctx.fillStyle = color;
    const y = zToY(z) - width / 2;
    if (!dashed) ctx.fillRect(0, y, W, width);
    else for (let x = 0; x < W; x += 256) ctx.fillRect(x, y, 128, width);
  };
  line(-7.2, 10, '#d8dbe6');
  line(-3.6, 10, '#d8dbe6');
  line(-0.12, 8, '#ff7a1a');
  line(0.12, 8, '#ff7a1a');
  line(3.6, 9, '#d8dbe6', true);
  line(7.2, 10, '#d8dbe6');

  const t = toTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makeWindowsTexture() {
  const W = 512;
  const H = 1024;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const palette = ['#ffcf8a', '#9fc4ff', '#ffffff', '#ff9a4d'];
  for (let y = 6; y < H; y += 10) {
    for (let x = 4; x < W; x += 8) {
      if (Math.random() < 0.18) {
        ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
        ctx.globalAlpha = 0.25 + Math.random() * 0.6;
        ctx.fillRect(x, y, 4, 5);
      }
    }
  }
  ctx.globalAlpha = 1;
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

export function makeShadowTexture() {
  const W = 256;
  const H = 128;
  const { c, ctx } = canvas(W, H);
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.setTransform(1, 0, 0, H / W, 0, 0);
  ctx.fillRect(0, 0, W, W);
  return toTexture(c, false);
}
