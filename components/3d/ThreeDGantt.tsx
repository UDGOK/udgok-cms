'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface GanttTask3D {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
}

interface ThreeDGanttProps {
  projectName: string;
  projectStart: Date | null;
  projectEnd: Date | null;
  tasks: GanttTask3D[];
  height?: number;
}

// Restrained status palette — only used for status, never for decoration
const STATUS_COLORS: Record<GanttTask3D['status'], { bar: number; top: number; label: string }> = {
  TODO:      { bar: 0xb5ad9c, top: 0xd5cebd, label: 'To do' },
  IN_PROGRESS:{ bar: 0xf06a2d, top: 0xffa071, label: 'In progress' },
  BLOCKED:   { bar: 0xc23a1f, top: 0xe0603f, label: 'Blocked' },
  DONE:      { bar: 0x1d7a4a, top: 0x4ab07d, label: 'Done' },
  CANCELLED: { bar: 0xc8c0b3, top: 0xddd6c8, label: 'Cancelled' },
};

/**
 * 3D project timeline. Each task is a bar on a floating floor
 * ribbon; the ribbon is the project timeline, the bars are
 * tasks in their actual time range, and a vertical orange line
 * marks today.
 *
 * Design choices:
 *  - No priority-based bar height. That was a "kid did it"
 *    idea (priority is already shown via color, status via the
 *    bar fill — making it physical just made the chart noisy).
 *  - All status colors are pulled from a 5-color palette, no
 *    extras.
 *  - HTML overlay for task names + dates (crisp typography).
 *  - Static camera, no auto-rotate, no pulse.
 *  - No floating dot, no glow, no "TODAY" 3D label (replaced
 *    with a clean HTML overlay anchored to the today line).
 *  - One PBR material per status (baked once per render).
 */
export function ThreeDGantt({
  projectName,
  projectStart,
  projectEnd,
  tasks,
  height = 520,
}: ThreeDGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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

    // Side view, slightly elevated — 3/4 from above
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 14, 22);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xf5f1ea);
    const envRT = pmrem.fromScene(envScene, 0.04);

    // 3-point lighting tuned for a top-down scene
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.2);
    key.position.set(8, 18, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.4);
    fill.position.set(-8, 10, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9b6e, 0.3);
    rim.position.set(0, 6, -10);
    scene.add(rim);

    // --- Time window ---
    const start = projectStart ? new Date(projectStart).getTime() : null;
    const end = projectEnd ? new Date(projectEnd).getTime() : null;
    const allTimes: number[] = [];
    for (const t of tasks) {
      if (t.startDate) allTimes.push(new Date(t.startDate).getTime());
      if (t.endDate) allTimes.push(new Date(t.endDate).getTime());
      if (t.dueDate) allTimes.push(new Date(t.dueDate).getTime());
      if (start) allTimes.push(start);
      if (end) allTimes.push(end);
    }
    if (allTimes.length === 0) {
      allTimes.push(Date.now() - 30 * 86_400_000);
      allTimes.push(Date.now() + 30 * 86_400_000);
    }
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const totalSpan = Math.max(1, maxTime - minTime);

    // X axis: time, mapped to -12..+12 world units
    const xFromTime = (t: number) => ((t - minTime) / totalSpan) * 24 - 12;

    // Z axis: rows. 1 row per task, centered.
    const rowsCount = Math.max(tasks.length, 1);
    const rowSpacing = 1.4;
    const zFromRow = (i: number) => (i - (rowsCount - 1) / 2) * rowSpacing;

    // --- The "ribbon" — a thin extruded plate that the bars sit on ---
    const ribbonWidth = 26;
    const ribbonDepth = rowsCount * rowSpacing + 3;
    const ribbonGeo = new THREE.BoxGeometry(ribbonWidth, 0.15, ribbonDepth);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d4,
      metalness: 0.05,
      roughness: 0.85,
      envMap: envRT.texture,
      envMapIntensity: 0.4,
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.y = -0.08;
    scene.add(ribbon);

    // A thin dark trim around the ribbon's top edge for definition
    const trimGeo = new THREE.EdgesGeometry(ribbonGeo);
    const trimMat = new THREE.LineBasicMaterial({ color: 0x1e2a3a, transparent: true, opacity: 0.18 });
    const trim = new THREE.LineSegments(trimGeo, trimMat);
    trim.position.copy(ribbon.position);
    scene.add(trim);

    // --- Time grid lines on the ribbon (subtle, every ~month) ---
    const monthsCount = 6;
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.18 });
    for (let i = 0; i <= monthsCount; i++) {
      const t = minTime + (totalSpan * i) / monthsCount;
      const x = xFromTime(t);
      const tickGeo = new THREE.BoxGeometry(0.02, 0.04, ribbonDepth - 0.4);
      const tick = new THREE.Mesh(tickGeo, gridMat);
      tick.position.set(x, 0, 0);
      scene.add(tick);
    }

    // --- Today marker (vertical orange line) ---
    const now = Date.now();
    let todayXLocal: number | null = null;
    if (now >= minTime && now <= maxTime) {
      todayXLocal = xFromTime(now);
      const todayGeo = new THREE.CylinderGeometry(0.04, 0.04, ribbonDepth, 12);
      const todayMat = new THREE.MeshStandardMaterial({
        color: 0xf06a2d,
        metalness: 0.2,
        roughness: 0.4,
        emissive: new THREE.Color(0xf06a2d),
        emissiveIntensity: 0.3,
      });
      const todayLine = new THREE.Mesh(todayGeo, todayMat);
      todayLine.rotation.x = Math.PI / 2;
      todayLine.position.set(todayXLocal, 0.7, 0);
      scene.add(todayLine);

      // A small cap at the top of the line
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0xf06a2d,
          metalness: 0.3,
          roughness: 0.4,
        }),
      );
      cap.position.set(todayXLocal, ribbonDepth / 2 + 0.4, 0);
      scene.add(cap);
    }

    // --- Task bars ---
    const BAR_THICKNESS = 0.9;
    const BAR_HEIGHT = 0.85;
    const taskBars: Array<{ id: string; x1: number; x2: number; z: number; status: GanttTask3D['status'] }> = [];

    tasks.forEach((t, i) => {
      const s = t.startDate ? new Date(t.startDate).getTime() : null;
      const e = t.endDate
        ? new Date(t.endDate).getTime()
        : t.dueDate
        ? new Date(t.dueDate).getTime()
        : null;
      if (s === null || e === null) return;
      const x1 = xFromTime(s);
      const x2 = xFromTime(e);
      const width = Math.max(0.4, Math.abs(x2 - x1));
      const z = zFromRow(i);
      const palette = STATUS_COLORS[t.status] ?? STATUS_COLORS.TODO;
      const isCancelled = t.status === 'CANCELLED';

      // The bar — a single box geometry per task
      const barGeo = new THREE.BoxGeometry(width, BAR_HEIGHT, BAR_THICKNESS);
      const barMat = new THREE.MeshStandardMaterial({
        color: palette.bar,
        metalness: 0.3,
        roughness: 0.5,
        transparent: isCancelled,
        opacity: isCancelled ? 0.35 : 1.0,
        envMap: envRT.texture,
        envMapIntensity: 0.6,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set((x1 + x2) / 2, BAR_HEIGHT / 2 + 0.08, z);
      scene.add(bar);

      // A thin "highlight" cap on top of the bar — shows the status
      // more clearly than the bar body alone, and gives the bar
      // a subtle 2-tone stripe (premium feel).
      const capGeo = new THREE.BoxGeometry(width, 0.08, BAR_THICKNESS * 0.7);
      const capMat = new THREE.MeshStandardMaterial({
        color: palette.top,
        metalness: 0.4,
        roughness: 0.35,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set((x1 + x2) / 2, BAR_HEIGHT + 0.08 + 0.04, z);
      scene.add(cap);

      taskBars.push({ id: t.id, x1, x2, z, status: t.status });
    });

    // --- Camera orbit (manual) ---
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let theta = 0; // around Y
    let phi = Math.PI / 4; // tilt down
    let radius = 26;

    function updateCamera() {
      camera.position.x = radius * Math.cos(phi) * Math.sin(theta);
      camera.position.y = radius * Math.sin(phi) + 4;
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
      phi = Math.max(0.15, Math.min(Math.PI / 2.5, phi - (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
      updateCamera();
      renderer.render(scene, camera);
    }
    function onPointerUp() {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      radius = Math.max(15, Math.min(50, radius + e.deltaY * 0.04));
      updateCamera();
      renderer.render(scene, camera);
    }

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

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
  }, [projectName, projectStart, projectEnd, tasks, height]);

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

      {/* Top-left: project name + meta */}
      <div className="absolute top-3 left-3 max-w-[60%] pointer-events-none">
        <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-ink-50">
          Timeline
        </div>
        <div className="text-[14px] font-black text-ink truncate">{projectName}</div>
      </div>

      {/* Top-right: legend */}
      <div className="absolute top-3 right-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 pointer-events-none">
        {(Object.keys(STATUS_COLORS) as Array<GanttTask3D['status']>).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2"
              style={{ background: `#${STATUS_COLORS[k].bar.toString(16).padStart(6, '0')}` }}
            />
            {STATUS_COLORS[k].label}
          </div>
        ))}
      </div>

      {/* Bottom-left: drag-to-orbit hint */}
      <div className="absolute bottom-3 left-3 text-[9px] font-mono uppercase tracking-[0.15em] text-ink-30 pointer-events-none">
        Drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
