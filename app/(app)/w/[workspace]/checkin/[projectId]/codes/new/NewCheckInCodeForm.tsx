'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import type { GenerateCodeState } from '@/lib/checkins/actions';
import { googleMapsUrl } from '@/lib/geo/distance';

interface NewCheckInCodeFormProps {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  existingLabels: string[];
  /**
   * Project's mailing address, shown under the GPS
   * section as a sanity check ("the address says
   * Tulsa, but the GPS says OKC — something's off").
   */
  projectAddress: string | null;
  action: (
    workspaceSlug: string,
    _prev: GenerateCodeState | undefined,
    formData: FormData,
  ) => Promise<GenerateCodeState>;
}

/**
 * Form for generating a new check-in code. The big
 * new thing (Aug 2026) is the GPS binding section:
 *
 *   - "Use my current location" button — captures the
 *     admin's phone GPS via navigator.geolocation. The
 *     browser prompts on click (must be a user gesture).
 *   - Manual lat/lng fallback — paste a Google Maps URL
 *     or decimal coords if the admin is at the office.
 *   - Geofence radius + hard-enforcement toggle.
 *
 * The legacy "no GPS" flow still works: leave the GPS
 * fields blank and the code is generated without a
 * bound location. Visitors with a phone that has GPS
 * still record their position; visitors without simply
 * skip the geofence check.
 */
export function NewCheckInCodeForm({
  workspaceSlug,
  projectId,
  projectName,
  existingLabels,
  projectAddress,
  action,
}: NewCheckInCodeFormProps) {
  const [state, setState] = useState<GenerateCodeState | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    if (geoStatus === 'asking' || geoStatus === 'granted') return;
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => {
        setGeoStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  function clearCoords() {
    setCoords(null);
    setManualLat('');
    setManualLng('');
    setGeoStatus('idle');
  }

  function handleSubmit(formData: FormData) {
    // The form's hidden lat/lng inputs read from either the
    // browser-GPS coords state OR the manual input. The
    // server action accepts either; both empty is allowed
    // (legacy "no GPS" flow).
    if (coords) {
      formData.set('lat', String(coords.lat));
      formData.set('lng', String(coords.lng));
    } else {
      formData.set('lat', manualLat.trim());
      formData.set('lng', manualLng.trim());
    }
    startTransition(async () => {
      const res = await action(workspaceSlug, state ?? undefined, formData);
      setState(res);
      if (res.ok) {
        router.push(`/w/${workspaceSlug}/checkin/${projectId}`);
      }
    });
  }

  // The current effective coords (for the "captured at"
  // readout). Manual input overrides browser GPS if both
  // are set — the manual value wins because the user
  // typed it last.
  const effectiveLat = coords ? coords.lat : manualLat.trim() ? Number(manualLat) : null;
  const effectiveLng = coords ? coords.lng : manualLng.trim() ? Number(manualLng) : null;
  const hasBoth = effectiveLat != null && effectiveLng != null && Number.isFinite(effectiveLat) && Number.isFinite(effectiveLng);

  return (
    <form
      action={handleSubmit}
      className="bg-paper border-2 border-ink p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />

      {/* ─── Label ──────────────────────────────────────── */}
      <label
        htmlFor="label"
        className="block text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50"
      >
        Label
      </label>
      <input
        id="label"
        name="label"
        type="text"
        required
        maxLength={80}
        placeholder="e.g. main gate, shop door, north laydown"
        className="mt-1.5 w-full text-base border-2 border-ink bg-cream px-3 py-2.5"
        autoFocus
      />
      <p className="mt-2 text-[11px] text-ink-70">
        Friendly name for the check-in point. Shown on the
        printed sticker and in the admin list.
      </p>

      {existingLabels.length > 0 ? (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1.5">
            EXISTING LABELS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {existingLabels.map((l) => (
              <span
                key={l}
                className="text-[10px] font-mono uppercase tracking-[0.12em] bg-cream-2 border border-line px-2 py-0.5"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* ─── GPS binding ────────────────────────────────── */}
      <div className="mt-6 pt-5 border-t-2 border-line">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
              {'// GPS binding'}
            </div>
            <div className="text-[15px] font-extrabold mt-0.5">
              Where will this sticker live?
            </div>
          </div>
          {hasBoth ? (
            <a
              href={googleMapsUrl(effectiveLat!, effectiveLng!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d hover:underline"
            >
              view on map ↗
            </a>
          ) : null}
        </div>
        <p className="text-[12px] text-ink-70 mt-1.5 leading-relaxed">
          Pin the sticker to a GPS location so visitors can only
          check in when they{'\u2019'}re physically on site. The
          phone GPS is compared to this pin with a Haversine
          distance. If the admin{'\u2019'}s at the office, paste
          coords manually below.
        </p>

        {/* "Use my location" button — the easy path */}
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={requestGeolocation}
            disabled={geoStatus === 'asking'}
            className="px-3 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange disabled:opacity-50"
          >
            {geoStatus === 'asking'
              ? 'Asking…'
              : coords
              ? 'Re-capture location'
              : '📍 Use my current location'}
          </button>
          {coords ? (
            <button
              type="button"
              onClick={clearCoords}
              className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink underline"
            >
              clear
            </button>
          ) : null}
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {geoStatus === 'granted' ? (
              <span className="text-success">✓ captured</span>
            ) : geoStatus === 'denied' ? (
              <span>not shared — enter manually</span>
            ) : geoStatus === 'asking' ? (
              <span className="text-ink-70">…</span>
            ) : (
              <span>not yet captured</span>
            )}
          </div>
        </div>

        {/* Manual lat/lng — fallback + override */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
              Latitude
            </div>
            <input
              type="number"
              step="0.0000001"
              min={-90}
              max={90}
              value={coords ? coords.lat.toFixed(6) : manualLat}
              onChange={(e) => {
                setManualLat(e.target.value);
                setCoords(null); // any manual edit invalidates the GPS capture
              }}
              placeholder="36.1540"
              className="w-full px-2 py-2 text-[13px] font-mono border-2 border-line bg-cream focus:border-ink focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
              Longitude
            </div>
            <input
              type="number"
              step="0.0000001"
              min={-180}
              max={180}
              value={coords ? coords.lng.toFixed(6) : manualLng}
              onChange={(e) => {
                setManualLng(e.target.value);
                setCoords(null);
              }}
              placeholder="-95.9928"
              className="w-full px-2 py-2 text-[13px] font-mono border-2 border-line bg-cream focus:border-ink focus:outline-none"
            />
          </label>
        </div>

        {/* Project address for sanity-check */}
        {projectAddress ? (
          <div className="mt-2 text-[10px] font-mono text-ink-50">
            Project address (sanity check): <span className="text-ink-70">{projectAddress}</span>
          </div>
        ) : null}

        {/* Geofence radius + hard-enforce */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mb-1">
              Geofence radius (meters)
            </div>
            <input
              type="number"
              name="geofenceMeters"
              min={0}
              max={5000}
              defaultValue={150}
              className="w-full px-2 py-2 text-[13px] font-mono border-2 border-line bg-cream focus:border-ink focus:outline-none"
            />
            <div className="text-[10px] text-ink-50 mt-1 font-mono">
              0 = no check · 150m covers a typical site + parking
            </div>
          </label>
          <label className="flex items-start gap-2 pt-6">
            <input
              type="checkbox"
              name="requireWithinGeofence"
              className="mt-1 w-4 h-4 border-2 border-ink"
            />
            <div>
              <div className="text-[12px] font-extrabold">Hard-enforce</div>
              <div className="text-[11px] text-ink-70 mt-0.5 leading-snug">
                Reject scans outside the radius. Without this,
                the check-in succeeds and gets flagged as
                {`"out of area"`} in the admin list.
              </div>
            </div>
          </label>
        </div>
      </div>

      {state && !state.ok ? (
        <div className="mt-4 text-[12px] bg-error/10 border-2 border-error text-error px-3 py-2 font-mono">
          {state.error}
          {state.fieldErrors?.label ? (
            <div className="mt-1 text-[11px]">→ {state.fieldErrors.label}</div>
          ) : null}
          {state.fieldErrors?.lat ? (
            <div className="mt-1 text-[11px]">→ {state.fieldErrors.lat}</div>
          ) : null}
          {state.fieldErrors?.lng ? (
            <div className="mt-1 text-[11px]">→ {state.fieldErrors.lng}</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex gap-2 flex-wrap items-center">
        <SubmitButton pending={pending} />
        <Link
          href={`/w/${workspaceSlug}/checkin/${projectId}`}
          className="px-4 py-2.5 bg-paper text-ink text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-cream-2"
        >
          Cancel
        </Link>
        <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          For project: {projectName}
        </div>
      </div>
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  // We also use useFormStatus for the pending state
  // when the form submits (e.g. if the user double-
  // clicks). The parent tracks its own pending too,
  // but useFormStatus is the source of truth for
  // "the form is in flight".
  const { pending: formPending } = useFormStatus();
  const isPending = pending || formPending;
  return (
    <button
      type="submit"
      disabled={isPending}
      className="px-4 py-2.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-orange hover:bg-orange-d disabled:opacity-50"
    >
      {isPending ? 'Generating…' : 'Generate QR code'}
    </button>
  );
}
