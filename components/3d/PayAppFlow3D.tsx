'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface PayAppFlow3DItem {
  id: string;
  number: number;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACKNOWLEDGED' | 'PAID' | 'OVERDUE';
  amount: number; // this draw (total)
  date: Date | null;
  paidAt: Date | null;
}

interface PayAppFlow3DProps {
  contractTotal: number;
  payApps: PayAppFlow3DItem[];
  height?: number;
}

// Color by status — matches UDGOK palette
const STATUS_COLOR: Record<PayAppFlow3DItem['status'], number> = {
  DRAFT: 0x8a8a8a,
  SENT: 0x6b8aa0,
  VIEWED: 0x4f80ad,
  ACKNOWLEDGED: 0x3a6c8a,
  PAID: 0x1d7a4a,
  OVERDUE: 0xc23a1f,
};

const STATUS_LABEL: Record<PayAppFlow3DItem['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  ACKNOWLEDGED: 'Acknowledged',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

export function PayAppFlow3D({
  contractTotal,
  payApps,
  height = 520,
}: PayAppFlow3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(20, 14, 22);
    camera.lookAt(0, 8, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(20, 30, 15);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc0d0ff, 0.5);
    fill.position.set(-15, 10, -10);
    scene.add(fill);

    // The "tower" = contract total visualized as a column from $0 to $X
    // X-axis: time progression of pay apps
    // Y-axis: $ amount
    // Z-axis: 0 (single tower, with plates stacking up)

    const CONTRACT_HEIGHT = 16; // world units
    const PLATE_OVERHANG = 1.4; // how much wider than the tower

    // Sort pay apps by number ascending (so they stack bottom-up in order)
    const sorted = [...payApps].sort((a, b) => a.number - b.number);

    // The "ghost" tower = full contract — rendered as a transparent outline
    const towerHeight = CONTRACT_HEIGHT;
    const towerGeo = new THREE.BoxGeometry(1.4, towerHeight, 1.4);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d4,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.35,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0, towerHeight / 2 - 0.5, 0);
    scene.add(tower);

    // Tower wireframe outline (dashed feel)
    const towerEdges = new THREE.EdgesGeometry(towerGeo);
    const towerLine = new THREE.LineSegments(
      towerEdges,
      new THREE.LineBasicMaterial({ color: 0x1e2a3a, transparent: true, opacity: 0.4 }),
    );
    towerLine.position.copy(tower.position);
    scene.add(towerLine);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(40, 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d4,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.51;
    scene.add(ground);

    // $0 floor label
    const zeroLabel = makeTextSprite('$0', '#5a5a5a', 14, true);
    zeroLabel.position.set(-2.5, -0.3, 0.8);
    scene.add(zeroLabel);

    // Contract total ceiling label
    const totalLabel = makeTextSprite(
      `Contract: $${formatMoney(contractTotal)}`,
      '#1e2a3a',
      16,
      true,
    );
    totalLabel.position.set(-2.5, CONTRACT_HEIGHT - 0.5 + 0.5, 0.8);
    totalLabel.scale.set(4, 1, 1);
    scene.add(totalLabel);

    // Tick marks on the side — every 25% of contract
    for (let i = 1; i <= 4; i++) {
      const tickY = (towerHeight * i) / 4 - 0.5;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x8a8a8a }),
      );
      tick.position.set(-0.95, tickY, 0);
      scene.add(tick);
      const tickLabel = makeTextSprite(
        `${(i * 25).toFixed(0)}%`,
        '#8a8a8a',
        11,
      );
      tickLabel.position.set(-1.6, tickY, 0);
      scene.add(tickLabel);
    }

    // Stack the pay app plates from bottom up
    let cumulativeDollars = 0;
    const animatedPlates: {
      mesh: THREE.Mesh;
      lightMesh: THREE.Mesh;
      baseY: number;
      targetY: number;
      phase: number;
      index: number;
    }[] = [];

    sorted.forEach((p, i) => {
      const dollars = p.amount;
      if (dollars <= 0) return;
      const plateHeight = Math.max(0.4, (dollars / contractTotal) * towerHeight);

      const color = STATUS_COLOR[p.status] ?? STATUS_COLOR.DRAFT;
      const isPaid = p.status === 'PAID';

      // Solid plate
      const plateGeo = new THREE.BoxGeometry(PLATE_OVERHANG, plateHeight, PLATE_OVERHANG);
      const plateMat = new THREE.MeshStandardMaterial({
        color,
        roughness: isPaid ? 0.3 : 0.5,
        metalness: isPaid ? 0.3 : 0.1,
        emissive: isPaid ? new THREE.Color(color) : new THREE.Color(0x000000),
        emissiveIntensity: isPaid ? 0.2 : 0.0,
      });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      // Stack on top of previous plate
      const baseY = cumulativeDollars / contractTotal * towerHeight;
      const targetY = baseY - 0.5 + plateHeight / 2;
      plate.position.set(0, -2 + targetY, 0); // start below
      scene.add(plate);
      animatedPlates.push({
        mesh: plate,
        lightMesh: plate, // re-use; not used here
        baseY: -2 + targetY,
        targetY: targetY,
        phase: i * 0.4,
        index: i,
      });

      // Glow underlay (a slightly bigger plate, additive blending)
      const glowGeo = new THREE.BoxGeometry(
        PLATE_OVERHANG * 1.18,
        plateHeight * 1.05,
        PLATE_OVERHANG * 1.18,
      );
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isPaid ? 0.3 : 0.18,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(0, -2 + targetY, 0);
      scene.add(glow);

      // Number + amount label sitting on top of each plate
      const labelText = `#${p.number} · $${formatMoney(dollars)}`;
      const sprite = makeTextSprite(labelText, '#ffffff', 13, true);
      sprite.scale.set(2.2, 0.7, 1);
      sprite.position.set(0, -2 + targetY + plateHeight / 2 + 0.6, 0);
      scene.add(sprite);

      // Status badge
      const statusSprite = makeTextSprite(
        STATUS_LABEL[p.status],
        isPaid ? '#aef0c4' : '#fff5b0',
        10,
      );
      statusSprite.scale.set(1.5, 0.45, 1);
      statusSprite.position.set(0, -2 + targetY + plateHeight / 2 + 1.2, 0);
      scene.add(statusSprite);

      cumulativeDollars += dollars;
    });

    // Remaining = contract total - cumulative
    const remainingDollars = Math.max(0, contractTotal - cumulativeDollars);
    if (remainingDollars > 0 && contractTotal > 0) {
      const remHeight = (remainingDollars / contractTotal) * towerHeight;
      const remPlate = new THREE.Mesh(
        new THREE.BoxGeometry(PLATE_OVERHANG, remHeight, PLATE_OVERHANG),
        new THREE.MeshStandardMaterial({
          color: 0xc8c0b3,
          roughness: 0.9,
          transparent: true,
          opacity: 0.5,
        }),
      );
      const baseY = cumulativeDollars / contractTotal * towerHeight;
      const targetY = baseY - 0.5 + remHeight / 2;
      remPlate.position.set(0, -2 + targetY, 0);
      scene.add(remPlate);
      animatedPlates.push({
        mesh: remPlate,
        lightMesh: remPlate,
        baseY: -2 + targetY,
        targetY,
        phase: sorted.length * 0.4,
        index: sorted.length,
      });

      const remainingLabel = makeTextSprite(
        `$${formatMoney(remainingDollars)} remaining`,
        '#8a8a8a',
        12,
      );
      remainingLabel.scale.set(2.5, 0.6, 1);
      remainingLabel.position.set(0, -2 + targetY + remHeight / 2 + 0.6, 0);
      scene.add(remainingLabel);
    }

    // "TODAY" horizontal line cutting through the tower
    if (sorted.length > 0) {
      const todayLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.04, 3),
        new THREE.MeshBasicMaterial({ color: 0xf06a2d }),
      );
      todayLine.position.set(0, baseY_actual(towerHeight, cumulativeDollars, contractTotal), 0);
      scene.add(todayLine);
    }

    function baseY_actual(towerH: number, cumDollars: number, contract: number) {
      return (cumDollars / Math.max(1, contract)) * towerH - 0.5;
    }

    // Camera orbit
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let cameraTheta = Math.atan2(camera.position.x, camera.position.z);
    let cameraPhi = Math.atan2(camera.position.y, Math.hypot(camera.position.x, camera.position.z));
    let cameraRadius = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
    const centerY = 8;

    function updateCamera() {
      camera.position.x = cameraRadius * Math.cos(cameraPhi) * Math.sin(cameraTheta);
      camera.position.y = centerY + cameraRadius * Math.sin(cameraPhi);
      camera.position.z = cameraRadius * Math.cos(cameraPhi) * Math.cos(cameraTheta);
      camera.lookAt(0, centerY, 0);
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
      cameraPhi = Math.max(-0.3, Math.min(Math.PI / 2 - 0.05, cameraPhi + dy * 0.005));
      updateCamera();
    }
    function onPointerUp() { isDragging = false; }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      cameraRadius = Math.max(10, Math.min(60, cameraRadius + e.deltaY * 0.03));
      updateCamera();
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Animate plates rising from below into their final position
    const clock = new THREE.Clock();
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      for (const a of animatedPlates) {
        // Smooth rise
        const dist = a.targetY - a.mesh.position.y;
        if (Math.abs(dist) > 0.01) {
          a.mesh.position.y += dist * 0.04;
        } else {
          a.mesh.position.y = a.targetY;
        }
        // Pulse paid plates
        const isPaid = sorted[a.index]?.status === 'PAID';
        if (isPaid && a.mesh.material instanceof THREE.MeshStandardMaterial) {
          a.mesh.material.emissiveIntensity = 0.15 + Math.sin(t * 1.5 + a.phase) * 0.1;
        }
      }
      renderer.render(scene, camera);
    };
    animate();
    setReady(true);

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
  }, [contractTotal, payApps, height]);

  const cumulativePaid = payApps
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + p.amount, 0);
  const cumulativeAll = payApps.reduce((acc, p) => acc + p.amount, 0);
  const pct = contractTotal > 0 ? Math.round((cumulativeAll / contractTotal) * 100) : 0;

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
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-success" /> Paid (${formatMoney(cumulativePaid)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ background: '#3a6c8a' }} /> Acknowledged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-error" /> Overdue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-ink-30" /> Draft
        </span>
        <span className="ml-auto text-ink-30 hidden sm:inline">Drag to orbit · scroll to zoom</span>
        <span className="font-black text-orange-d">{pct}% of contract billed</span>
      </div>
    </div>
  );
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`;
  return Math.round(n).toString();
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
