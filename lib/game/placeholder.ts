import * as THREE from "three";
import type { Kind } from "../types";

/**
 * Classic turned-wood pieces, used while Lux3D is still forging a set and for
 * any piece that could not be made. Built from lathe profiles, no files.
 */
const PROFILES: Record<Exclude<Kind, "n">, [number, number][]> = {
  p: [[0, 0], [0.34, 0], [0.34, 0.06], [0.26, 0.12], [0.16, 0.2], [0.12, 0.45], [0.2, 0.5], [0.1, 0.56], [0.17, 0.66], [0.17, 0.78], [0.1, 0.86], [0, 0.88]],
  r: [[0, 0], [0.38, 0], [0.38, 0.07], [0.3, 0.14], [0.24, 0.24], [0.22, 0.62], [0.3, 0.68], [0.3, 0.86], [0.24, 0.86], [0.24, 0.8], [0, 0.8]],
  b: [[0, 0], [0.36, 0], [0.36, 0.06], [0.27, 0.13], [0.15, 0.26], [0.12, 0.62], [0.22, 0.66], [0.12, 0.72], [0.2, 0.86], [0.17, 1.0], [0.06, 1.08], [0.07, 1.12], [0, 1.15]],
  q: [[0, 0], [0.38, 0], [0.38, 0.07], [0.29, 0.14], [0.16, 0.3], [0.13, 0.84], [0.25, 0.9], [0.14, 0.96], [0.24, 1.18], [0.18, 1.24], [0.08, 1.27], [0.08, 1.31], [0, 1.33]],
  k: [[0, 0], [0.4, 0], [0.4, 0.07], [0.3, 0.14], [0.17, 0.32], [0.14, 0.92], [0.27, 0.98], [0.15, 1.04], [0.26, 1.24], [0.2, 1.3], [0, 1.31]],
};

const wood = () => new THREE.MeshStandardMaterial({ color: 0xe0c08f, roughness: 0.45 });

export function placeholder(kind: Kind): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === "n") {
    const base = new THREE.LatheGeometry(
      [[0, 0], [0.38, 0], [0.38, 0.07], [0.28, 0.14], [0.22, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)),
      40,
    );
    g.add(new THREE.Mesh(base, wood()));
    // A simple horse head: neck, head and ears.
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.42), wood());
    neck.position.set(0, 0.58, -0.02);
    neck.rotation.x = 0.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.56), wood());
    head.position.set(0, 0.86, 0.12);
    head.rotation.x = 0.35;
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), wood());
    ear.position.set(0.08, 1.04, -0.04);
    const ear2 = ear.clone();
    ear2.position.x = -0.08;
    g.add(neck, head, ear, ear2);
  } else {
    const lathe = new THREE.LatheGeometry(PROFILES[kind].map(([x, y]) => new THREE.Vector2(x, y)), 48);
    g.add(new THREE.Mesh(lathe, wood()));
    if (kind === "k") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), wood());
      bar.position.y = 1.44;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), wood());
      cross.position.y = 1.47;
      g.add(bar, cross);
    }
    if (kind === "q") {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), wood());
      ball.position.y = 1.38;
      g.add(ball);
    }
  }
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  return g;
}
