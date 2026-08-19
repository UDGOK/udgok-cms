'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

interface ProgressRing3DProps {
  /** Overall completion percent 0-100 */
  percent: number;
  /** Sub-metrics for the segments */
  financial: number; // 0-100
  tasks: number; // 0-100
  subs: number; // 0-100
  schedule: number; // 0-100
  /** Overall project status (for color) */
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED' | string;
  height?: number;
  /** Used as the title in the center (e.g. project name) */
  title?: string;
}

const STATUS_PALETTE: Record<
  string,
  { primary: number; tint: number; label: string }
> = {
  PLANNING: { primary: 0x6b8aa0, tint: 0x9eb4c4, label: 'In planning' },
  ACTIVE: { primary: 0xf06a2d, tint: 0xff9b6e, label: 'Active' },
  ON_HOLD: { primary: 0xc89c2a, tint: 0xe8c264, label: 'On hold' },
  COMPLETED: { primary: 0x1d7a4a, tint: 0x4ab07d, label: 'Completed' },
  CANCELLED: { primary: 0xc23a1f, tint: 0xe0603f, label: 'Cancelled' },
  ARCHIVED: { primary: 0x8a8a8a, tint: 0xa8a8a8, label: 'Archived' },
};

/**
 * 3D completion ring for a project. Designed to be the visual
 * centerpiece of the project page — the 3D ring is the focal
 * point, the big percent number is overlaid in HTML for crisp
 * typography, and the four sub-metrics are a clean row of
 * cards below (in the parent page, not in this component).
 *
 * Design choices:
 *  - One partial torus for the filled portion, one full torus
 *    for the track. No stitched-together wedges.
 *  - PBR materials with envMap so the metal looks like metal.
 *  - Three-point lighting (key + fill + rim).
 *  - Static camera, no auto-rotation. Drag to orbit.
 *  - No pulsing, no random floating dots, no "kid did it"
 *    effects. Each element earns its place.
 */
export function ProgressRing3D({
  percent,
  financial,
  tasks,
  subs,
  schedule,
  status,
  height = 380,
  title,
}: ProgressRing3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const palette = useMemo(
    () => STATUS_PALETTE[status] ?? STATUS_PALETTE.ACTIVE,
    [status],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError('WebGL not available in this browser');
      return;
    }

    const width = container.clientWidth;
    const scene = new THREE.Scene();

    // 3/4 view from above — we want to see the top of the
    // ring (where the "progress arc" sweeps), not the inside
    // of the tube. A high Y + moderate Z gives this framing.
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 7, 7);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // PMREM env map for proper PBR reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xf5f1ea);
    const envRT = pmrem.fromScene(envScene, 0.04);

    // 3-point lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.4);
    key.position.set(5, 7, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.45);
    fill.position.set(-6, 3, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9b6e, 0.35);
    rim.position.set(0, 4, -6);
    scene.add(rim);

    // Dimensions
    const RING_RADIUS = 2.3;
    const TUBE_RADIUS = 0.42;

    // RingCurve — a circle in the XZ plane (Y is up). Used to
    // build a smooth tube around the ring centerline.
    class RingCurve extends THREE.Curve<THREE.Vector3> {
      constructor(public r: number) { super(); }
      getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        const a = t * Math.PI * 2;
        return target.set(Math.cos(a) * this.r, 0, Math.sin(a) * this.r);
      }
    }
    // RingArcCurve — partial ring starting at 12 o'clock and
    // sweeping clockwise by `arc` radians.
    class RingArcCurve extends THREE.Curve<THREE.Vector3> {
      constructor(public r: number, public arc: number) { super(); }
      getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        const a = -Math.PI / 2 + t * this.arc;
        return target.set(Math.cos(a) * this.r, 0, Math.sin(a) * this.r);
      }
    }

    // The "track" — full ring, neutral dark material
    // We use a high tubular count (256) for smoothness, and
    // the same count for the fill (no proportional reduction)
    // so the fill's segment density matches the track's.
    const SEGMENTS = 256;
    const RADIAL = 32;
    const trackGeo = new THREE.TubeGeometry(
      new RingCurve(RING_RADIUS),
      SEGMENTS,
      TUBE_RADIUS,
      RADIAL,
      true,          // closed
    );
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a30,
      metalness: 0.15,
      roughness: 0.7,
      envMap: envRT.texture,
      envMapIntensity: 0.4,
      flatShading: false,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    scene.add(track);

    // The "fill" — partial ring matching the completion percent
    const clamped = Math.max(0, Math.min(100, percent)) / 100;
    const fillAngle = clamped * Math.PI * 2;
    if (fillAngle > 0) {
      const fillGeo = new THREE.TubeGeometry(
        new RingArcCurve(RING_RADIUS, fillAngle),
        SEGMENTS,     // same density as the track — no reduction
        TUBE_RADIUS,
        RADIAL,
        false,        // not closed — it's an arc
      );
      const fillMat = new THREE.MeshStandardMaterial({
        color: palette.primary,
        metalness: 0.2,
        roughness: 0.6,
        envMap: envRT.texture,
        envMapIntensity: 0.5,
        flatShading: false,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      scene.add(fillMesh);
    }

    // A small "cap" sphere at the leading edge of the fill — gives
    // the ring a clear sense of progress, like a watch hand's tip
    if (clamped > 0 && clamped < 1) {
      const tipAngle = fillAngle - Math.PI / 2;
      const tipX = Math.cos(tipAngle) * RING_RADIUS;
      const tipZ = Math.sin(tipAngle) * RING_RADIUS;
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 24, 24),
        new THREE.MeshStandardMaterial({
          color: 0xfffaf2,
          metalness: 0.3,
          roughness: 0.4,
          emissive: new THREE.Color(palette.tint),
          emissiveIntensity: 0.5,
        }),
      );
      tip.position.set(tipX, 0, tipZ);
      scene.add(tip);
    }

    // A faint drop shadow under the ring (a flat circle slightly
    // below the ring) to ground it visually instead of having it
    // float in space.
    const shadowGeo = new THREE.CircleGeometry(RING_RADIUS + 0.6, 64);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1e2a3a,
      transparent: true,
      opacity: 0.06,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.7;
    scene.add(shadow);

    // Camera orbit (manual, no auto-rotate)
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let theta = 0; // around Y
    // Phi = 0 looks straight down. Phi = π/2 looks from the
    // side. We bias toward 0.3 (~17° tilt) so the ring is
    // clearly visible from above with a slight 3/4 feel, and
    // the user can drag but never see the underside.
    let phi = 0.3;
    let radius = 9;

    function updateCamera() {
      // Bias the camera to stay elevated — we never want to
      // end up looking at the ring from below (would show the
      // inside of the tube). Phi stays in [0, ~0.7] so the
      // camera is always above the ring.
      camera.position.x = radius * Math.cos(phi) * Math.sin(theta);
      camera.position.y = radius * Math.sin(phi) + 1.5;
      camera.position.z = radius * Math.cos(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      theta -= (e.clientX - lastX) * 0.005;
      // Keep phi in [0.05, 0.7] so the camera always stays
      // above the ring (no underside view).
      phi = Math.max(0.05, Math.min(0.7, phi - (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
      updateCamera();
    }
    function onPointerUp() {
      isDragging = false;
      const el = renderer.domElement;
      el.style.cursor = 'grab';
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      radius = Math.max(5, Math.min(13, radius + e.deltaY * 0.015));
      updateCamera();
    }

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Single render — no animation loop, no auto-rotate, no pulse.
    // The 3D is a still life; the data drives re-renders via the
    // useEffect deps. This is the difference between "demo" and
    // "product" — a product doesn't animate for the sake of it.
    renderer.render(scene, camera);

    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
      renderer.render(scene, camera);
    }
    window.addEventListener('resize', onResize);

    return () => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      pmrem.dispose();
      envRT.dispose();
      envScene.background = null as unknown as THREE.Color;
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    };
  }, [percent, status, height, palette.primary, palette.tint]);

  if (error) {
    return (
      <div
        className="bg-cream-2 border-2 border-line p-8 text-center text-[12px] text-ink-70 flex items-center justify-center"
        style={{ height }}
      >
        3D view unavailable — {error}
      </div>
    );
  }

  return (
    <div className="relative bg-cream-2 border-2 border-ink overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Center HTML overlay — crisp typography, no canvas sprites */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {title ? (
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2 max-w-[80%] text-center truncate">
            {title}
          </div>
        ) : null}
        <div className="text-6xl font-black text-ink leading-none tabular-nums">
          {Math.round(percent)}
          <span className="text-2xl text-ink-50 font-extrabold">%</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: `#${palette.primary.toString(16).padStart(6, '0')}` }}
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
            {palette.label}
          </span>
        </div>
      </div>

      {/* Sub-metric strip across the bottom — outside the 3D, clean 2D */}
      <div className="absolute bottom-0 inset-x-0 grid grid-cols-4 border-t-2 border-ink bg-cream pointer-events-none">
        <SubMetricChip label="Financial" value={financial} color="#1d7a4a" />
        <SubMetricChip label="Tasks" value={tasks} color="#3a6c8a" />
        <SubMetricChip label="Subs" value={subs} color="#f06a2d" />
        <SubMetricChip label="Schedule" value={schedule} color="#c89c2a" />
      </div>
    </div>
  );
}

function SubMetricChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3 py-2.5 border-r-2 border-ink last:border-r-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {label}
        </span>
      </div>
      <div className="text-[15px] font-black text-ink tabular-nums leading-none">
        {Math.round(value)}%
      </div>
    </div>
  );
}
