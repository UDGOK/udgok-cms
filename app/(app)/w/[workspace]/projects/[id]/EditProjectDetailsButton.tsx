'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { updateProjectDetailsAction } from '@/lib/projects/actions';

interface EditProjectDetailsButtonProps {
  workspaceSlug: string;
  projectId: string;
  initial: {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    description: string | null;
    startDate: Date | null;
    endDate: Date | null;
    contractValue: number | null;
    status: string;
    latitude: number | null;
    longitude: number | null;
    geocodeSource: string | null;
    permitPortalUrl: string | null;
    permitPortalLabel: string | null;
    permitPortalNotes: string | null;
  };
}

export function EditProjectDetailsButton({
  workspaceSlug,
  projectId,
  initial,
}: EditProjectDetailsButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    (prev: unknown, formData: FormData) => updateProjectDetailsAction(workspaceSlug, projectId, prev as never, formData),
    undefined,
  );

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-d hover:underline"
      >
        ✎ Edit details
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-ink w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="px-5 py-4 border-b-2 border-ink flex items-center justify-between sticky top-0 bg-paper z-10">
          <h2 className="font-black text-lg">Edit project details</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 -mr-1 flex items-center justify-center text-ink hover:bg-cream-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form action={formAction} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={initial.description ?? ''}
              maxLength={4000}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
              Street address
            </label>
            <input
              type="text"
              name="address"
              defaultValue={initial.address ?? ''}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                defaultValue={initial.city ?? ''}
                maxLength={120}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                defaultValue={initial.state ?? ''}
                maxLength={40}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                ZIP
              </label>
              <input
                type="text"
                name="zip"
                defaultValue={initial.zip ?? ''}
                maxLength={20}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
          </div>

          {/* Location pin — manual override */}
          <div className="border-2 border-dashed border-ink bg-cream-2 p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              📍 Site location
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  name="latitude"
                  step="0.000001"
                  min="-90"
                  max="90"
                  defaultValue={initial.latitude ?? ''}
                  placeholder="29.7604"
                  className="w-full px-2 py-2 bg-paper border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  name="longitude"
                  step="0.000001"
                  min="-180"
                  max="180"
                  defaultValue={initial.longitude ?? ''}
                  placeholder="-95.3698"
                  className="w-full px-2 py-2 bg-paper border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
                />
              </div>
            </div>
            <p className="text-[10px] text-ink-50">
              {initial.geocodeSource === 'manual' ? (
                <>📌 Manually pinned. Edits above won&apos;t auto-regeocode. Hit &ldquo;Re-geocode&rdquo; on the project page to clear.</>
              ) : initial.geocodeSource === 'nominatim' ? (
                <>🌍 Auto-geocoded. Save with new lat/lng to pin manually, or change the address above to re-geocode.</>
              ) : (
                <>Save with both lat/lng filled to pin manually. Otherwise the address above is auto-geocoded.</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Start date
              </label>
              <input
                type="date"
                name="startDate"
                defaultValue={initial.startDate ? initial.startDate.toISOString().slice(0, 10) : ''}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                End date
              </label>
              <input
                type="date"
                name="endDate"
                defaultValue={initial.endDate ? initial.endDate.toISOString().slice(0, 10) : ''}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Contract value ($)
              </label>
              <input
                type="number"
                name="contractValue"
                step="0.01"
                min="0"
                defaultValue={initial.contractValue ?? ''}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={initial.status}
                className="w-full px-3 py-2.5 bg-cream border-2 border-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-orange"
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Permit portal override. Optional — leave empty
              to use the matched city's default. Use this when:
                - the city isn't in the directory yet
                - the project is in a sub-jurisdiction (county, MUD, etc.)
                - the user wants a custom deep link to a specific
                  permit application. */}
          <div className="border-2 border-dashed border-ink bg-cream-2 p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              🏛 Permit portal link
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Custom portal URL
              </label>
              <input
                type="url"
                name="permitPortalUrl"
                defaultValue={initial.permitPortalUrl ?? ''}
                placeholder="https://web.mygov.us/..."
                maxLength={2048}
                className="w-full px-3 py-2 bg-paper border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Button label (optional)
              </label>
              <input
                type="text"
                name="permitPortalLabel"
                defaultValue={initial.permitPortalLabel ?? ''}
                placeholder="MyGov (Bixby) — applicant login"
                maxLength={200}
                className="w-full px-3 py-2 bg-paper border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                Notes (optional)
              </label>
              <textarea
                name="permitPortalNotes"
                defaultValue={initial.permitPortalNotes ?? ''}
                rows={2}
                maxLength={2000}
                placeholder="e.g. login as contractor — see yuba for applicant login"
                className="w-full px-3 py-2 bg-paper border border-line text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            <p className="text-[10px] text-ink-50">
              Leave empty to use the matched city&apos;s default portal (e.g. MyGov for Bixby). When set, this project shows a <b>custom link</b> badge on the Permit Office card.
            </p>
          </div>

          {'error' in (state ?? {}) && state?.error ? (
            <div className="text-[12px] text-error font-extrabold">{state.error}</div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <SubmitButton />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-ink hover:text-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}
