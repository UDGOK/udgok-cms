'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  runTakeoffAction,
  pushTakeoffToSovAction,
  deleteBimModelAction,
} from '@/lib/projects/actions';
import type { TakeoffResult, TakeoffItem } from '@/lib/takeoff/types';

interface BimModel {
  id: string;
  url: string;
  filename: string;
  size: number;
  createdAt: Date;
  takeoffs?: { id: string; status: string; error: string | null; createdAt: Date }[];
}

interface BimTakeoff {
  id: string;
  bimModelId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  result: TakeoffResult | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TakeoffTabProps {
  workspaceSlug: string;
  projectId: string;
  bimModels: BimModel[];
  bimTakeoffs: BimTakeoff[];
}

export function TakeoffTab({ workspaceSlug, projectId, bimModels, bimTakeoffs }: TakeoffTabProps) {
  return (
    <div className="mt-6 space-y-8">
      <UploadBimForm workspaceSlug={workspaceSlug} projectId={projectId} />

      {bimModels.length > 0 ? (
        <ModelsList
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          bimModels={bimModels}
          bimTakeoffs={bimTakeoffs}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-line bg-paper p-8 text-center">
      <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-ink-30 mb-3">
        {'// takeoff'}
      </div>
      <h3 className="text-lg font-black mb-2">Upload a BIM model</h3>
      <p className="text-[13px] text-ink-50 max-w-md mx-auto">
        Drop an <code className="bg-cream-2 px-1.5 py-0.5 text-[12px] font-mono">.ifc</code>{' '}
        file exported from Revit (or any BIM tool). We extract per-trade
        quantities — walls, concrete, plumbing, HVAC, electrical, doors, windows — and you
        push them straight to the Schedule of Values.
      </p>
      <div className="mt-4 text-[11px] font-mono text-ink-30">
        ⚠ Revit export: enable <strong>Export Base Quantities</strong> in the IFC dialog — without
        it, every element will show 0 quantity.
      </div>
    </div>
  );
}

function UploadBimForm({ projectId }: { workspaceSlug: string; projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ phase: 'idle' | 'uploading' | 'parsing'; pct: number; msg: string }>({
    phase: 'idle',
    pct: 0,
    msg: '',
  });
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setError('Only .ifc files are accepted (no ifczip for now).');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('File exceeds 500 MB cap.');
      return;
    }
    setProgress({ phase: 'uploading', pct: 0, msg: `Uploading ${file.name}…` });
    try {
      // Vercel Blob client-side upload — bypasses the 4.5MB function limit.
      await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: `/api/projects/${projectId}/bim`,
        contentType: file.type || 'application/octet-stream',
        onUploadProgress: ({ percentage }) => {
          setProgress((p) => ({ ...p, pct: Math.round(percentage) }));
        },
      });
      setProgress({ phase: 'parsing', pct: 100, msg: 'Parsing BIM model — big files can take a minute…' });
      // Find the BimModel we just created. The onUploadCompleted hook
      // on the server creates it. We don't have the ID, but the
      // server action runTakeoffAction accepts a BIM model ID — so
      // we need to look it up by URL. Simplest: reload the page
      // and let the list pick it up; then user clicks "Run takeoff".
      // The alternative is to query the DB for the latest model,
      // but that needs a server call we don't have. Acceptable UX:
      // show a "click here to run" prompt.
      setProgress({ phase: 'idle', pct: 0, msg: `Uploaded ${file.name} — find it in the list below and click "Run takeoff".` });
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg.slice(0, 300));
      setProgress({ phase: 'idle', pct: 0, msg: '' });
    }
  }

  return (
    <div className="border-2 border-line bg-paper p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            Upload IFC
          </div>
          <div className="text-[11px] text-ink-30 mt-0.5">
            Up to 500 MB. Direct browser → Vercel Blob, no server bottleneck.
          </div>
        </div>
      </div>
      <label
        className={
          'block border-2 border-dashed border-line p-6 text-center cursor-pointer transition-colors ' +
          (isPending ? 'pointer-events-none opacity-50' : 'hover:border-ink hover:bg-cream-2')
        }
      >
        <input
          type="file"
          accept=".ifc"
          disabled={isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <div className="text-[12px] font-extrabold uppercase tracking-[0.1em]">
          📁 Choose .ifc file
        </div>
        <div className="text-[10px] font-mono text-ink-50 mt-1">
          or drag a model here
        </div>
      </label>
      {progress.phase !== 'idle' || progress.msg ? (
        <div className="mt-3 text-[12px] font-mono">
          {progress.phase === 'uploading' ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <span>{progress.msg}</span>
                <span className="text-ink-50">{progress.pct}%</span>
              </div>
              <div className="h-1 bg-line">
                <div className="h-full bg-ink" style={{ width: `${progress.pct}%` }} />
              </div>
            </>
          ) : (
            <div className={progress.phase === 'parsing' ? 'text-orange-d' : 'text-success'}>
              {progress.msg}
            </div>
          )}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 text-[12px] text-error font-extrabold">⚠ {error}</div>
      ) : null}
    </div>
  );
}

function ModelsList({
  workspaceSlug,
  projectId,
  bimModels,
  bimTakeoffs,
}: {
  workspaceSlug: string;
  projectId: string;
  bimModels: BimModel[];
  bimTakeoffs: BimTakeoff[];
}) {
  // Newest model + its most recent takeoff first.
  const sorted = [...bimModels].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-6">
      {sorted.map((m) => {
        const takeoffs = bimTakeoffs
          .filter((t) => t.bimModelId === m.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latest = takeoffs[0];
        return (
          <div key={m.id} className="border-2 border-line bg-paper">
            <div className="px-4 py-3 border-b-2 border-line flex items-center justify-between flex-wrap gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                  BIM MODEL
                </div>
                <div className="font-extrabold text-[14px] truncate">{m.filename}</div>
                <div className="text-[10px] font-mono text-ink-30 mt-0.5">
                  {formatBytes(m.size)} · uploaded {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RunTakeoffButton
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  bimModelId={m.id}
                  disabled={latest?.status === 'RUNNING' || latest?.status === 'PENDING'}
                />
                <DeleteBimModelButton
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  bimModelId={m.id}
                  filename={m.filename}
                />
              </div>
            </div>
            {takeoffs.length === 0 ? (
              <div className="px-4 py-4 text-[12px] text-ink-30 font-mono">
                No takeoff run yet. Click &ldquo;Run takeoff&rdquo; above.
              </div>
            ) : (
              <div>
                {takeoffs.map((t) => (
                  <TakeoffRunView
                    key={t.id}
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    takeoff={t}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RunTakeoffButton({
  workspaceSlug,
  projectId,
  bimModelId,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  bimModelId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await runTakeoffAction(workspaceSlug, projectId, bimModelId);
            if (res?.error) setError(res.error);
            router.refresh();
          });
        }}
        className="px-4 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
      >
        {isPending ? 'Running…' : disabled ? 'In progress' : 'Run takeoff'}
      </button>
      {error ? <div className="text-[10px] text-error mt-1 font-mono">{error}</div> : null}
    </div>
  );
}

function DeleteBimModelButton({
  workspaceSlug,
  projectId,
  bimModelId,
  filename,
}: {
  workspaceSlug: string;
  projectId: string;
  bimModelId: string;
  filename: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${filename}"? All takeoff runs for this model will be removed. The IFC file in Vercel Blob is not deleted (separate cleanup job).`)) return;
        startTransition(async () => {
          await deleteBimModelAction(workspaceSlug, projectId, bimModelId);
          router.refresh();
        });
      }}
      className="px-3 py-2 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream disabled:opacity-50"
    >
      {isPending ? '…' : 'Delete'}
    </button>
  );
}

function TakeoffRunView({
  workspaceSlug,
  projectId,
  takeoff,
}: {
  workspaceSlug: string;
  projectId: string;
  takeoff: BimTakeoff;
}) {
  const [expanded, setExpanded] = useState(takeoff.status === 'DONE');
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-cream-2"
      >
        <div className="flex items-center gap-3">
          <StatusChip status={takeoff.status} />
          <div className="text-[11px] font-mono text-ink-50">
            {new Date(takeoff.createdAt).toLocaleString()}
            {takeoff.result ? ` · ${takeoff.result.totalElements.toLocaleString()} elements · schema ${takeoff.result.schema}` : ''}
          </div>
        </div>
        <span className="text-[12px] font-extrabold">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="border-t border-line">
          {takeoff.status === 'DONE' && takeoff.result ? (
            <TakeoffResults
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              takeoffId={takeoff.id}
              result={takeoff.result}
            />
          ) : takeoff.status === 'RUNNING' || takeoff.status === 'PENDING' ? (
            <div className="px-4 py-6 text-[12px] font-mono text-ink-50">
              ⏳ Parsing model — big files can take a minute…
            </div>
          ) : (
            <div className="px-4 py-4 text-[12px] text-error font-mono">
              ✕ {takeoff.error ?? 'Takeoff failed'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls = {
    PENDING: 'border-ink-30 text-ink-50',
    RUNNING: 'border-orange text-orange-d animate-pulse',
    DONE: 'border-success text-success',
    FAILED: 'border-error text-error',
  }[status] ?? 'border-ink-30 text-ink-50';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] border ${cls}`}>
      {status}
    </span>
  );
}

function TakeoffResults({
  workspaceSlug,
  projectId,
  takeoffId,
  result,
}: {
  workspaceSlug: string;
  projectId: string;
  takeoffId: string;
  result: TakeoffResult;
}) {
  // User-editable unit cost per item, plus selected flag.
  const [items, setItems] = useState<
    { item: TakeoffItem; selected: boolean; unitCost: string }[]
  >(() =>
    result.items.map((it) => ({
      item: it,
      selected: it.elementsMissingQuantity === 0,
      unitCost: '',
    })),
  );
  const [isPushing, startPushing] = useTransition();
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const router = useRouter();

  const totals = items.reduce(
    (acc, x) => {
      if (!x.selected) return acc;
      const c = Number(x.unitCost);
      const budget = isFinite(c) && c > 0 ? x.item.quantity * c : 0;
      acc.budget += budget;
      acc.quantity += x.item.quantity;
      acc.lines += 1;
      return acc;
    },
    { budget: 0, quantity: 0, lines: 0 },
  );

  function push() {
    setPushMessage(null);
    const lines = items
      .filter((x) => x.selected && Number(x.unitCost) > 0)
      .map((x) => ({
        csiCode: x.item.csiCode,
        trade: x.item.trade,
        budget: Number(x.unitCost) * x.item.quantity,
      }));
    if (lines.length === 0) {
      setPushMessage('Pick at least one line and enter a unit cost.');
      return;
    }
    startPushing(async () => {
      const res = await pushTakeoffToSovAction(workspaceSlug, projectId, takeoffId, lines);
      if (res?.ok) {
        const created = res.created ?? 0;
        const skipped = res.skipped ?? 0;
        setPushMessage(
          skipped > 0
            ? `Pushed ${created} line(s) to SOV. ${skipped} skipped (CSI code already exists).`
            : `Pushed ${created} line(s) to SOV.`,
        );
        router.refresh();
      } else {
        setPushMessage(res?.error ?? 'Push failed');
      }
    });
  }

  return (
    <div>
      <div className="px-4 py-2 border-b border-line bg-cream-2 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] font-mono">
          {items.length} trade groups · {result.totalElements.toLocaleString()} elements
        </div>
        <div className="text-[11px] font-mono">
          Selected: {totals.lines} · Quantity sum: {totals.quantity.toFixed(1)} ·{' '}
          <strong>Budget: ${totals.budget.toFixed(2)}</strong>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-cream">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-[0.1em]">✓</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-[0.1em]">CSI</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-[0.1em]">Trade</th>
              <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-[0.1em]">Qty</th>
              <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-[0.1em]">Unit</th>
              <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-[0.1em]">Elems</th>
              <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-[0.1em]">Unit cost $</th>
              <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-[0.1em]">Budget $</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x, i) => {
              const c = Number(x.unitCost);
              const budget = isFinite(c) && c > 0 ? x.item.quantity * c : 0;
              const missing = x.item.elementsMissingQuantity > 0;
              return (
                <tr key={`${x.item.csiCode}-${i}`} className="border-t border-line">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={x.selected}
                      onChange={(e) => {
                        setItems((prev) => prev.map((p, j) => (j === i ? { ...p, selected: e.target.checked } : p)));
                      }}
                      className="w-4 h-4 accent-orange"
                    />
                  </td>
                  <td className="px-3 py-1.5 font-mono">{x.item.csiCode}</td>
                  <td className="px-3 py-1.5">
                    {x.item.trade}
                    {missing ? (
                      <span
                        className="ml-2 text-warning text-[10px] font-extrabold uppercase tracking-[0.1em]"
                        title={`${x.item.elementsMissingQuantity} of ${x.item.elementCount} elements had no quantity data — number is low.`}
                      >
                        ⚠ {x.item.elementsMissingQuantity} missing
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{x.item.quantity.toLocaleString()}</td>
                  <td className="px-3 py-1.5 font-mono text-ink-50">{x.item.unit}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{x.item.elementCount.toLocaleString()}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={x.unitCost}
                      onChange={(e) => {
                        setItems((prev) => prev.map((p, j) => (j === i ? { ...p, unitCost: e.target.value } : p)));
                      }}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 text-right bg-paper border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold">
                    {budget > 0 ? `$${budget.toFixed(2)}` : <span className="text-ink-30">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-line flex items-center justify-between flex-wrap gap-2 bg-cream-2">
        <div className="text-[11px] font-mono text-ink-50">
          Quantities from model · prices from you · no auto-invention
        </div>
        <div className="flex items-center gap-3">
          {pushMessage ? <div className="text-[11px] font-mono">{pushMessage}</div> : null}
          <button
            type="button"
            onClick={push}
            disabled={isPushing}
            className="px-4 py-2 bg-ink text-cream border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink/90 disabled:opacity-50"
          >
            {isPushing ? 'Pushing…' : `Push ${totals.lines} line${totals.lines === 1 ? '' : 's'} to SOV`}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
