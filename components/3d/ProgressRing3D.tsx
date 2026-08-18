'use client';

import { useEffect, useRef, useState } from 'react';
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

const STATUS_COLOR: Record<string, number> = {
  PLANNING: 0x6b8aa0,
  ACTIVE: 0xf06a2d,
  ON_HOLD: 0xe8b830,
  COMPLETED: 0x1d7a4a,
  CANCELLED: 0xc23a1f,
  ARCHIVED: 0x8a8a8a,
};

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError('WebGL not available');
      return;
    }

    const width = container.clientWidth;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f1ea);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 5, 8);
    camera.lookAt(0, 0, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(5, 8, 5);
    scene.add(sun);
    const back = new THREE.DirectionalLight(0xc0d0ff, 0.5);
    back.position.set(-5, 3, -3);
    scene.add(back);

    // The torus ring — radius 2.4, tube 0.55
    const RING_RADIUS = 2.4;
    const TUBE_RADIUS = 0.55;
    const statusColor = STATUS_COLOR[status] ?? STATUS_COLOR.ACTIVE;
    const clamped = Math.max(0, Math.min(100, percent)) / 100;

    // Build the ring by 4 segments, one per metric, in proportion
    // Each segment uses TorusGeometry, rotated and clipped
    // Simpler approach: build the full torus, then mask the unfilled portion
    // by rendering a "ghost" unfilled torus in light gray, and the filled
    // portion as a sweep in segments.

    // Base ghost ring (the unfilled part)
    const ghostGeo = new THREE.TorusGeometry(RING_RADIUS, TUBE_RADIUS, 16, 100);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0xc8c0b3,
      roughness: 0.85,
      metalness: 0.0,
    });
    const ghostRing = new THREE.Mesh(ghostGeo, ghostMat);
    ghostRing.rotation.x = Math.PI / 2;
    scene.add(ghostRing);

    // Filled portion — sweep from 0 to 2π * percent
    // We use a CylinderGeometry as a "wedge" of the torus, simulating the
    // filled arc. Built from individual small segments for smooth edges.
    const segments = 64;
    const totalAngle = 2 * Math.PI * clamped;
    const segmentAngle = totalAngle / segments;

    const filledGroup = new THREE.Group();
    for (let i = 0; i < segments; i++) {
      const angle = i * segmentAngle;
      const wedgeGeo = new THREE.TorusGeometry(
        RING_RADIUS,
        TUBE_RADIUS * 0.95,
        12,
        4,
        segmentAngle,
      );
      const wedgeMat = new THREE.MeshStandardMaterial({
        color: statusColor,
        roughness: 0.3,
        metalness: 0.2,
        emissive: new THREE.Color(statusColor),
        emissiveIntensity: 0.15,
      });
      const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
      // Rotate so the start of the wedge points along +X
      wedge.rotation.x = Math.PI / 2;
      wedge.rotation.z = -angle - segmentAngle / 2;
      filledGroup.add(wedge);
    }
    scene.add(filledGroup);

    // Add 4 small "pill" markers around the ring showing each sub-metric
    const metricAnchors: { angle: number; label: string; value: number; color: number }[] = [
      { angle: 0, label: 'FINANCIAL', value: financial, color: 0x1d7a4a },
      { angle: Math.PI / 2, label: 'TASKS', value: tasks, color: 0x3a6c8a },
      { angle: Math.PI, label: 'SUBS', value: subs, color: 0xf06a2d },
      { angle: (3 * Math.PI) / 2, label: 'SCHEDULE', value: schedule, color: 0xe8b830 },
    ];
    for (const m of metricAnchors) {
      // Small sphere at the metric position
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshStandardMaterial({
          color: m.color,
          roughness: 0.3,
          metalness: 0.3,
          emissive: new THREE.Color(m.color),
          emissiveIntensity: 0.4,
        }),
      );
      dot.position.set(
        Math.cos(m.angle) * RING_RADIUS,
        0,
        Math.sin(m.angle) * RING_RADIUS,
      );
      scene.add(dot);
    }

    // Center number — large percent
    const pctLabel = makeTextSprite(`${Math.round(percent)}%`, '#1e2a3a', 80, true);
    pctLabel.scale.set(2.5, 1.2, 1);
    pctLabel.position.set(0, 0.1, 0);
    scene.add(pctLabel);

    if (title) {
      const titleLabel = makeTextSprite(title, '#5a5a5a', 14, true);
      titleLabel.scale.set(2.2, 0.5, 1);
      titleLabel.position.set(0, 0.85, 0);
      scene.add(titleLabel);
    }

    const subLabel = makeTextSprite('OVERALL', '#8a8a8a', 11);
    subLabel.scale.set(1.4, 0.3, 1);
    subLabel.position.set(0, -0.7, 0);
    scene.add(subLabel);

    // Slow auto-rotate
    let autoRotate = true;
    let cameraTheta = 0;
    let cameraY = 5;
    let cameraRadius = 8;
    let lastInteract = Date.now();

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = Date.now();
      autoRotate = false;
    }
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cameraTheta -= dx * 0.005;
      cameraY = Math.max(1, Math.min(15, cameraY + dy * 0.05));
      lastInteract = Date.now();
    }
    function onPointerUp() { isDragging = false; }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      cameraRadius = Math.max(5, Math.min(15, cameraRadius + e.deltaY * 0.02));
      lastInteract = Date.now();
      autoRotate = false;
    }

    function updateCamera() {
      camera.position.x = cameraRadius * Math.sin(cameraTheta);
      camera.position.y = cameraY;
      camera.position.z = cameraRadius * Math.cos(cameraTheta);
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const clock = new THREE.Clock();
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      // Slow auto-rotate when idle
      if (autoRotate && Date.now() - lastInteract > 1500) {
        cameraTheta += 0.003;
        updateCamera();
      }
      // Subtle pulse on the filled portion
      const pulse = 1 + Math.sin(elapsed * 1.5) * 0.02;
      filledGroup.scale.set(pulse, pulse, 1);
      renderer.render(scene, camera);
    };
    animate();

    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener('resize', onResize);

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
  }, [percent, financial, tasks, subs, schedule, status, height, title]);

  return (
    <div className="relative">
      {error ? (
        <div className="bg-cream-2 border-2 border-line p-8 text-center text-[12px] text-ink-70" style={{ height }}>
          3D view unavailable — {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="bg-cream-2 border-2 border-ink overflow-hidden touch-none"
          style={{ height, cursor: 'grab' }}
        />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-success" /> Financial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ background: '#3a6c8a' }} /> Tasks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-orange" /> Subs
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-warning" /> Schedule
        </span>
        <span className="ml-auto text-ink-30 hidden sm:inline">Drag to orbit · scroll to zoom</span>
      </div>
    </div>
  );
}

function makeTextSprite(text: string, color: string, fontSize: number, bold = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const font = `${bold ? '700' : '500'} ${fontSize}px "Inter", system-ui, sans-serif`;
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
  const scale = 1.5;
  sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
  return sprite;
}
