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

const STATUS_COLORS: Record<PayAppFlow3DItem['status'], { bar: number; top: number; label: string }> = {
  DRAFT:         { bar: 0xb5ad9c, top: 0xd5cebd, label: 'Draft' },
  SENT:          { bar: 0x6b8aa0, top: 0x8aa9bf, label: 'Sent' },
  VIEWED:        { bar: 0x4f80ad, top: 0x7da7c8, label: 'Viewed' },
  ACKNOWLEDGED:  { bar: 0x3a6c8a, top: 0x6b95b0, label: 'Acknowledged' },
  PAID:          { bar: 0x1d7a4a, top: 0x4ab07d, label: 'Paid' },
  OVERDUE:       { bar: 0xc23a1f, top: 0xe0603f, label: 'Overdue' },
};

/**
 * 3D pay-app flow. The contract total is a vertical column
 * (the "tower"); each pay app is a horizontal slice stacked
 * from the bottom in chronological order. The unfilled
 * remainder is a faint top section.
 *
 * Design choices:
 *  - One column, no animated rise (that was gimmicky). The
 *    data is what it is, render it as-is.
 *  - Status shown via bar color only. No additive glow, no
 *    emissive pulsing, no "aura" plates.
 *  - PBR materials with envMap.
 *  - Crisp HTML overlay for the big numbers (total contract,
 *    amount paid, % complete). No canvas sprites.
 *  - Static camera, no auto-rotate, no animation loop.
 *  - Tick marks every 25% on the side, like an architect's
 *    scale.
 */
export function PayAppFlow3D({
  contractTotal,
  payApps,
  height = 520,
}: PayAppFlow3DProps) {
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

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(7, 10, 18);
    camera.lookAt(0, 8, 0);

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

    // 3-point lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.3);
    key.position.set(8, 14, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.45);
    fill.position.set(-7, 6, 5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9b6e, 0.3);
    rim.position.set(0, 5, -10);
    scene.add(rim);

    // Column dimensions
    const TOWER_HEIGHT = 16;
    const COLUMN_WIDTH = 2.2;
    const PLATE_OVERHANG = 0.15;

    // --- The full "ghost" column showing the contract total ---
    const towerGeo = new THREE.BoxGeometry(COLUMN_WIDTH, TOWER_HEIGHT, COLUMN_WIDTH);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x1e2a3a,
      metalness: 0.4,
      roughness: 0.6,
      transparent: true,
      opacity: 0.06,
      envMap: envRT.texture,
      envMapIntensity: 0.5,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0, TOWER_HEIGHT / 2 - 0.5, 0);
    scene.add(tower);

    // Outline edges — gives the column visible structure
    const towerEdges = new THREE.EdgesGeometry(towerGeo);
    const towerLine = new THREE.LineSegments(
      towerEdges,
      new THREE.LineBasicMaterial({ color: 0x1e2a3a, transparent: true, opacity: 0.22 }),
    );
    towerLine.position.copy(tower.position);
    scene.add(towerLine);

    // --- Floor ---
    const floorGeo = new THREE.PlaneGeometry(30, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d4,
      metalness: 0.05,
      roughness: 0.95,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.51;
    scene.add(floor);

    // --- Side "ruler" — tick marks every 25% of the contract ---
    const rulerMat = new THREE.MeshBasicMaterial({ color: 0x1e2a3a, transparent: true, opacity: 0.35 });
    const rulerWidth = 0.5;
    for (let i = 1; i <= 4; i++) {
      const tickY = (TOWER_HEIGHT * i) / 4 - 0.5;
      // Main tick
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(rulerWidth, 0.06, 0.06),
        rulerMat,
      );
      tick.position.set(-COLUMN_WIDTH / 2 - 0.5, tickY, COLUMN_WIDTH / 2 + 0.05);
      scene.add(tick);
      // Smaller ticks between
      for (let j = 1; j < 4; j++) {
        const subY = (TOWER_HEIGHT * (i - 1 + j / 4)) / 4 - 0.5;
        const subTick = new THREE.Mesh(
          new THREE.BoxGeometry(rulerWidth * 0.4, 0.03, 0.03),
          rulerMat,
        );
        subTick.position.set(-COLUMN_WIDTH / 2 - 0.5, subY, COLUMN_WIDTH / 2 + 0.05);
        scene.add(subTick);
      }
    }

    // --- Pay app plates, stacked from the bottom in chronological order ---
    const sorted = [...payApps].sort((a, b) => a.number - b.number);

    let cumulativeDollars = 0;
    for (const p of sorted) {
      const dollars = p.amount;
      if (dollars <= 0) continue;
      const plateHeight = Math.max(0.25, (dollars / Math.max(1, contractTotal)) * TOWER_HEIGHT);
      const palette = STATUS_COLORS[p.status] ?? STATUS_COLORS.DRAFT;

      // The plate itself — a clean box
      const plateGeo = new THREE.BoxGeometry(
        COLUMN_WIDTH + PLATE_OVERHANG,
        plateHeight,
        COLUMN_WIDTH + PLATE_OVERHANG,
      );
      const plateMat = new THREE.MeshStandardMaterial({
        color: palette.bar,
        metalness: 0.45,
        roughness: 0.4,
        envMap: envRT.texture,
        envMapIntensity: 0.7,
      });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      const plateCenterY = cumulativeDollars / Math.max(1, contractTotal) * TOWER_HEIGHT - 0.5 + plateHeight / 2;
      plate.position.set(0, plateCenterY, 0);
      scene.add(plate);

      // Thin highlight on top of the plate — gives a 2-tone stripe
      const capGeo = new THREE.BoxGeometry(
        COLUMN_WIDTH + PLATE_OVERHANG,
        0.04,
        COLUMN_WIDTH + PLATE_OVERHANG * 0.5,
      );
      const capMat = new THREE.MeshStandardMaterial({
        color: palette.top,
        metalness: 0.5,
        roughness: 0.3,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0, plateCenterY + plateHeight / 2 + 0.02, 0);
      scene.add(cap);

      // Thin trim on the front face — engraved-looking number mark
      const trimGeo = new THREE.BoxGeometry(
        COLUMN_WIDTH + PLATE_OVERHANG + 0.02,
        plateHeight * 0.95,
        0.02,
      );
      const trimMat = new THREE.MeshBasicMaterial({ color: 0x1e2a3a, transparent: true, opacity: 0.4 });
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(0, plateCenterY, COLUMN_WIDTH / 2 + PLATE_OVERHANG / 2 + 0.02);
      scene.add(trim);

      cumulativeDollars += dollars;
    }

    // --- The "remaining" top section: a faint marker showing
    //     what's left of the contract ---
    const remainingDollars = Math.max(0, contractTotal - cumulativeDollars);
    if (remainingDollars > 0 && contractTotal > 0) {
      const remHeight = (remainingDollars / contractTotal) * TOWER_HEIGHT;
      const remY = cumulativeDollars / contractTotal * TOWER_HEIGHT - 0.5 + remHeight / 2;
      // Diagonal-stripe pattern: just a slightly darker ghost
      const remGeo = new THREE.BoxGeometry(COLUMN_WIDTH, remHeight, COLUMN_WIDTH);
      const remMat = new THREE.MeshStandardMaterial({
        color: 0xc8c0b3,
        metalness: 0.1,
        roughness: 0.85,
        transparent: true,
        opacity: 0.35,
      });
      const remMesh = new THREE.Mesh(remGeo, remMat);
      remMesh.position.set(0, remY, 0);
      scene.add(remMesh);

      // A dashed line at the "current top" of paid — like a
      // water-level mark
      const capY = cumulativeDollars / contractTotal * TOWER_HEIGHT - 0.5;
      const lineGeo = new THREE.BoxGeometry(COLUMN_WIDTH + 0.4, 0.04, COLUMN_WIDTH + 0.4);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0xf06a2d,
        metalness: 0.2,
        roughness: 0.5,
        emissive: new THREE.Color(0xf06a2d),
        emissiveIntensity: 0.4,
      });
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(0, capY, 0);
      scene.add(lineMesh);
    }

    // --- Camera orbit (manual, no auto-rotate) ---
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let theta = Math.PI / 5;
    let phi = Math.PI / 8;
    let radius = 22;
    const centerY = 8;

    function updateCamera() {
      camera.position.x = radius * Math.cos(phi) * Math.sin(theta);
      camera.position.y = centerY + radius * Math.sin(phi);
      camera.position.z = radius * Math.cos(phi) * Math.cos(theta);
      camera.lookAt(0, centerY, 0);
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
      phi = Math.max(-0.3, Math.min(Math.PI / 2.5, phi - (e.clientY - lastY) * 0.004));
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
      radius = Math.max(12, Math.min(45, radius + e.deltaY * 0.04));
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
  }, [contractTotal, payApps, height]);

  const cumulativePaid = payApps
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + p.amount, 0);
  const cumulativeAll = payApps.reduce((acc, p) => acc + p.amount, 0);
  const pct = contractTotal > 0 ? Math.round((cumulativeAll / contractTotal) * 100) : 0;

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

      {/* Top-left: title */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-ink-50">
          Cash flow
        </div>
        <div className="text-[14px] font-black text-ink">Pay applications</div>
      </div>

      {/* Right side: stat cards */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 pointer-events-none">
        <StatCard label="Contract" value={contractTotal} accent="#1e2a3a" />
        <StatCard label="Billed" value={cumulativeAll} accent="#f06a2d" />
        <StatCard label="Paid" value={cumulativePaid} accent="#1d7a4a" />
      </div>

      {/* Bottom-left: drag-to-orbit hint */}
      <div className="absolute bottom-3 left-3 text-[9px] font-mono uppercase tracking-[0.15em] text-ink-30 pointer-events-none">
        Drag to orbit · scroll to zoom
      </div>

      {/* Bottom-right: percent complete */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div className="bg-ink text-cream px-3 py-2">
          <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-cream/60">
            Complete
          </div>
          <div className="text-2xl font-black tabular-nums leading-none mt-0.5">
            {pct}<span className="text-base">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-cream border-2 border-ink px-3 py-2 min-w-[140px]">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-50">
          {label}
        </span>
      </div>
      <div className="text-[15px] font-black text-ink tabular-nums leading-none mt-1">
        ${value.toLocaleString()}
      </div>
    </div>
  );
}

// Money formatting is done in the HTML overlay (StatCard)
// using .toLocaleString() for crisp typography. No canvas
// sprites needed.
