"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** A turntable for one piece. Drag to turn, scroll to zoom. */
export function PieceViewer({ url, label }: { url?: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!url) return;
    setState("loading");
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight(0xfff1dd, 2.4);
    key.position.set(2, 4, 3);
    key.castShadow = true;
    scene.add(key, new THREE.HemisphereLight(0xfff1dd, 0x2a1d14, 0.7));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    camera.position.set(0.9, 1.0, 2.6);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.5, 0);
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.enableDamping = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 5;
    let raf = 0;
    let live = true;
    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(url)
      .then((g) => {
        if (!live) return;
        const obj = g.scene;
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const s = 1 / Math.max(size.y, 1e-6);
        obj.scale.setScalar(s);
        obj.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
        obj.traverse((o) => ((o as THREE.Mesh).castShadow = true));
        scene.add(obj);
        setState("ready");
      })
      .catch(() => live && setState("failed"));
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [url]);

  return (
    <div className="viewer">
      {url && <canvas ref={ref} aria-label={`3D ${label}. Drag to turn it.`} />}
      {!url && <div className="empty">Lux3D is still building this piece in 3D.</div>}
      {url && state === "loading" && <div className="empty">Loading the {label.toLowerCase()}…</div>}
      {state === "failed" && <div className="empty">This piece could not be loaded.</div>}
    </div>
  );
}
