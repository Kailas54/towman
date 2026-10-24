import * as THREE from 'three';
import { bakeStatic, blobShadow, box, edgePanel, emissive, makeWheel, mats, sideDecal } from './parts';

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const SMOKE_COUNT = 28;

/** Stranded sedan. Local frame: +X forward, wheels touching y = 0. */
export class BrokenCar {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly shadow: THREE.Mesh;
  readonly wheelbase = 2.84;
  readonly wheelRadius = 0.34;
  readonly length = 4.7;
  readonly hookLocal = new THREE.Vector3(2.36, 0.42, 0);

  private readonly wheels: THREE.Object3D[] = [];
  private readonly hazard = emissive('#ff8a1a', 0);
  private readonly smoke: THREE.Points;
  private readonly smokeSeeds: Float32Array;

  constructor(smokeTex: THREE.Texture, shadowTex: THREE.Texture) {
    this.shadow = blobShadow(shadowTex, 5.6, 2.6);
    this.root.add(this.body);

    const paint = new THREE.MeshPhysicalMaterial({
      color: '#c3c9d4',
      metalness: 0.7,
      roughness: 0.26,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });

    const shape = new THREE.Shape();
    shape.moveTo(-2.3, 0.32);
    shape.lineTo(2.2, 0.32);
    shape.quadraticCurveTo(2.37, 0.36, 2.35, 0.6);
    shape.quadraticCurveTo(2.33, 0.8, 2.0, 0.85);
    shape.lineTo(1.1, 0.95);
    shape.quadraticCurveTo(0.62, 1.3, 0.25, 1.38);
    shape.lineTo(-0.9, 1.41);
    shape.quadraticCurveTo(-1.5, 1.3, -1.9, 1.0);
    shape.lineTo(-2.28, 0.93);
    shape.quadraticCurveTo(-2.42, 0.7, -2.3, 0.32);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.64,
      curveSegments: 10,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 4,
    });
    geo.translate(0, 0, -0.82);
    this.body.add(new THREE.Mesh(geo, paint));

    for (const z of [0.905, -0.905]) {
      this.body.add(sideDecal([V2(1.0, 0.99), V2(0.3, 1.31), V2(-0.86, 1.34), V2(-1.7, 1.0)], mats.glass, z));
      this.body.add(box(0.07, 0.36, 0.01, paint, -0.25, 1.14, z * 1.006));
      for (const x of [1.42, -1.42]) {
        const well = new THREE.Mesh(new THREE.CircleGeometry(0.44, 24, 0, Math.PI), mats.well);
        well.position.set(x, 0.3, z * 1.002);
        this.body.add(well);
      }
    }
    this.body.add(edgePanel(V2(1.08, 0.97), V2(0.3, 1.35), 1.5, mats.glass, 0.075));
    this.body.add(edgePanel(V2(-0.92, 1.4), V2(-1.88, 1.02), 1.5, mats.glass, 0.075));

    const headMat = emissive('#cfe0ff', 0.6);
    const tailMat = emissive('#ff2020', 1.4);
    for (const s of [1, -1]) {
      this.body.add(box(0.06, 0.1, 0.36, headMat, 2.36, 0.66, s * 0.6));
      this.body.add(box(0.06, 0.12, 0.36, tailMat, -2.36, 0.74, s * 0.58));
      this.body.add(box(0.06, 0.08, 0.12, this.hazard, 2.36, 0.56, s * 0.84));
      this.body.add(box(0.06, 0.08, 0.12, this.hazard, -2.37, 0.62, s * 0.84));
      this.body.add(box(0.1, 0.06, 0.16, this.hazard, 1.6, 0.88, s * 0.9));
    }
    this.body.add(box(0.06, 0.08, 0.14, mats.chrome, 2.38, 0.42, 0));

    for (const [x, z] of [
      [1.42, 0.86],
      [1.42, -0.86],
      [-1.42, 0.86],
      [-1.42, -0.86],
    ] as const) {
      const wheel = makeWheel(this.wheelRadius, 0.26, '#8b919c');
      wheel.position.set(x, this.wheelRadius, z);
      this.wheels.push(wheel);
      this.body.add(wheel);
    }

    const positions = new Float32Array(SMOKE_COUNT * 3);
    const colors = new Float32Array(SMOKE_COUNT * 4);
    this.smokeSeeds = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      this.smokeSeeds[i * 3] = Math.random();
      this.smokeSeeds[i * 3 + 1] = Math.random() - 0.5;
      this.smokeSeeds[i * 3 + 2] = Math.random() - 0.5;
    }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    smokeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.smoke = new THREE.Points(
      smokeGeo,
      new THREE.PointsMaterial({
        map: smokeTex,
        size: 1.6,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.smoke.frustumCulled = false;
    this.body.add(this.smoke);
    bakeStatic(this.body);
  }

  update(time: number, smokeAmount: number, wheelSpin: number, hazards: number) {
    for (const w of this.wheels) w.rotation.z = wheelSpin;
    this.hazard.emissiveIntensity = (Math.sin(time * 6.5) > 0 ? 6 : 0.15) * hazards;

    this.smoke.visible = smokeAmount > 0.01;
    if (!this.smoke.visible) return;
    const pos = this.smoke.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.smoke.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const life = (time * 0.32 + this.smokeSeeds[i * 3]) % 1;
      pos.setXYZ(
        i,
        1.55 + this.smokeSeeds[i * 3 + 1] * 0.5 - life * 0.9,
        0.95 + life * 2.6,
        this.smokeSeeds[i * 3 + 2] * (0.5 + life * 1.4),
      );
      const g = 0.16 + life * 0.14;
      col.setXYZW(i, g, g, g * 1.1, Math.sin(Math.PI * life) * 0.32 * smokeAmount);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}
