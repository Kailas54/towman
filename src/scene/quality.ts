export type Tier = 'low' | 'high';

export interface Quality {
  tier: Tier;
  maxDpr: number;
  bloom: boolean;
  buildings: number;
  spotlight: boolean;
  /** Lets the renderer lower resolution / drop bloom at runtime when frames run long. */
  adaptive: boolean;
}

export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');

  const low = forced ? forced === 'low' : memory <= 4 || cores <= 4 || (coarse && smallScreen);

  const adaptive = !forced;
  return low
    ? { tier: 'low', maxDpr: 1.25, bloom: false, buildings: 70, spotlight: false, adaptive }
    : { tier: 'high', maxDpr: 1.5, bloom: true, buildings: 160, spotlight: true, adaptive };
}

/** Integrated / mobile / software GPUs skip bloom by default. */
export function isWeakGpu(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /intel|mali|adreno|powervr|swiftshader|llvmpipe|software|microsoft basic/i.test(name);
}
