'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMaterialAction,
  createEquipmentAction,
  incrementMaterialQuantityAction,
  type DuplicateMaterialPayload,
} from '@/lib/inventory/actions';

export interface ProjectOption {
  id: string;
  name: string;
  code: string | null;
}

export interface CreateInventoryFromScanProps {
  workspaceSlug: string;
  scannedCode: string;
  projects: ProjectOption[];
  /**
   * Optional pre-fill values. Used by the product-catalog flow:
   * if we found a product in UPCitemdb / the local cache, the
   * scan page passes its name + description + vendor here so
   * the user doesn't have to retype what we already know.
   *
   * `unitCost` is a hint only — we don't auto-fill the cost
   * field (a foreman might be logging a delivery at a
   * different price than the cached one). Instead we show a
   * "Use this price" one-tap button next to the unit cost
   * input.
   */
  prefilled?: {
    name?: string;
    description?: string;
    vendor?: string;
    vendorPartNumber?: string;
    vendorContact?: string;
    /** Cached unit cost, shown as a hint, not auto-filled. */
    unitCost?: string | null;
  };
  /**
   * Which tab (material/equipment) the form should start on.
   * The InventoryTab's "+ Material" and "+ Equipment" buttons
   * pass this so the user doesn't have to click the toggle.
   */
  initialKind?: 'material' | 'equipment';
  /**
   * The project that should be pre-selected in the dropdown.
   * Comes from the "?projectId=…" search param the InventoryTab
   * adds so the user adds the inventory to the right project
   * without scrolling through the list.
   */
  initialProjectId?: string;
}

type FormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; kind: 'material' | 'equipment'; id: string }
  | { status: 'duplicate'; payload: DuplicateMaterialPayload }
  | { status: 'incremented'; materialId: string; name: string; add: number; unit: string };

/**
 * Shown on the scan page when a code is "not found". The user
 * picks a project, picks material vs equipment, fills in the
 * basics (including vendor info captured at scan time), and we
 * create the row. The code is locked in (it came from the
 * scan, no point letting the user mistype it).
 *
 * Why a single component for both material and equipment?
 *  - The fields are 90% the same (code, name, project, cost).
 *  - A toggle for "material / equipment" lets us add
 *    equipment-specific fields (serialNumber, condition) only
 *    when needed, without two near-duplicate forms.
 *  - The user sees one decision: "what kind of thing is this?"
 *
 * Duplicate handling: when a create fails because the
 * (projectId, code) pair already exists, the action returns
 * a structured `duplicate` payload. We turn it into an inline
 * "Add ___ to quantity" form so the foreman can bump the
 * on-hand count without re-typing anything.
 *
 * Implementation note: we call the server action directly via
 * useTransition instead of useFormState. useFormState + bound
 * actions + the project's zod-based error shape gets gnarly
 * with TypeScript; the manual form approach is just as clean
 * and a third the code.
 */
export function CreateInventoryFromScan({
  workspaceSlug,
  scannedCode,
  projects,
  prefilled,
  initialKind,
  initialProjectId,
}: CreateInventoryFromScanProps) {
  const router = useRouter();
  const [kind, setKind] = useState<'material' | 'equipment'>(initialKind ?? 'material');
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  // Pre-select the project the user came from. Falls back to
  // the first active project if the hinted one isn't in the
  // list (could happen if the project became completed/cancelled
  // between the link render and the form render).
  const initialProject = initialProjectId && projects.some((p) => p.id === initialProjectId)
    ? initialProjectId
    : projects[0]?.id ?? '';

  function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    setState({ status: 'idle' });
    startTransition(async () => {
      const res =
        kind === 'material'
          ? await createMaterialAction(workspaceSlug, undefined, fd)
          : await createEquipmentAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        setState({ status: 'ok', kind: res.kind, id: res.id });
        // Refresh server data so the project's INVENTORY tab
        // (if the user navigates there) shows the new row.
        router.refresh();
      } else if (res.duplicate) {
        // Server told us the code is already on this project.
        // Show the inline "add to quantity" form instead of
        // an error.
        setState({ status: 'duplicate', payload: res.duplicate });
      } else {
        setState({ status: 'error', message: res.error });
      }
    });
  }

  function onIncrementSubmit(form: HTMLFormElement) {
    if (state.status !== 'duplicate') return;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await incrementMaterialQuantityAction(workspaceSlug, undefined, fd);
      if (res.ok) {
        const add = Number(fd.get('addQuantity') ?? 0);
        setState({
          status: 'incremented',
          materialId: state.payload.materialId,
          name: state.payload.name,
          add,
          unit: state.payload.unit,
        });
        router.refresh();
      } else {
        setState({ status: 'error', message: res.error });
      }
    });
  }

  // Success state after a fresh create.
  if (state.status === 'ok') {
    return (
      <div className="bg-success/10 border border-success p-3 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success font-extrabold mb-1">
          ✓ Created
        </div>
        <p className="text-ink-70">
          Added to the project&apos;s inventory. The new {state.kind} shows up in
          the project&apos;s INVENTORY tab.
        </p>
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline"
        >
          Add another →
        </button>
      </div>
    );
  }

  // Success state after incrementing quantity on a duplicate.
  if (state.status === 'incremented') {
    return (
      <div className="bg-success/10 border border-success p-3 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success font-extrabold mb-1">
          ✓ Added to quantity
        </div>
        <p className="text-ink-70">
          Added {state.add} {state.unit} of <strong>{state.name}</strong> to
          the project&apos;s inventory. The on-hand count is updated in the
          project&apos;s INVENTORY tab.
        </p>
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-orange-d hover:underline"
        >
          Scan another →
        </button>
      </div>
    );
  }

  // Duplicate state: render the inline "add to quantity" form
  // in place of the regular create form. The user doesn't have
  // to retype anything.
  if (state.status === 'duplicate') {
    return (
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-warn mb-2">
          {'// Already on this project'}
        </div>
        <div className="bg-paper border-2 border-warn p-4">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono">
            <span className="uppercase tracking-[0.1em] text-ink-50">code</span>
            <span className="px-2 py-0.5 bg-cream-2 border border-line font-mono">
              {scannedCode}
            </span>
          </div>
          <p className="text-[12px] text-ink-70 mb-3">
            <strong className="text-ink">{state.payload.name}</strong> is
            already on this project with{' '}
            <strong className="text-ink">
              {state.payload.currentQuantity} {state.payload.unit}
            </strong>{' '}
            on hand. How many came in on this delivery?
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onIncrementSubmit(e.currentTarget);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="materialId" value={state.payload.materialId} />
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Add {state.payload.unit} to quantity
              </label>
              <input
                name="addQuantity"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue="1"
                className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full px-4 py-2.5 bg-orange text-paper text-[12px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors disabled:opacity-50"
            >
              {pending ? '⟳ Adding…' : `+ Add to ${state.payload.name}`}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            className="mt-3 w-full text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-50 hover:text-orange-d"
          >
            ← Back to create form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
        {'// Create from this code'}
      </div>
      <div className="bg-paper border-2 border-line p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-mono">
          <span className="uppercase tracking-[0.1em] text-ink-50">code</span>
          <span className="px-2 py-0.5 bg-cream-2 border border-line font-mono">
            {scannedCode}
          </span>
        </div>

        {/* Kind toggle — material vs equipment */}
        <div className="flex gap-1 mb-3">
          {(['material', 'equipment'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] border-2 ${
                kind === k
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink-50 border-line hover:border-ink'
              }`}
            >
              {k === 'material' ? '🧱 Material' : '🔧 Equipment'}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e.currentTarget);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="code" value={scannedCode} />

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Project
            </label>
            <select
              name="projectId"
              required
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
              defaultValue={initialProject}
            >
              {projects.length === 0 ? (
                <option value="" disabled>
                  No active projects — create one first
                </option>
              ) : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} · ` : ''}
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              {kind === 'material' ? 'Material name' : 'Equipment name'}
            </label>
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={prefilled?.name ?? ''}
              placeholder={kind === 'material' ? 'e.g. 2x4 stud, 8ft' : 'e.g. Cordless drill, Makita XPH07'}
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              maxLength={2000}
              rows={2}
              defaultValue={prefilled?.description ?? ''}
              placeholder="What is this product? (auto-filled from product catalog when available)"
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[12px]"
            />
          </div>

          {kind === 'equipment' ? (
            <div className="grid grid-cols-2 gap-2" key="equipment-fields">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Serial #
                </label>
                <input
                  name="serialNumber"
                  maxLength={200}
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Condition
                </label>
                <select
                  name="condition"
                  defaultValue="GOOD"
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
                >
                  <option value="NEW">New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2" key="material-fields">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Unit
                </label>
                <input
                  name="unit"
                  defaultValue="each"
                  maxLength={40}
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Qty on hand
                </label>
                <input
                  name="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                />
              </div>
            </div>
          )}

          {/* Vendor section — only for materials, since the
           *  task explicitly scopes vendor capture to the
           *  material flow. Equipment vendors are captured
           *  via a separate "purchasedFrom" path. */}
          {kind === 'material' ? (
            <div className="border-t border-line pt-3 space-y-3" key="vendor-fields">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Vendor (optional)
                </label>
                <input
                  name="vendor"
                  maxLength={200}
                  defaultValue={prefilled?.vendor ?? ''}
                  placeholder="e.g. Home Depot, Acme Lumber Co."
                  className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                    Vendor part #
                  </label>
                  <input
                    name="vendorPartNumber"
                    maxLength={200}
                    defaultValue={prefilled?.vendorPartNumber ?? ''}
                    placeholder="their SKU"
                    className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                    Vendor contact
                  </label>
                  <input
                    name="vendorContact"
                    maxLength={500}
                    defaultValue={prefilled?.vendorContact ?? ''}
                    placeholder="phone / email / name"
                    className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px]"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Unit cost (optional)
            </label>
            <input
              name="unitCost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
            />
            {/* Cached-price hint. Shows only when the product
             *  lookup surfaced a price. We don't auto-fill the
             *  cost field because the foreman might be logging
             *  a delivery at a different price than the cached
             *  one. The "Use this price" button is a one-tap
             *  fill — no math, no typing. */}
            {prefilled?.unitCost ? <UsePriceHint price={prefilled.unitCost} /> : null}
          </div>

          {kind === 'equipment' ? (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Quantity
              </label>
              <input
                name="quantity"
                type="number"
                min="0"
                defaultValue="1"
                className="w-full px-2 py-1.5 border-2 border-ink bg-cream-2 text-[13px] font-mono"
              />
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div className="bg-error/10 border border-error px-3 py-2 text-[12px] text-error">
              {state.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full px-4 py-2.5 bg-orange text-paper text-[12px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d transition-colors disabled:opacity-50"
          >
            {pending
              ? '⟳ Creating…'
              : kind === 'material'
              ? '+ Add to material inventory'
              : '+ Add to equipment inventory'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Inline "use this price" hint. Renders below the unit cost
 * input when the catalog lookup has a price. One click fills
 * the input — no retyping, no math. We bind via
 * querySelector (instead of a controlled input + useState)
 * to keep this server-renderable-friendly and avoid a
 * round-trip just to toggle a button.
 */
function UsePriceHint({ price }: { price: string }) {
  function applyPrice() {
    const input = document.querySelector<HTMLInputElement>('input[name="unitCost"]');
    if (input) {
      input.value = price;
      input.focus();
    }
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-ink-50">
      <span>
        Cached price: <span className="text-ink">${price}</span>
      </span>
      <button
        type="button"
        onClick={applyPrice}
        className="px-2 py-0.5 border border-orange-d text-orange-d font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d hover:text-paper"
      >
        Use this price
      </button>
    </div>
  );
}
