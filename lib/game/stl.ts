import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Loads a piece and merges it into one geometry, standing on y = 0, one unit tall. */
export async function loadSolid(url: string): Promise<THREE.BufferGeometry> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", m.geometry.getAttribute("position").clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(m.matrixWorld);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const merged = mergeGeometries(parts, false)!;
  merged.computeBoundingBox();
  const b = merged.boundingBox!;
  merged.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const h = b.max.y - b.min.y;
  merged.scale(1 / h, 1 / h, 1 / h);
  return merged;
}

/**
 * Exports a piece at a given height in millimetres. With `flatBase`, a thin
 * disc is added under the piece so it prints flat and stands steady.
 */
export function toStl(solid: THREE.BufferGeometry, heightMm: number, flatBase: boolean): Blob {
  const body = solid.clone();
  body.scale(heightMm, heightMm, heightMm);
  const pieces = [body];
  if (flatBase) {
    body.computeBoundingBox();
    const b = body.boundingBox!;
    const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.48;
    const disc = new THREE.CylinderGeometry(r, r, 1.2, 64).toNonIndexed();
    disc.translate(0, 0.6, 0);
    const cut = new THREE.BufferGeometry();
    cut.setAttribute("position", disc.getAttribute("position"));
    body.translate(0, 0.4, 0);
    pieces.push(cut);
  }
  const merged = mergeGeometries(
    pieces.map((p) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", p.getAttribute("position"));
      return g;
    }),
    false,
  )!;
  // Slicers expect Z up.
  merged.rotateX(Math.PI / 2);
  const view = new STLExporter().parse(new THREE.Mesh(merged), { binary: true }) as DataView;
  return new Blob([view.buffer as ArrayBuffer], { type: "model/stl" });
}

/** Rough filament estimate from the mesh volume, for the print sheet. */
export function volumeCm3(solid: THREE.BufferGeometry, heightMm: number): number {
  const pos = solid.getAttribute("position");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(v) * heightMm ** 3 / 1000;
}
