import * as THREE from 'three';
import { BRAND, makeCabTexture, makeDeckStripTexture, makeHeadboardTexture, makeSkirtTexture } from './textures';
import { bakeStatic, blobShadow, box, edgePanel, emissive, flare, makeWheel, mats, sideDecal } from './parts';

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

export interface TruckState {
  odometer: number;
  beacons: number;
  brake: number;
  reverse: number;
  slide: number;
  tilt: number;
}

/**
 * Rollback flatbed in the Towman livery. Local frame: +X forward, ground at y = 0, centred on z = 0.
 * The bed hinges at `bedPivot` and slides back along `bedSlider`.
 */
export class TowTruck {
  readonly root = new THREE.Group();
  readonly bedPivot = new THREE.Group();
  readonly bedSlider = new THREE.Group();
  readonly wheelRadius = 0.5;
  readonly slideMax = 3.2;
  readonly tiltMax: number;
  readonly winchLocal = new THREE.Vector3(3.75, 0.5, 0);
  /** Deck top polyline (bed-slider local XY) that the car drives up. */
  readonly deckProfile = [V2(-2.2, 0.06), V2(-1.2, 0.32), V2(3.8, 0.32)];

  private readonly wheels: THREE.Object3D[] = [];
  private readonly beaconL = emissive(BRAND.orange, 0);
  private readonly beaconR = emissive(BRAND.orange, 0);
  private readonly brakeMat = emissive('#ff1a1a', 0.6);
  private readonly reverseMat = emissive('#ffffff', 0);
  private readonly beaconLight: THREE.PointLight;

  constructor(glowTex: THREE.Texture, shadowTex: THREE.Texture, withSpotlight: boolean) {
    const blue = new THREE.MeshStandardMaterial({ color: BRAND.blue, metalness: 0.45, roughness: 0.32 });
    const orange = new THREE.MeshStandardMaterial({ color: BRAND.orange, metalness: 0.3, roughness: 0.38 });
    const deckMetal = new THREE.MeshStandardMaterial({ color: '#3a3f4b', metalness: 0.85, roughness: 0.42 });
    const decalOpts = { metalness: 0.45, roughness: 0.32, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 };
    const cabArt = new THREE.MeshStandardMaterial({ map: makeCabTexture(), ...decalOpts });
    const stripArt = new THREE.MeshStandardMaterial({ map: makeDeckStripTexture(), ...decalOpts });
    const skirtArt = new THREE.MeshStandardMaterial({ map: makeSkirtTexture(), metalness: 0.45, roughness: 0.32 });
    const headArt = new THREE.MeshStandardMaterial({ map: makeHeadboardTexture(), metalness: 0.3, roughness: 0.38 });
    const headlightMat = emissive('#eaf2ff', 4);

    this.root.add(blobShadow(shadowTex, 10.5, 3.6));

    // Cab
    const cabProfile = [V2(2.2, 0.8), V2(4.35, 0.8), V2(4.35, 1.75), V2(4.05, 1.88), V2(3.85, 2.75), V2(2.2, 2.75)];
    const cabGeo = new THREE.ExtrudeGeometry(new THREE.Shape(cabProfile), {
      depth: 2.08,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
    cabGeo.translate(0, 0, -1.04);
    this.root.add(new THREE.Mesh(cabGeo, blue));
    for (const z of [1.104, -1.104]) {
      this.root.add(sideDecal(cabProfile, cabArt, z));
      this.root.add(sideDecal([V2(2.5, 1.92), V2(3.72, 1.92), V2(3.57, 2.62), V2(2.5, 2.62)], mats.glass, z * 1.004));
    }
    this.root.add(edgePanel(V2(4.05, 1.92), V2(3.87, 2.68), 1.95, mats.glass, 0.065));

    // Front end
    this.root.add(box(0.06, 0.42, 1.4, mats.chassis, 4.42, 1.25, 0));
    this.root.add(box(0.26, 0.3, 2.26, orange, 4.43, 0.76, 0));
    const indicatorMat = emissive(BRAND.orange, 1.5);
    for (const s of [1, -1]) {
      this.root.add(box(0.06, 0.2, 0.32, headlightMat, 4.42, 1.22, s * 0.86));
      this.root.add(box(0.06, 0.08, 0.16, indicatorMat, 4.42, 1.05, s * 0.92));
      this.root.add(box(0.1, 0.36, 0.06, mats.chassis, 4.05, 2.05, s * 1.3));
      this.root.add(box(0.36, 0.04, 0.04, mats.chassis, 4.0, 2.15, s * 1.18));
      const f = flare(glowTex, '#cfe0ff', 0.9);
      f.position.set(4.5, 1.22, s * 0.86);
      this.root.add(f);
    }

    // Roof light bar
    this.root.add(box(0.32, 0.1, 1.7, mats.chassis, 3.0, 2.84, 0));
    this.root.add(box(0.3, 0.14, 0.42, this.beaconL, 3.0, 2.94, 0.62));
    this.root.add(box(0.3, 0.14, 0.42, this.beaconR, 3.0, 2.94, -0.62));
    this.root.add(box(0.3, 0.1, 0.5, emissive('#ffffff', 1.2), 3.0, 2.92, 0));
    this.beaconLight = new THREE.PointLight(BRAND.orange, 0, 22, 1.6);
    this.beaconLight.position.set(3.0, 3.3, 0);
    this.root.add(this.beaconLight);

    if (withSpotlight) {
      const spot = new THREE.SpotLight('#dfe9ff', 70, 60, 0.42, 0.55, 1.3);
      spot.position.set(4.5, 1.25, 0);
      spot.target.position.set(18, 0, 0);
      this.root.add(spot, spot.target);
    }

    // Chassis, cab step, side skirt with the main livery
    this.root.add(box(5.1, 0.28, 1.0, mats.chassis, -0.15, 0.78, 0));
    this.root.add(box(0.5, 0.12, 2.24, mats.chassis, 2.45, 0.6, 0));
    this.root.add(box(3.2, 0.58, 2.24, [mats.chassis, mats.chassis, mats.chassis, mats.chassis, skirtArt, skirtArt], 0.25, 0.71, 0));
    for (const s of [1, -1]) this.root.add(box(0.06, 0.62, 0.42, mats.rubber, -2.72, 0.42, s * 0.95));

    // Wheels: steer axle + dual rear
    for (const [x, z, w] of [
      [3.3, 0.9, 0.36],
      [3.3, -0.9, 0.36],
      [-2.0, 0.93, 0.44],
      [-2.0, -0.93, 0.44],
    ] as const) {
      const wheel = makeWheel(this.wheelRadius, w, '#c9ced8');
      wheel.position.set(x, this.wheelRadius, z);
      this.wheels.push(wheel);
      this.root.add(wheel);
    }

    // Bed
    this.bedPivot.position.set(-2.4, 1.05, 0);
    this.root.add(this.bedPivot);
    this.bedPivot.add(this.bedSlider);

    const deckGeo = new THREE.ExtrudeGeometry(
      new THREE.Shape([V2(-2.2, 0), V2(4.4, 0), V2(4.4, 0.32), V2(-1.2, 0.32), V2(-2.2, 0.06)]),
      { depth: 2.3, bevelEnabled: false },
    );
    deckGeo.translate(0, 0, -1.15);
    this.bedSlider.add(new THREE.Mesh(deckGeo, deckMetal));
    for (const s of [1, -1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.32), stripArt);
      strip.position.set(1.6, 0.16, s * 1.153);
      if (s < 0) strip.rotation.y = Math.PI;
      this.bedSlider.add(strip);
    }
    // Rail lips along the deck edges
    for (const s of [1, -1]) this.bedSlider.add(box(5.0, 0.06, 0.06, mats.chrome, 1.3, 0.35, s * 1.12));

    this.bedSlider.add(box(0.45, 1.53, 2.0, [orange, orange, orange, orange, headArt, headArt], 4.18, 1.085, 0));
    const markerMat = emissive(BRAND.orange, 2);
    for (const s of [1, -1]) this.bedSlider.add(box(0.12, 0.08, 0.22, markerMat, 4.18, 1.9, s * 0.7));

    const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 16), mats.chassis);
    winch.rotation.x = Math.PI / 2;
    winch.position.set(3.82, 0.5, 0);
    this.bedSlider.add(winch);

    // Rear light bar hangs under the tail of the bed
    this.bedSlider.add(box(0.12, 0.16, 2.1, mats.chassis, -1.3, -0.08, 0));
    for (const s of [1, -1]) {
      this.bedSlider.add(box(0.04, 0.1, 0.32, this.brakeMat, -1.37, -0.08, s * 0.82));
      this.bedSlider.add(box(0.04, 0.1, 0.16, this.reverseMat, -1.37, -0.08, s * 0.5));
    }

    // Solve the tilt that puts the bed tip on the ground when fully slid back.
    const tipX = -2.2 - this.slideMax;
    this.tiltMax = Math.asin((this.bedPivot.position.y - 0.02) / -tipX);

    bakeStatic(this.root);
    bakeStatic(this.bedSlider);
  }

  update(time: number, s: TruckState) {
    const spin = -s.odometer / this.wheelRadius;
    for (const w of this.wheels) w.rotation.z = spin;

    this.bedSlider.position.x = -s.slide * this.slideMax;
    this.bedPivot.rotation.z = s.tilt * this.tiltMax;

    const phase = Math.sin(time * 9);
    const left = phase > 0 ? 1 : 0.08;
    const right = phase > 0 ? 0.08 : 1;
    this.beaconL.emissiveIntensity = left * 7 * s.beacons;
    this.beaconR.emissiveIntensity = right * 7 * s.beacons;
    this.beaconLight.intensity = (0.4 + 0.6 * Math.abs(phase)) * 14 * s.beacons;

    this.brakeMat.emissiveIntensity = 0.6 + s.brake * 4;
    this.reverseMat.emissiveIntensity = s.reverse * 5;
  }

  /** World-space deck top polyline at the current pose. */
  deckPolyline(out: THREE.Vector3[]) {
    this.deckProfile.forEach((p, i) => {
      out[i] = (out[i] ?? new THREE.Vector3()).set(p.x, p.y, 0);
      this.bedSlider.localToWorld(out[i]);
    });
    return out;
  }
}
