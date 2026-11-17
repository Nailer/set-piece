import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { KINDS, KIND_HEIGHT, type ChessSet, type Kind, type Side } from "../types";
import { placeholder } from "./placeholder";

export type Square = string; // "e4"

export interface BoardEvents {
  onSquare?: (sq: Square) => void;
  /** A slowly turning showcase that ignores clicks. */
  demo?: boolean;
}

export interface MoveAnim {
  from: Square;
  to: Square;
  captured?: boolean;
  /** For en passant the captured pawn is not on the target square. */
  capturedOn?: Square;
  promotion?: Kind;
  castle?: { from: Square; to: Square };
  color: Side;
  piece: Kind;
}

export type Finish = "natural" | "ebony" | "gold" | "jade";

/** Tints for the second side, applied over the set's own textures. */
const FINISH: Record<Finish, { color: number; metal: number; rough: number }> = {
  natural: { color: 0x3b3029, metal: 0, rough: 0.55 },
  ebony: { color: 0x1d1b1f, metal: 0.1, rough: 0.35 },
  gold: { color: 0xd4a33a, metal: 0.9, rough: 0.3 },
  jade: { color: 0x2f8a6b, metal: 0.05, rough: 0.25 },
};

const KING_H = 1.55;
const loader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

const fileOf = (sq: Square) => sq.charCodeAt(0) - 97;
const rankOf = (sq: Square) => Number(sq[1]) - 1;
export const squarePos = (sq: Square) => new THREE.Vector3(fileOf(sq) - 3.5, 0, 3.5 - rankOf(sq));

interface Tween {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  done?: () => void;
}

/** The 3D board: draws a set, animates moves, and reports clicked squares. */
export class BoardView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private templates = new Map<Kind, THREE.Object3D>();
  private real = new Set<Kind>();
  private pieces = new Map<Square, THREE.Object3D>();
  private tweens: Tween[] = [];
  private fading: { obj: THREE.Object3D; t: number }[] = [];
  private marks = new THREE.Group();
  private tray: Record<Side, THREE.Object3D[]> = { w: [], b: [] };
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downAt = new THREE.Vector2();
  private board = new THREE.Group();
  private orientation: Side = "w";
  private finish: Finish = "natural";
  private fen = "";
  private hoverMesh: THREE.Mesh;
  /** A redraw asked for mid-animation waits until every piece has landed. */
  private pendingRebuild = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private events: BoardEvents = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    this.scene.background = new THREE.Color(0x1a1512);
    this.scene.fog = new THREE.Fog(0x1a1512, 18, 40);

    this.scene.add(new THREE.HemisphereLight(0xfff1dd, 0x2a1d14, 0.8));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
    key.position.set(-5, 11, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc98a, 1.1);
    rim.position.set(6, 4, -6);
    this.scene.add(rim);

    this.buildBoard();
    this.scene.add(this.board, this.marks);
    this.hoverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.position.y = 0.012;
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 20;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = 1.2;
    this.controls.enableDamping = true;
    this.setOrientation("w", true);
    if (events.demo) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.5;
      this.controls.enableZoom = false;
      this.camera.position.set(6.5, 7.2, 8.5);
    }

    for (const k of KINDS) this.templates.set(k, this.fit(placeholder(k), k));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerleave", () => (this.hoverMesh.visible = false));
    this.loop();
  }

  // ---------- set loading ----------

  /** Loads whatever pieces of the set are ready. Pieces still being forged stay as classic placeholders. */
  async useSet(set: ChessSet | null): Promise<void> {
    if (!set) return;
    await Promise.all(
      KINDS.map(async (k) => {
        const url = set.pieces[k]?.modelUrl;
        if (!url || this.real.has(k)) return;
        try {
          const gltf = await loader().loadAsync(url);
          if (this.disposed) return;
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) m.castShadow = m.receiveShadow = true;
          });
          this.templates.set(k, this.fit(gltf.scene, k));
          this.real.add(k);
        } catch {
          // keep the placeholder
        }
      }),
    );
    if (this.fen) this.safeRebuild();
  }

  setFinish(f: Finish) {
    this.finish = f;
    if (this.fen) this.safeRebuild();
  }

  private safeRebuild() {
    if (this.tweens.length) this.pendingRebuild = true;
    else this.rebuildKeepTray();
  }

  /** Scales a piece to its Staunton height and keeps it inside one square. */
  private fit(obj: THREE.Object3D, k: Kind): THREE.Object3D {
    const wrap = new THREE.Group();
    wrap.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    let s = (KING_H * KIND_HEIGHT[k]) / Math.max(size.y, 1e-6);
    const footprint = Math.max(size.x, size.z) * s;
    if (footprint > 0.86) s *= 0.86 / footprint;
    obj.scale.multiplyScalar(s);
    obj.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
    return wrap;
  }

  private make(k: Kind, color: Side): THREE.Object3D {
    const o = this.templates.get(k)!.clone(true);
    // Each piece owns its materials so the dark side can be tinted.
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => {
        const copy = (mat as THREE.MeshStandardMaterial).clone();
        if (color === "b") {
          const f = FINISH[this.finish];
          copy.color = new THREE.Color(f.color);
          copy.metalness = f.metal;
          copy.roughness = f.rough;
        }
        return copy;
      });
      m.material = Array.isArray(m.material) ? mats : mats[0];
    });
    // Knights and faces look across the board at the other side.
    o.rotation.y = color === "w" ? Math.PI : 0;
    o.userData = { kind: k, color };
    return o;
  }

  // ---------- position ----------

  /** Draws the position from a FEN without animation. */
  setFen(fen: string) {
    this.fen = fen;
    this.rebuild();
  }

  private rebuild() {
    for (const o of this.pieces.values()) this.scene.remove(o);
    this.pieces.clear();
    const rows = this.fen.split(" ")[0].split("/");
    rows.forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) {
          f += Number(ch);
          continue;
        }
        const sq = String.fromCharCode(97 + f) + (8 - i);
        const color: Side = ch === ch.toUpperCase() ? "w" : "b";
        const o = this.make(ch.toLowerCase() as Kind, color);
        o.position.copy(squarePos(sq));
        o.userData.square = sq;
        this.scene.add(o);
        this.pieces.set(sq, o);
        f++;
      }
    });
    // Rebuild the captured trays too, so tinting and swapped-in pieces apply.
    for (const side of ["w", "b"] as Side[]) {
      const kinds = this.tray[side].map((o) => o.userData.kind as Kind);
      this.tray[side].forEach((o) => this.scene.remove(o));
      this.tray[side] = [];
      kinds.forEach((k) => this.addToTray(this.make(k, side), side, false));
    }
  }

  /** Animates one move, then settles on the new FEN. Resolves when it has finished. */
  animate(m: MoveAnim, fenAfter: string): Promise<void> {
    return new Promise((resolve) => {
      const mover = this.pieces.get(m.from);
      if (!mover) {
        this.setFen(fenAfter);
        return resolve();
      }
      const victimSq = m.capturedOn ?? (m.captured ? m.to : undefined);
      const victim = victimSq ? this.pieces.get(victimSq) : undefined;
      this.pieces.delete(m.from);
      const to = squarePos(m.to);
      const dist = mover.position.distanceTo(to);
      const knight = m.piece === "n";
      this.tweens.push({
        obj: mover,
        from: mover.position.clone(),
        to,
        t: 0,
        dur: 0.28 + dist * 0.045,
        arc: knight ? 0.9 : victim ? 0.35 : 0.12,
        done: () => {
          if (victim) {
            this.knockOff(victim, victim.userData.color as Side);
            this.pieces.delete(victimSq!);
          }
          this.fen = fenAfter;
          // Promotion, castling and anything else are settled by the new FEN.
          setTimeout(() => {
            if (!this.disposed) this.rebuildKeepTray();
            resolve();
          }, m.castle ? 260 : 60);
        },
      });
      if (m.castle) {
        const rook = this.pieces.get(m.castle.from);
        if (rook) {
          this.pieces.delete(m.castle.from);
          this.tweens.push({ obj: rook, from: rook.position.clone(), to: squarePos(m.castle.to), t: -0.12, dur: 0.32, arc: 0.4 });
        }
      }
    });
  }

  private rebuildKeepTray() {
    for (const o of this.pieces.values()) this.scene.remove(o);
    for (const o of this.scene.children.filter((c) => c.userData?.square && !this.isTray(c))) this.scene.remove(o);
    this.pieces.clear();
    const trays = this.tray;
    this.tray = { w: [], b: [] };
    const keep = { w: trays.w.map((o) => o.userData.kind as Kind), b: trays.b.map((o) => o.userData.kind as Kind) };
    trays.w.concat(trays.b).forEach((o) => this.scene.remove(o));
    this.rebuild();
    (["w", "b"] as Side[]).forEach((s) => keep[s].forEach((k) => this.addToTray(this.make(k, s), s, false)));
  }

  private isTray(o: THREE.Object3D) {
    return this.tray.w.includes(o) || this.tray.b.includes(o);
  }

  /** A captured piece topples and slides to its owner's tray beside the board. */
  private knockOff(o: THREE.Object3D, owner: Side) {
    this.scene.remove(o);
    const fresh = this.make(o.userData.kind as Kind, owner);
    fresh.position.copy(o.position);
    this.addToTray(fresh, owner, true);
  }

  private addToTray(o: THREE.Object3D, owner: Side, animate: boolean) {
    const i = this.tray[owner].length;
    const x = owner === "w" ? -5.4 : 5.4;
    const z = (owner === "w" ? 3.6 : -3.6) + (owner === "w" ? -1 : 1) * (i % 8) * 0.95;
    const target = new THREE.Vector3(x + (i >= 8 ? (owner === "w" ? -0.9 : 0.9) : 0), 0, z);
    o.scale.multiplyScalar(0.72);
    this.scene.add(o);
    this.tray[owner].push(o);
    if (animate) {
      o.rotation.z = 0;
      this.fading.push({ obj: o, t: 0 });
      this.tweens.push({ obj: o, from: o.position.clone(), to: target, t: -0.18, dur: 0.55, arc: 1.4 });
    } else {
      o.position.copy(target);
    }
  }

  /** Rebuilds the captured trays from scratch, e.g. after an undo. */
  setCaptured(list: { kind: Kind; owner: Side }[]) {
    this.clearTrays();
    for (const c of list) this.addToTray(this.make(c.kind, c.owner), c.owner, false);
  }

  clearTrays() {
    for (const s of ["w", "b"] as Side[]) {
      this.tray[s].forEach((o) => this.scene.remove(o));
      this.tray[s] = [];
    }
  }

  // ---------- marks ----------

  mark(opts: { selected?: Square | null; targets?: Square[]; last?: [Square, Square] | null; check?: Square | null; captures?: Square[] }) {
    this.marks.clear();
    const flat = (sq: Square, color: number, opacity: number, size = 0.96) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.copy(squarePos(sq)).setY(0.011);
      this.marks.add(m);
    };
    if (opts.last) opts.last.forEach((sq) => flat(sq, 0xffcf4a, 0.32));
    if (opts.selected) flat(opts.selected, 0x7ee0ff, 0.5);
    if (opts.check) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.48, 40),
        new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(squarePos(opts.check)).setY(0.013);
      this.marks.add(ring);
    }
    for (const sq of opts.targets ?? []) {
      const capture = opts.captures?.includes(sq);
      const g = capture ? new THREE.RingGeometry(0.36, 0.46, 36) : new THREE.CircleGeometry(0.14, 24);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: capture ? 0xff6a3d : 0x15161d, transparent: true, opacity: capture ? 0.8 : 0.38, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(squarePos(sq)).setY(0.014);
      this.marks.add(m);
    }
  }

  // ---------- camera ----------

  setOrientation(side: Side, snap = false) {
    this.orientation = side;
    const z = side === "w" ? 1 : -1;
    const target = new THREE.Vector3(0, 9.5, 8.8 * z);
    if (snap) this.camera.position.copy(target);
    else this.camTarget = target;
    this.controls.target.set(0, 0, 0.3 * z);
  }

  private camTarget: THREE.Vector3 | null = null;

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL("image/png");
  }

  // ---------- input ----------

  private squareAt(e: PointerEvent): Square | null {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // A tall piece hides squares behind it, so pieces are hit-tested first.
    const hits = this.raycaster.intersectObjects([...this.pieces.values()], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData?.square) o = o.parent;
      if (o?.userData.square && this.pieces.get(o.userData.square) === o) return o.userData.square;
    }
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    const f = Math.floor(p.x + 4);
    const rk = Math.floor(4 - p.z);
    if (f < 0 || f > 7 || rk < 0 || rk > 7) return null;
    return String.fromCharCode(97 + f) + (rk + 1);
  }

  private onDown = (e: PointerEvent) => {
    this.downAt.set(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent) => {
    if (this.events.demo) return;
    // A drag turns the camera; only a tap selects.
    if (this.downAt.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 6) return;
    const sq = this.squareAt(e);
    if (sq) this.events.onSquare?.(sq);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || this.events.demo) return;
    const sq = this.squareAt(e);
    this.hoverMesh.visible = Boolean(sq);
    if (sq) this.hoverMesh.position.copy(squarePos(sq)).setY(0.012);
    this.canvas.style.cursor = sq ? "pointer" : "grab";
  };

  // ---------- frame ----------

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const p = Math.max(0, Math.min(1, tw.t / tw.dur));
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      tw.obj.position.lerpVectors(tw.from, tw.to, e);
      tw.obj.position.y = Math.sin(Math.PI * e) * tw.arc;
      if (p >= 1) {
        tw.obj.position.copy(tw.to);
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done?.();
      }
    }
    for (const f of [...this.fading]) {
      f.t += dt;
      f.obj.rotation.z = Math.min(1, f.t / 0.35) * 1.45;
      if (f.t > 0.7) {
        f.obj.rotation.z = 1.45;
        this.fading.splice(this.fading.indexOf(f), 1);
      }
    }
    if (this.pendingRebuild && !this.tweens.length) {
      this.pendingRebuild = false;
      this.rebuildKeepTray();
    }
    if (this.camTarget) {
      this.camera.position.lerp(this.camTarget, 1 - Math.exp(-dt * 3));
      if (this.camera.position.distanceTo(this.camTarget) < 0.02) this.camTarget = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Narrow screens pull back so the whole board stays in view.
    this.camera.fov = w / h < 0.8 ? 52 : w / h < 1.2 ? 44 : 36;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.renderer.dispose();
  }

  // ---------- board ----------

  private buildBoard() {
    const tex = (draw: (g: CanvasRenderingContext2D) => void, size = 1024) => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      draw(c.getContext("2d")!);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    const grain = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, line: string) => {
      g.fillStyle = base;
      g.fillRect(x, y, w, h);
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = line;
        g.globalAlpha = 0.06 + Math.random() * 0.1;
        g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        const yy = y + Math.random() * h;
        g.moveTo(x, yy);
        g.bezierCurveTo(x + w / 3, yy + (Math.random() - 0.5) * 12, x + (2 * w) / 3, yy + (Math.random() - 0.5) * 12, x + w, yy);
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    const squares = tex((g) => {
      const s = 128;
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const light = (r + f) % 2 === 0;
          grain(g, f * s, r * s, s, s, light ? "#e8cfa2" : "#8a5a35", light ? "#b48a58" : "#4a2a12");
        }
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 8), [
      new THREE.MeshStandardMaterial({ color: 0x5a3820 }),
      new THREE.MeshStandardMaterial({ color: 0x5a3820 }),
      new THREE.MeshStandardMaterial({ map: squares, roughness: 0.42 }),
      new THREE.MeshStandardMaterial({ color: 0x5a3820 }),
      new THREE.MeshStandardMaterial({ color: 0x5a3820 }),
      new THREE.MeshStandardMaterial({ color: 0x5a3820 }),
    ]);
    top.position.y = -0.15;
    top.receiveShadow = true;
    this.board.add(top);

    // The frame carries the coordinates, the way a real tournament board does.
    const frameTex = tex((g) => {
      grain(g, 0, 0, 1024, 1024, "#4a2c17", "#24130a");
      g.fillStyle = "#e8cfa2";
      g.font = "600 34px Georgia, serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const cell = 1024 / 9.2;
      const off = (1024 - cell * 8) / 2;
      for (let i = 0; i < 8; i++) {
        const letter = String.fromCharCode(97 + i);
        g.fillText(letter, off + cell * (i + 0.5), 1024 - off / 2);
        g.fillText(letter, off + cell * (i + 0.5), off / 2);
        g.fillText(String(8 - i), off / 2, off + cell * (i + 0.5));
        g.fillText(String(8 - i), 1024 - off / 2, off + cell * (i + 0.5));
      }
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.42, 9.2), [
      new THREE.MeshStandardMaterial({ color: 0x3e2413, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x3e2413, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: frameTex, roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ color: 0x3e2413, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x3e2413, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x3e2413, roughness: 0.5 }),
    ]);
    frame.position.y = -0.22;
    frame.receiveShadow = true;
    this.board.add(frame);

    const table = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.43;
    table.receiveShadow = true;
    this.board.add(table);
  }
}
