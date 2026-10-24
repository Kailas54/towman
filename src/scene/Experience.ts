import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Environment } from './Environment';
import { TowTruck } from './Truck';
import { BrokenCar } from './Car';
import { makeGlowTexture, makeShadowTexture, BRAND } from './textures';
import { mats } from './parts';
import { isWeakGpu, type Quality } from './quality';
import { story } from '../story/state';

export const CAR_X = 0;
export const CAR_Z = -5.4;
const LANE_Z = -1.8;
const ARRIVE_FROM = -120;
const ARRIVE_TO = 26;
const DEPART_DIST = 170;

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const dSmoothstep = (a: number, b: number, x: number) => {
  const t = (x - a) / (b - a);
  return t <= 0 || t >= 1 ? 0 : (6 * t * (1 - t)) / (b - a);
};

export class Experience {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
  readonly stopX: number;

  private composer?: EffectComposer;
  private readonly env: Environment;
  private readonly truck: TowTruck;
  private readonly car: BrokenCar;
  private readonly cable: THREE.Mesh;
  private readonly hook: THREE.Mesh;
  private readonly hazardLight: THREE.PointLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly fog: THREE.FogExp2;

  private readonly carFinalX: number;
  private readonly carOnBed = new THREE.Matrix4();
  private readonly deck: THREE.Vector3[] = [];
  private readonly pointer = new THREE.Vector2();
  private readonly pointerSmooth = new THREE.Vector2();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  private dpr: number;
  private readonly adaptive: boolean;
  private active = true;
  private frameTimes: number[] = [];
  private lastTime = 0;
  private width = 1;
  private height = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    quality: Quality,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    this.adaptive = quality.adaptive;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();

    this.fog = new THREE.FogExp2('#07103a', 0.0078);
    this.scene.fog = this.fog;

    this.hemi = new THREE.HemisphereLight('#3d56c9', '#05060a', 0.9);
    const moon = new THREE.DirectionalLight('#9fb4ff', 1.4);
    moon.position.set(-30, 40, -20);
    const rim = new THREE.DirectionalLight(BRAND.orange, 0.6);
    rim.position.set(40, 12, 60);
    this.scene.add(this.hemi, moon, rim);

    const glow = makeGlowTexture();
    const shadow = makeShadowTexture();
    const smokeTex = makeGlowTexture('rgba(210,215,230,0.9)', 'rgba(210,215,230,0)');

    this.env = new Environment(quality.buildings, glow);
    this.truck = new TowTruck(glow, shadow, quality.spotlight);
    this.car = new BrokenCar(smokeTex, shadow);
    this.scene.add(this.env.group, this.truck.root, this.car.root, this.car.shadow);

    this.hazardLight = new THREE.PointLight('#ff8a1a', 0, 12, 1.8);
    this.scene.add(this.hazardLight);

    const cableMat = new THREE.MeshStandardMaterial({
      color: BRAND.orange,
      emissive: BRAND.orange,
      emissiveIntensity: 0.8,
      roughness: 0.6,
    });
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), cableMat);
    this.hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 8, 16), mats.chrome);
    this.scene.add(this.cable, this.hook);

    // Pre-solve the loading geometry: where the truck stops and where the car ends up on the deck.
    this.car.root.position.set(CAR_X, 0, CAR_Z);
    this.truck.update(0, { odometer: 0, beacons: 0, brake: 0, reverse: 0, slide: 1, tilt: 1 });
    this.truck.root.position.set(0, 0, CAR_Z);
    this.truck.root.updateMatrixWorld(true);
    const tip = this.truck.bedSlider.localToWorld(new THREE.Vector3(-2.2, 0, 0));
    this.stopX = CAR_X + this.car.length / 2 + 0.45 - tip.x;
    this.truck.root.position.x = this.stopX;
    this.truck.root.updateMatrixWorld(true);
    this.carFinalX = this.truck.bedSlider.localToWorld(new THREE.Vector3(1.25, 0.32, 0)).x;
    this.poseCarOnSurface(this.carFinalX);
    this.car.root.updateMatrixWorld(true);
    this.carOnBed.copy(this.truck.bedSlider.matrixWorld).invert().multiply(this.car.root.matrixWorld);

    const forcedHigh = !quality.adaptive && quality.tier === 'high';
    if (quality.bloom && (forcedHigh || !isWeakGpu(this.renderer.getContext()))) this.setupComposer();

    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.apply(0);
  }

  private setupComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.dpr >= 1.5 ? 2 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.82));
    this.composer.addPass(new OutputPass());
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.dpr);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 58 : 42;
    this.camera.updateProjectionMatrix();
  }

  setActive(active: boolean) {
    this.active = active;
  }

  /**
   * Compiles every shader up front so the first scroll doesn't hitch, then times a few
   * GPU-synchronised frames to pick a starting quality before the page is revealed.
   */
  warmup() {
    this.renderer.compile(this.scene, this.camera);
    this.render();
    if (!this.adaptive) return;

    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    const bench = () => {
      const t0 = performance.now();
      for (let i = 0; i < 6; i++) {
        this.apply(i / 60);
        this.render();
      }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return (performance.now() - t0) / 6;
    };
    bench();
    let ms = bench();
    if (ms > 22 && this.composer) {
      this.composer.dispose();
      this.composer = undefined;
      ms = bench();
    }
    if (ms > 20 && this.dpr > 1) {
      this.dpr = 1;
      this.renderer.setPixelRatio(1);
      this.width = 0;
      this.resize();
    }
  }

  private poseCarOnSurface(x: number) {
    const half = this.car.wheelbase / 2;
    const hf = this.surfaceHeight(x + half);
    const hr = this.surfaceHeight(x - half);
    this.car.root.position.set(x, (hf + hr) / 2, CAR_Z);
    this.car.root.rotation.set(0, 0, Math.asin(THREE.MathUtils.clamp((hf - hr) / this.car.wheelbase, -1, 1)));
  }

  private surfaceHeight(x: number) {
    const p = this.truck.deckPolyline(this.deck);
    if (x <= p[0].x) return 0;
    for (let i = 0; i < p.length - 1; i++) {
      if (x <= p[i + 1].x) return Math.max(0, THREE.MathUtils.mapLinear(x, p[i].x, p[i + 1].x, p[i].y, p[i + 1].y));
    }
    return p[p.length - 1].y;
  }

  /** Maps the story state onto the scene graph. */
  private apply(time: number) {
    const s = story;

    // Truck path: arrive in the lane, pull onto the shoulder past the car, reverse up, then leave.
    let x: number;
    let z: number;
    let dzdx = 0;
    if (s.depart > 0) {
      x = this.stopX + s.depart * DEPART_DIST;
      const a = this.stopX + 8;
      const b = this.stopX + 34;
      z = THREE.MathUtils.lerp(CAR_Z, LANE_Z, smoothstep(a, b, x));
      dzdx = (LANE_Z - CAR_Z) * dSmoothstep(a, b, x);
    } else if (s.backup > 0) {
      x = THREE.MathUtils.lerp(ARRIVE_TO, this.stopX, s.backup);
      z = CAR_Z;
    } else {
      x = THREE.MathUtils.lerp(ARRIVE_FROM, ARRIVE_TO, s.arrive);
      z = THREE.MathUtils.lerp(LANE_Z, CAR_Z, smoothstep(9, 24, x));
      dzdx = (CAR_Z - LANE_Z) * dSmoothstep(9, 24, x);
    }
    const odometer = s.arrive * (ARRIVE_TO - ARRIVE_FROM) - s.backup * (ARRIVE_TO - this.stopX) + s.depart * DEPART_DIST;
    this.truck.root.position.set(x, 0, z);
    this.truck.root.rotation.y = -Math.atan(dzdx);
    this.truck.update(time, { odometer, beacons: s.beacons, brake: s.brake, reverse: s.reverse, slide: s.slide, tilt: s.tilt });
    this.truck.root.updateMatrixWorld(true);

    // Car: on the road until the winch pulls it up, then rides with the bed.
    let carSpin: number;
    if (s.winch >= 1 && (s.tilt < 1 || s.slide < 1 || s.depart > 0)) {
      this.car.root.matrix.multiplyMatrices(this.truck.bedSlider.matrixWorld, this.carOnBed);
      this.car.root.matrix.decompose(this.car.root.position, this.car.root.quaternion, this.car.root.scale);
      carSpin = -(this.carFinalX - CAR_X) / this.car.wheelRadius;
    } else if (s.winch > 0) {
      const cx = THREE.MathUtils.lerp(CAR_X, this.carFinalX, s.winch);
      this.poseCarOnSurface(cx);
      carSpin = -(cx - CAR_X) / this.car.wheelRadius;
    } else {
      this.car.root.position.set(CAR_X, 0, CAR_Z);
      this.car.root.rotation.set(0, 0, 0);
      carSpin = 0;
    }
    this.car.root.updateMatrixWorld(true);
    this.car.update(time, s.smoke, carSpin, 1);
    const lift = this.car.root.position.y;
    this.car.shadow.position.set(this.car.root.position.x, 0.015, CAR_Z);
    (this.car.shadow.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - THREE.MathUtils.clamp(lift / 0.5, 0, 1));
    this.car.shadow.visible = lift < 0.5;

    this.hazardLight.position.set(this.car.root.position.x, 1.4 + lift, CAR_Z - 1.2);
    this.hazardLight.intensity = Math.sin(time * 6.5) > 0 ? 5 : 0.2;

    // Winch cable from the drum to the car's tow hook.
    this.cable.visible = this.hook.visible = s.cable > 0.001;
    if (this.cable.visible) {
      const start = this.truck.bedSlider.localToWorld(this.tmpA.copy(this.truck.winchLocal));
      const end = this.car.root.localToWorld(this.tmpB.copy(this.car.hookLocal));
      end.lerpVectors(start, end, s.cable);
      const len = start.distanceTo(end);
      this.cable.position.lerpVectors(start, end, 0.5);
      this.cable.scale.set(1, Math.max(len, 0.001), 1);
      this.cable.quaternion.setFromUnitVectors(this.up, end.clone().sub(start).normalize());
      this.hook.position.copy(end);
      this.hook.rotation.y = Math.PI / 2;
    }

    // Atmosphere shifts from night to dawn as the car is carried away.
    this.env.skyUniforms.uDawn.value = s.dawn;
    this.env.skyUniforms.uHorizon.value.setStyle('#0a1752').lerp(new THREE.Color('#5a2448'), s.dawn);
    this.fog.color.setStyle('#07103a').lerp(new THREE.Color('#2c1438'), s.dawn);
    this.hemi.intensity = 0.9 + s.dawn * 0.6;
    this.env.update(time);

    this.updateCamera(x, time);
  }

  private updateCamera(truckX: number, time: number) {
    const c = story.cam;
    const follow = story.camFollow * (truckX - this.stopX);
    this.target.set(
      THREE.MathUtils.lerp(c.tx + follow, truckX + 1, story.lookTruck),
      c.ty,
      THREE.MathUtils.lerp(c.tz, this.truck.root.position.z, story.lookTruck),
    );
    const pos = this.tmpA.set(c.x + follow, c.y, c.z);

    // Portrait screens pull the camera back and tilt down so the vehicles sit above the copy.
    const aspect = this.camera.aspect;
    const k = aspect >= 1.2 ? 1 : 1 + (1.2 - aspect) * 1.6;
    pos.sub(this.target).multiplyScalar(k).add(this.target);
    if (aspect < 1) this.target.y -= (1 - aspect) * 5.5;

    this.pointerSmooth.lerp(this.pointer, 0.04);
    pos.x += this.pointerSmooth.x * 0.6;
    pos.y += -this.pointerSmooth.y * 0.3 + Math.sin(time * 0.6) * 0.04;

    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  private render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Called once per frame from the GSAP ticker (seconds). */
  tick(time: number) {
    const dt = time - this.lastTime;
    this.lastTime = time;
    if (!this.active) return;
    this.apply(time);
    this.render();
    this.adapt(dt);
  }

  /** Drops resolution, then bloom, on devices that can't hold ~40 fps. */
  private adapt(dt: number) {
    if (!this.adaptive || dt <= 0 || dt > 0.5) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg < 1 / 45) return;
    if (this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.width = 0;
      this.resize();
    } else if (this.composer) {
      this.composer.dispose();
      this.composer = undefined;
    }
  }
}
