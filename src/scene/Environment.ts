import * as THREE from 'three';
import { makeRoadTexture, makeWindowsTexture } from './textures';

const ROAD_LENGTH = 900;
const ROAD_START = -300;
const TRAFFIC_CARS = 9;

export class Environment {
  readonly group = new THREE.Group();
  readonly skyUniforms = {
    uTop: { value: new THREE.Color('#01030c') },
    uHorizon: { value: new THREE.Color('#0b1a5e') },
    uGlow: { value: new THREE.Color('#ff6600') },
    uDawn: { value: 0 },
  };
  private readonly traffic: THREE.InstancedMesh[] = [];
  private readonly trafficData: { lane: number; speed: number; offset: number }[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(buildingCount: number, glowTex: THREE.Texture) {
    this.group.add(this.makeSky(), this.makeStars(), this.makeGround(), this.makeRoad());
    this.makeRails();
    this.makeLamps(glowTex);
    this.makeCity(buildingCount);
    this.makeTraffic(glowTex);
  }

  private makeSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uDawn;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.45, h));
          float band = exp(-abs(h - 0.01) * 18.0);
          col += uGlow * band * (0.12 + uDawn * 0.9) * smoothstep(-0.6, 0.6, vDir.z);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), mat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    return sky;
  }

  private makeStars() {
    const n = 900;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(Math.random() * 0.9 + 0.1);
      p.set([Math.sin(v) * Math.cos(u) * 450, Math.cos(v) * 450, Math.sin(v) * Math.sin(u) * 450], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: '#c9d6ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }),
    );
    stars.frustumCulled = false;
    return stars;
  }

  private makeGround() {
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uLine: { value: new THREE.Color('#1b3cff') }, uBase: { value: new THREE.Color('#02040c') } },
      ]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLine; uniform vec3 uBase;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        void main() {
          vec2 g = vWorld.xz / 6.0;
          vec2 grid = abs(fract(g - 0.5) - 0.5) / fwidth(g);
          float line = 1.0 - min(min(grid.x, grid.y), 1.0);
          vec2 g2 = vWorld.xz / 30.0;
          vec2 grid2 = abs(fract(g2 - 0.5) - 0.5) / fwidth(g2);
          float major = 1.0 - min(min(grid2.x, grid2.y), 1.0);
          float nearRoad = smoothstep(60.0, 8.0, abs(vWorld.z));
          vec3 col = uBase + uLine * (line * (0.35 + nearRoad * 0.25) + major * 0.9);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    return ground;
  }

  private makeRoad() {
    const tex = makeRoadTexture();
    tex.repeat.set(ROAD_LENGTH / 12, 1);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_LENGTH, 15),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.25 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(ROAD_START + ROAD_LENGTH / 2, 0, 0);
    return road;
  }

  private makeRails() {
    const railMat = new THREE.MeshStandardMaterial({ color: '#8a90a0', metalness: 0.9, roughness: 0.35 });
    const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2b56ff').multiplyScalar(2.4), toneMapped: false });
    // Near-side edge is just a glowing kerb line so nothing blocks the camera.
    const kerb = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_LENGTH, 0.06, 0.18),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a10').multiplyScalar(1.6), toneMapped: false }),
    );
    kerb.position.set(ROAD_START + ROAD_LENGTH / 2, 0.03, -7.7);
    this.group.add(kerb);

    for (const [z, strip] of [[8.2, neon]] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LENGTH, 0.28, 0.12), railMat);
      rail.position.set(ROAD_START + ROAD_LENGTH / 2, 0.72, z);
      const line = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LENGTH, 0.04, 0.13), strip);
      line.position.set(ROAD_START + ROAD_LENGTH / 2, 0.62, z);
      this.group.add(rail, line);

      const count = Math.floor(ROAD_LENGTH / 4);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), railMat, count);
      for (let i = 0; i < count; i++) {
        this.dummy.position.set(ROAD_START + i * 4, 0.4, z);
        this.dummy.updateMatrix();
        posts.setMatrixAt(i, this.dummy.matrix);
      }
      this.group.add(posts);
    }
  }

  private makeLamps(glowTex: THREE.Texture) {
    const spacing = 28;
    const count = Math.floor(ROAD_LENGTH / spacing);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#2a2e38', metalness: 0.8, roughness: 0.4 });
    const poles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 9, 0.22), poleMat, count);
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 3.4), poleMat, count);
    const heads = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.12, 0.4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a8').multiplyScalar(3), toneMapped: false }),
      count,
    );
    const pools = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: '#ff9a50',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      count,
    );
    for (let i = 0; i < count; i++) {
      const x = ROAD_START + i * spacing;
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.position.set(x, 4.5, 8.9);
      this.dummy.updateMatrix();
      poles.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(x, 8.9, 7.3);
      this.dummy.updateMatrix();
      arms.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(x, 8.8, 5.8);
      this.dummy.updateMatrix();
      heads.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(x, 0.03, 4.2);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.updateMatrix();
      pools.setMatrixAt(i, this.dummy.matrix);
    }
    this.group.add(poles, arms, heads, pools);
  }

  private makeCity(count: number) {
    const tex = makeWindowsTexture();
    const mat = new THREE.MeshStandardMaterial({
      color: '#05070f',
      roughness: 0.8,
      metalness: 0.3,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: 0.55,
    });
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, count);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const far = i % 3 === 0;
      const w = 8 + Math.random() * 18;
      const h = 14 + Math.pow(Math.random(), 1.4) * (far ? 150 : 70);
      const side = i % 5 === 0 ? -1 : 1;
      const z = side * (far ? 150 + Math.random() * 80 : 75 + Math.random() * 70);
      this.dummy.rotation.set(0, Math.random() * 0.3, 0);
      this.dummy.position.set(-260 + Math.random() * 760, h / 2, z);
      this.dummy.scale.set(w, h, 8 + Math.random() * 16);
      this.dummy.updateMatrix();
      city.setMatrixAt(i, this.dummy.matrix);
      city.setColorAt(i, tint.setHSL(0.62, 0.3, 0.04 + Math.random() * 0.05));
    }
    this.dummy.scale.set(1, 1, 1);
    this.group.add(city);

    // Neon antenna beacons on the tallest silhouettes
    const tips = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.6, 8, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b1a').multiplyScalar(3), toneMapped: false }),
      count,
    );
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < count; i++) {
      city.getMatrixAt(i, m);
      m.decompose(p, q, s);
      if (s.y < 60) continue;
      this.dummy.position.set(p.x, s.y + 1, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      tips.setMatrixAt(n++, this.dummy.matrix);
    }
    tips.count = n;
    this.group.add(tips);
  }

  private makeTraffic(glowTex: THREE.Texture) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const make = (color: string) => {
      const mesh = new THREE.InstancedMesh(
        geo,
        new THREE.MeshBasicMaterial({
          map: glowTex,
          color: new THREE.Color(color).multiplyScalar(2.5),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
        TRAFFIC_CARS * 2,
      );
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    this.traffic.push(make('#e6efff'), make('#ff2a2a'));
    for (let i = 0; i < TRAFFIC_CARS; i++) {
      this.trafficData.push({ lane: i % 2 ? 1.8 : 5.4, speed: 22 + Math.random() * 14, offset: Math.random() * 600 });
    }
  }

  update(time: number) {
    const [heads, tails] = this.traffic;
    this.trafficData.forEach((c, i) => {
      const x = 400 - ((time * c.speed + c.offset) % 700);
      for (let k = 0; k < 2; k++) {
        const z = c.lane + (k ? 0.7 : -0.7);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.position.set(x - 0.2, 0.7, z);
        this.dummy.scale.set(3.6, 0.6, 1);
        this.dummy.updateMatrix();
        heads.setMatrixAt(i * 2 + k, this.dummy.matrix);
        this.dummy.position.set(x + 4.4, 0.8, z);
        this.dummy.scale.set(2.6, 0.45, 1);
        this.dummy.updateMatrix();
        tails.setMatrixAt(i * 2 + k, this.dummy.matrix);
      }
    });
    this.dummy.scale.set(1, 1, 1);
    heads.instanceMatrix.needsUpdate = true;
    tails.instanceMatrix.needsUpdate = true;
  }
}
