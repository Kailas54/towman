import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const mats = {
  rubber: new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.92, metalness: 0 }),
  chassis: new THREE.MeshStandardMaterial({ color: '#16171c', roughness: 0.55, metalness: 0.6 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d4d8e0', roughness: 0.18, metalness: 1, envMapIntensity: 0.7 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#0a1128',
    roughness: 0.12,
    metalness: 0.9,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  }),
  well: new THREE.MeshBasicMaterial({ color: '#030305', side: THREE.DoubleSide }),
};

/** Light lens. Rough and env-free so only the emissive term can trigger bloom. */
export function emissive(color: string, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color: '#000',
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0,
  });
}

/**
 * Collapses a parent's static child meshes into one mesh per material to cut draw calls.
 * Only direct, childless meshes with a single material are merged.
 */
export function bakeStatic(parent: THREE.Object3D) {
  const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of parent.children) {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh) continue;
    if (Array.isArray(child.material) || child.children.length) continue;
    const list = byMaterial.get(child.material) ?? [];
    list.push(child);
    byMaterial.set(child.material, list);
  }
  for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
      g.clearGroups();
      return g.applyMatrix4(m.matrix);
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of meshes) {
      parent.remove(m);
      m.geometry.dispose();
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.renderOrder = meshes[0].renderOrder;
    parent.add(mesh);
  }
}

export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Wheel group spinning around its local Z axis. */
export function makeWheel(radius: number, width: number, rimColor: string) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), mats.rubber);
  tire.rotation.x = Math.PI / 2;
  g.add(tire);

  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.9, roughness: 0.28 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.04, 20), rimMat);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 1.12, 12), mats.chassis);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);

  for (let i = 0; i < 5; i++) {
    const spoke = box(radius * 0.09, radius * 0.95, width * 1.08, mats.chassis);
    spoke.rotation.z = (i / 5) * Math.PI * 2;
    g.add(spoke);
  }
  bakeStatic(g);
  return g;
}

/**
 * Flat decal following a side profile, placed on the +Z or -Z face.
 * UVs are normalised to the profile bounds and mirrored on -Z so artwork reads correctly from both sides.
 */
export function sideDecal(points: THREE.Vector2[], mat: THREE.Material, z: number) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(points));
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - bb.min.x) / w;
    uv.setXY(i, z >= 0 ? u : 1 - u, (pos.getY(i) - bb.min.y) / h);
  }
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, mat);
  m.position.z = z;
  return m;
}

/** Plane facing outward along a 2D profile edge (windshields etc.). */
export function edgePanel(a: THREE.Vector2, b: THREE.Vector2, width: number, mat: THREE.Material, offset: number, outward: 1 | -1 = 1) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  const n = new THREE.Vector2(dir.y, -dir.x).multiplyScalar(outward);
  m.position.set(mid.x + n.x * offset, mid.y + n.y * offset, 0);
  m.lookAt(m.position.x + n.x, m.position.y + n.y, 0);
  return m;
}

export function blobShadow(tex: THREE.Texture, w: number, d: number, opacity = 0.9) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity, color: '#000' }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.renderOrder = 1;
  return m;
}

export function flare(tex: THREE.Texture, color: string, size: number) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(color).multiplyScalar(1.4),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  s.scale.setScalar(size);
  return s;
}
