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

// Color mapping per status — matches our UDGOK palette (CSS vars converted to hex)
const STATUS_COLORS: Record<GanttTask3D['status'], number> = {
  TODO: 0x8a8a8a,         // ink-30
  IN_PROGRESS: 0xf06a2d,  // orange (with pulse)
  BLOCKED: 0xc23a1f,      // error
  DONE: 0x1d7a4a,         // success
  CANCELLED: 0xc8c0b3,    // faded
};

const PRIORITY_HEIGHTS: Record<GanttTask3D['priority'], number> = {
  LOW: 0.6,
  NORMAL: 1.0,
  HIGH: 1.6,
  URGENT: 2.2,
};

export function ThreeDGantt({
  projectName,
  projectStart,
  projectEnd,
  tasks,
  height = 480,
}: ThreeDGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Bail out gracefully if WebGL is unavailable
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError('WebGL not available in this browser');
      return;
    }

    const width = container.clientWidth;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f1ea); // cream

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(20, 18, 25);
    camera.lookAt(0, 0, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(15, 25, 10);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe0e8ff, 0.4);
    fill.position.set(-15, 10, -10);
    scene.add(fill);

    // --- Determine time window ---
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
      allTimes.push(Date.now());
      allTimes.push(Date.now() + 30 * 86_400_000);
    }
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const totalSpan = Math.max(1, maxTime - minTime);

    // Map time to X position
    const xFromTime = (t: number) => ((t - minTime) / totalSpan) * 24 - 12; // -12..+12
    // Number of unique rows = 1 per task (no row grouping — keep it simple & visual)
    const rowsCount = Math.max(tasks.length, 1);
    const rowSpacing = 1.6;
    const yFromRow = (i: number) => (i - (rowsCount - 1) / 2) * rowSpacing;

    // --- Ground plane (the project timeline floor) ---
    const groundGeo = new THREE.PlaneGeometry(30, rowsCount * rowSpacing + 4);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d4, // paper/cream-2
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.51;
    scene.add(ground);

    // --- Time grid lines (vertical) on the floor ---
    const gridGroup = new THREE.Group();
    const monthsCount = 6; // show 6 markers
    for (let i = 0; i <= monthsCount; i++) {
      const t = minTime + (totalSpan * i) / monthsCount;
      const x = xFromTime(t);
      const lineGeo = new THREE.BoxGeometry(0.04, 0.05, rowsCount * rowSpacing + 3);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xb8b0a2 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(x, -0.49, 0);
      gridGroup.add(line);

      // Month label as a small sprite (canvas texture)
      const date = new Date(t);
      const label = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const sprite = makeTextSprite(label, '#5a5a5a', 11);
      sprite.position.set(x, -0.4, (rowsCount * rowSpacing) / 2 + 1.5);
      gridGroup.add(sprite);
    }
    scene.add(gridGroup);

    // --- Today marker (vertical line) ---
    const now = Date.now();
    if (now >= minTime && now <= maxTime) {
      const x = xFromTime(now);
      const todayGeo = new THREE.BoxGeometry(0.08, 0.05, rowsCount * rowSpacing + 3);
      const todayMat = new THREE.MeshBasicMaterial({ color: 0xf06a2d });
      const todayLine = new THREE.Mesh(todayGeo, todayMat);
      todayLine.position.set(x, -0.48, 0);
      scene.add(todayLine);

      const todayLabel = makeTextSprite('TODAY', '#f06a2d', 13);
      todayLabel.position.set(x, 0.6, (rowsCount * rowSpacing) / 2 + 1.5);
      scene.add(todayLabel);
    }

    // --- Task bars ---
    const taskGroup = new THREE.Group();
    const animatedBars: { mesh: THREE.Mesh; baseScale: number; phase: number }[] = [];
    const labelSprites: THREE.Sprite[] = [];

    tasks.forEach((t, i) => {
      const s = t.startDate ? new Date(t.startDate).getTime() : null;
      const e = t.endDate ? new Date(t.endDate).getTime() : t.dueDate ? new Date(t.dueDate).getTime() : null;
      if (s === null || e === null) return;
      const x1 = xFromTime(s);
      const x2 = xFromTime(e);
      const width = Math.max(0.4, Math.abs(x2 - x1));
      const yPos = yFromRow(i);
      const heightScale = PRIORITY_HEIGHTS[t.priority] ?? 1;

      const color = STATUS_COLORS[t.status] ?? STATUS_COLORS.TODO;
      const barGeo = new THREE.BoxGeometry(width, heightScale, 0.9);
      const barMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1,
        transparent: t.status === 'CANCELLED',
        opacity: t.status === 'CANCELLED' ? 0.4 : 1.0,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set((x1 + x2) / 2, heightScale / 2, yPos);
      taskGroup.add(bar);
      animatedBars.push({ mesh: bar, baseScale: heightScale, phase: i * 0.7 });

      // Task label (only show title above bar)
      const truncated = t.title.length > 28 ? t.title.slice(0, 26) + '…' : t.title;
      const labelColor =
        t.status === 'DONE' ? '#1d7a4a' :
        t.status === 'IN_PROGRESS' ? '#f06a2d' :
        t.status === 'BLOCKED' ? '#c23a1f' :
        t.status === 'CANCELLED' ? '#8a8a8a' :
        '#1e2a3a';
      const sprite = makeTextSprite(truncated, labelColor, 12, true);
      sprite.position.set((x1 + x2) / 2, heightScale + 0.5, yPos);
      sprite.scale.set(Math.max(2, width * 0.9), 0.5, 1);
      taskGroup.add(sprite);
      labelSprites.push(sprite);
    });
    scene.add(taskGroup);

    // --- Project boundary (start/end walls) ---
    if (start) {
      const wallGeo = new THREE.BoxGeometry(0.15, 2, rowsCount * rowSpacing + 3);
      const wallMat = new THREE.MeshBasicMaterial({ color: 0x1e2a3a });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(xFromTime(start), 0, 0);
      scene.add(wall);
    }
    if (end) {
      const wallGeo = new THREE.BoxGeometry(0.15, 2, rowsCount * rowSpacing + 3);
      const wallMat = new THREE.MeshBasicMaterial({ color: 0x1e2a3a });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(xFromTime(end), 0, 0);
      scene.add(wall);
    }

    // --- Orbit controls (manual, no external lib) ---
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let cameraTheta = Math.atan2(camera.position.x, camera.position.z);
    let cameraPhi = Math.atan2(camera.position.y, Math.hypot(camera.position.x, camera.position.z));
    let cameraRadius = Math.hypot(camera.position.x, camera.position.y, camera.position.z);

    function updateCamera() {
      camera.position.x = cameraRadius * Math.cos(cameraPhi) * Math.sin(cameraTheta);
      camera.position.y = cameraRadius * Math.sin(cameraPhi);
      camera.position.z = cameraRadius * Math.cos(cameraPhi) * Math.cos(cameraTheta);
      camera.lookAt(0, 0, 0);
    }

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cameraTheta -= dx * 0.005;
      cameraPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraPhi + dy * 0.005));
      updateCamera();
    }
    function onPointerUp() {
      isDragging = false;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      cameraRadius = Math.max(10, Math.min(60, cameraRadius + e.deltaY * 0.03));
      updateCamera();
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // --- Animation loop ---
    let animId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      // Pulse the in-progress bars
      for (const ab of animatedBars) {
        if (tasks[animatedBars.indexOf(ab)]?.status === 'IN_PROGRESS') {
          const pulse = 1 + Math.sin(t * 2 + ab.phase) * 0.05;
          ab.mesh.scale.y = ab.baseScale * pulse;
        }
      }
      renderer.render(scene, camera);
    };
    animate();
    setReady(true);

    // Resize handler
    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
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

  return (
    <div className="relative">
      {error ? (
        <div className="bg-cream-2 border-2 border-line p-8 text-center text-[12px] text-ink-70" style={{ height }}>
          3D view unavailable — {error}
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="bg-cream-2 border-2 border-ink overflow-hidden touch-none"
            style={{ height, cursor: 'grab' }}
          />
          {!ready ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 bg-cream px-3 py-1.5 border border-line">
                Loading 3D…
              </div>
            </div>
          ) : null}
        </>
      )}
      <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-orange" /> In progress (pulsing)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-success" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-error" /> Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-ink-30" /> To do
        </span>
        <span className="ml-auto text-ink-30 hidden sm:inline">Drag to rotate · scroll to zoom</span>
      </div>
    </div>
  );
}

/**
 * Make a sprite from a text label using a 2D canvas. Avoids needing
 * any font files to be loaded.
 */
function makeTextSprite(text: string, color: string, fontSize: number, bold = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const font = `${bold ? '700' : '500'} ${fontSize}px "Inter", system-ui, sans-serif`;
  // Measure first
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + 16;
  canvas.height = fontSize + 12;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  // Scale so the sprite appears ~1.5 world units wide for a 100px-tall canvas
  const scale = 1.5;
  sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
  return sprite;
}
