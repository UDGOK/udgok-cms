'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toggleCheckInAction, type CheckInResult } from './actions';
import { haversineMeters, formatDistance, googleMapsUrl } from '@/lib/geo/distance';

interface PublicCheckInViewProps {
  token: string;
  project: {
    id: string;
    name: string;
    code: string | null;
    address: string | null;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
  };
  codeLabel: string;
  isActive: boolean;
  signedInUser: { id: string; name: string; email: string; timezone: string | null } | null;
  /**
   * The signed-in user's currently-open check-in on this
   * project, if any. When present, the page shows "You're
   * on site since 2:14pm" and the action button reads
   * "Check out". When null, the button reads "Check in".
   *
   * Anonymous (sub-foreman) path always gets null here
   * because the picked sub isn't known server-side. That
   * path falls back to a generic "Check in" button; a
   * second scan toggles to "Check out".
   */
  currentOpenEvent: { id: string; checkedInAt: string; checkedInAtLabel: string } | null;
  subs: { id: string; name: string; primaryTrade: string | null }[];
  /**
   * Geofence pin bound to this code. null when the admin
   * generated the code without a GPS location (the
   * "no-GPS" legacy path) — the form then proceeds without
   * any distance check.
   */
  codeGeofence: {
    lat: number;
    lng: number;
    radiusMeters: number;
    requireWithinGeofence: boolean;
  } | null;
}

/**
 * Mobile-first public check-in view. Two paths:
 *
 *   1. Signed-in workspace member → single "Check in /
 *      Check out" button. The action infers the userId
 *      from the Clerk session on the server.
 *
 *   2. Anonymous (sub foreman) → pick a subcontractor
 *      from a touch-friendly dropdown, then check in.
 *
 * Geolocation is requested on the first interaction. If
 * the user denies, we proceed without coordinates — the
 * browser's permission prompt is intentionally non-blocking.
 */
export function PublicCheckInView({
  token,
  project,
  codeLabel,
  isActive,
  signedInUser,
  currentOpenEvent,
  subs,
  codeGeofence,
}: PublicCheckInViewProps) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // 'unsupported' = no navigator.geolocation (old browser / iOS
  // permissions denied at the OS level). 'denied' = user
  // explicitly denied the prompt. 'unavailable' = browser
  // could not determine position (timeout, no satellites, etc).
  // All three end in "no coords" but the message we show the
  // user is different — "unavailable" usually means move outside
  // or wait for a GPS lock, "denied" means open settings.
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'asking' | 'granted' | 'denied' | 'unsupported' | 'unavailable'
  >('idle');
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const formRef = useRef<HTMLFormElement | null>(null);

  // Request geolocation. Triggered by the explicit "Share my
  // location" button click — a user gesture, which is what
  // the browser requires before showing the permission prompt.
  //
  // Retry-friendly: unlike the previous version, calling this
  // while the status is 'denied' / 'unavailable' will ask the
  // browser to re-prompt. (On most browsers, denying once
  // suppresses the prompt until the user re-grants via the
  // site-settings UI, but trying again doesn't hurt and lets
  // us recover from transient "unavailable" states.)
  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }
    if (geoStatus === 'asking') return;
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      (err) => {
        // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE,
        // 3 = TIMEOUT. We collapse 2 + 3 to 'unavailable' so the
        // visitor UI is a single retry path.
        setGeoStatus(err.code === 1 ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  // Live distance to the bound geofence pin. Lets the visitor
  // see "you're 47 m from the check-in point" before they tap,
  // which (a) builds trust and (b) catches the case where the
  // admin pinned the sticker to the wrong place.
  const liveDistance: number | null = (() => {
    if (!coords || !codeGeofence) return null;
    return haversineMeters(
      { lat: coords.lat, lng: coords.lng },
      { lat: codeGeofence.lat, lng: codeGeofence.lng },
    );
  })();
  const liveWithinGeofence =
    liveDistance != null && codeGeofence
      ? liveDistance <= codeGeofence.radiusMeters
      : null;

  async function handleSubmit(formData: FormData) {
    formData.set('token', token);
    if (coords) {
      formData.set('lat', String(coords.lat));
      formData.set('lng', String(coords.lng));
    }
    if (!signedInUser) {
      formData.set('subcontractorId', selectedSubId);
    }
    const res = await toggleCheckInAction(undefined, formData);
    setResult(res);
  }

  if (!isActive) {
    return <RetiredCodeShell workspaceName={project.workspaceName} />;
  }

  if (result?.ok) {
    return (
      <ResultShell
        workspaceName={project.workspaceName}
        projectName={project.name}
        result={result}
        visitorTimezone={signedInUser?.timezone ?? null}
        onReset={() => {
          setResult(null);
          setCoords(null);
          setGeoStatus('idle');
        }}
      />
    );
  }

  if (result && !result.ok) {
    // Render an error state but keep the form available.
    // The user can fix the field (e.g. pick a sub) and
    // try again without reloading the page.
  }

  return (
    <div className="min-h-screen bg-cream-2 flex flex-col">
      {/* Top bar */}
      <header className="bg-ink text-cream px-5 py-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-black text-xl">UDG<span className="text-orange">OK</span></span>
          <span className="font-mono text-[9px] tracking-[0.15em] text-cream/40 uppercase">
            {project.workspaceName}
          </span>
        </div>
        <a
          href={`https://${project.workspaceSlug}.udgok.com`}
          className="font-mono text-[9px] tracking-[0.15em] text-cream/40 uppercase hover:text-orange"
        >
          open app →
        </a>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-5 sm:p-6">
        {/* Project header */}
        <div className="bg-paper border-2 border-ink p-5 mb-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
            CHECK IN AT
          </div>
          <h1 className="text-2xl font-black mt-1 leading-tight">{project.name}</h1>
          {project.code ? (
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 mt-1">
              {project.code}
            </div>
          ) : null}
          {project.address ? (
            <div className="text-[12px] text-ink-70 mt-2">{project.address}</div>
          ) : null}
          <div className="mt-3 inline-flex items-center gap-1.5 bg-orange text-paper text-[10px] font-mono uppercase tracking-[0.12em] px-2 py-1">
            <span>at</span>
            <span className="font-extrabold">{codeLabel}</span>
          </div>
        </div>

        {/* Form body */}
        <form
          ref={formRef}
          action={handleSubmit}
          className="bg-paper border-2 border-ink p-5"
        >
          {currentOpenEvent ? (
            <div className="mb-4 bg-success/10 border-2 border-success p-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-success font-extrabold">
                ✓ You{'\u2019'}re on site
              </div>
              <div className="text-[12px] text-ink-70 mt-0.5">
                Since {currentOpenEvent.checkedInAtLabel}. Tap below to check out.
              </div>
            </div>
          ) : null}

          {signedInUser ? (
            <SignedInForm
              signedInUser={signedInUser}
              error={result && !result.ok ? result.error : null}
              currentOpenEvent={currentOpenEvent}
            />
          ) : (
            <AnonymousForm
              subs={subs}
              selectedSubId={selectedSubId}
              onChange={setSelectedSubId}
              error={result && !result.ok ? result.error : null}
            />
          )}

          {/* ─── Geolocation capture ───────────────────────────
              Explicit button (not onFocus) so the user sees a
              clear "I asked for location" moment. The browser
              only shows the permission prompt after a user
              gesture, and onFocus on a form is fragile (form
              may not be focused yet, may focus the button which
              bubbles in an order browsers differ on).

              The status line below the button gives a clear
              feedback for each state. The "Try again" path
              re-prompts by calling requestGeolocation again
              after a denial / unavailability. */}
          <div className="mt-4 pt-3 border-t border-line">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
                Location
              </div>
              {coords ? (
                <a
                  href={googleMapsUrl(coords.lat, coords.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono uppercase tracking-[0.12em] text-orange-d hover:underline"
                >
                  view on map ↗
                </a>
              ) : null}
            </div>
            <button
              type="button"
              onClick={requestGeolocation}
              disabled={geoStatus === 'asking'}
              className="mt-2 w-full min-h-[44px] bg-cream text-ink text-[12px] font-extrabold uppercase tracking-[0.1em] border-2 border-ink hover:bg-cream-2 disabled:opacity-50"
            >
              {geoStatus === 'asking'
                ? '📍 Getting your location…'
                : geoStatus === 'granted'
                ? '📍 Update location'
                : coords
                ? '📍 Re-capture location'
                : codeGeofence
                ? '📍 Share my location (required)'
                : '📍 Share my location (optional)'}
            </button>
            <div className="mt-2 text-[11px] font-mono leading-snug">
              {geoStatus === 'idle' ? (
                <span className="text-ink-50">
                  {codeGeofence
                    ? 'Required to verify you\u2019re on site. Tap the button above to allow GPS.'
                    : 'Tap the button above to attach your GPS to this check-in.'}
                </span>
              ) : geoStatus === 'asking' ? (
                <span className="text-ink-70">Asking your browser for permission…</span>
              ) : geoStatus === 'granted' && coords ? (
                <span className="text-success">
                  ✓ Captured {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  {liveDistance != null && codeGeofence ? (
                    <>
                      {' · '}
                      {liveWithinGeofence ? (
                        <span className="text-success">
                          {formatDistance(liveDistance)} from check-in point
                        </span>
                      ) : (
                        <span className="text-warning-d">
                          {formatDistance(liveDistance)} away — outside the{' '}
                          {codeGeofence.radiusMeters} m check-in zone
                        </span>
                      )}
                    </>
                  ) : null}
                </span>
              ) : geoStatus === 'denied' ? (
                <span className="text-error">
                  Permission denied. Open this site in your browser settings and allow
                  location, then tap “Try again”.
                </span>
              ) : geoStatus === 'unavailable' ? (
                <span className="text-warning-d">
                  Couldn{'\u2019'}t get a GPS fix (timeout or no signal). Move outside
                  or check your phone{'\u2019'}s location settings, then tap “Try again”.
                </span>
              ) : (
                <span className="text-ink-50">
                  Your browser doesn{'\u2019'}t support geolocation. You can still
                  check in if GPS isn{'\u2019'}t required.
                </span>
              )}
            </div>
            {geoStatus === 'denied' || geoStatus === 'unavailable' ? (
              <button
                type="button"
                onClick={requestGeolocation}
                className="mt-2 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-70 underline hover:text-ink"
              >
                ↻ Try again
              </button>
            ) : null}
          </div>
        </form>

        {/* Trust note */}
        <p className="text-[10px] font-mono text-ink-50 mt-3 leading-relaxed">
          This QR is the credential. The system trusts the phone
          that scanned it to attribute the entry. By tapping the
          button above you record your visit at this check-in
          point.
        </p>
        {/*
          For the anonymous (sub-foreman) path, the server
          doesn't know which sub the visitor is going to pick
          yet, so we can't pre-resolve their current state.
          The button defaults to "Check in" and a re-scan
          (back to this URL) flips to "Check out" — the
          action's toggle logic handles the rest.
        */}
        {!signedInUser ? (
          <p className="text-[10px] font-mono text-ink-50 mt-2 leading-relaxed">
            Tip: if you{'\u2019'}re already on site, scan the same QR
            again to check out.
          </p>
        ) : null}
      </main>
    </div>
  );
}

function SignedInForm({
  signedInUser,
  error,
  currentOpenEvent,
}: {
  signedInUser: { id: string; name: string; email: string };
  error: string | null;
  currentOpenEvent: { checkedInAtLabel: string } | null;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
        SIGNED IN AS
      </div>
      <div className="font-extrabold text-lg mt-0.5">{signedInUser.name}</div>
      <div className="text-[11px] text-ink-70">{signedInUser.email}</div>

      {error ? (
        <div className="mt-3 text-[12px] bg-error/10 border-2 border-error text-error px-3 py-2 font-mono">
          {error}
        </div>
      ) : null}

      <SubmitButton currentOpenEvent={currentOpenEvent} />
    </div>
  );
}

function AnonymousForm({
  subs,
  selectedSubId,
  onChange,
  error,
}: {
  subs: { id: string; name: string; primaryTrade: string | null }[];
  selectedSubId: string;
  onChange: (id: string) => void;
  error: string | null;
}) {
  return (
    <div>
      <label
        htmlFor="subcontractorId"
        className="block text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50"
      >
        PICK YOUR SUBCONTRACTOR
      </label>
      <select
        id="subcontractorId"
        name="subcontractorId"
        value={selectedSubId}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1.5 w-full min-h-[48px] text-base border-2 border-ink bg-cream px-3 py-2"
      >
        <option value="">— Choose your company —</option>
        {subs.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.primaryTrade ? ` (${s.primaryTrade})` : ''}
          </option>
        ))}
      </select>
      {subs.length === 0 ? (
        <p className="mt-2 text-[11px] text-ink-50">
          No subcontractors on file for this workspace yet. Ask
          the admin to add your company in the CMS first.
        </p>
      ) : null}

      <label
        htmlFor="note"
        className="block text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50 mt-4"
      >
        NOTE (optional)
      </label>
      <input
        id="note"
        name="note"
        type="text"
        maxLength={500}
        placeholder="e.g. delivering tile, rough-in inspection"
        className="mt-1.5 w-full min-h-[48px] text-base border-2 border-ink bg-cream px-3 py-2"
      />

      {error ? (
        <div className="mt-3 text-[12px] bg-error/10 border-2 border-error text-error px-3 py-2 font-mono">
          {error}
        </div>
      ) : null}

      <SubmitButton disabled={subs.length === 0} />
    </div>
  );
}

/**
 * Banner shown above the form when the signed-in user
 * already has an open check-in on this project. Makes the
 * current state obvious so the user doesn't tap "Check
 * in" by mistake when they should be checking out. The
 * banner also tells them which check-in point they came
 * in through (e.g. "Main entrance" / "Shop door") so
 * context isn't lost.
 */

function SubmitButton({ disabled = false, currentOpenEvent = null }: { disabled?: boolean; currentOpenEvent?: { checkedInAtLabel: string } | null }) {
  // useFormStatus reads the parent <form>'s pending state
  // and disables the button while the action runs.
  const { pending } = useFormStatus();
  // Toggle the label based on current state. "Check in"
  // when the user is off site, "Check out" when they're
  // already on site. For the anonymous path
  // (currentOpenEvent=null) we default to "Check in" —
  // the second scan toggles to check out.
  const actionLabel = currentOpenEvent ? 'Check out' : 'Check in';
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-5 w-full min-h-[56px] bg-orange text-paper border-2 border-orange hover:bg-orange-d disabled:opacity-50 text-base font-extrabold uppercase tracking-[0.12em]"
    >
      {pending ? 'Recording…' : actionLabel}
    </button>
  );
}

function RetiredCodeShell({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="min-h-screen bg-cream-2 flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-paper border-2 border-ink p-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
          {workspaceName}
        </div>
        <h1 className="text-2xl font-black mt-1">Code retired</h1>
        <p className="text-[12px] text-ink-70 mt-3 leading-relaxed">
          This check-in code is no longer active. Ask the
          site admin for the new sticker, or scan a
          different check-in point on site.
        </p>
        <div className="mt-5 inline-block bg-ink text-cream text-[10px] font-mono uppercase tracking-[0.12em] px-2 py-1">
          Code retired
        </div>
      </div>
    </div>
  );
}

function ResultShell({
  workspaceName,
  projectName,
  result,
  visitorTimezone,
  onReset,
}: {
  workspaceName: string;
  projectName: string;
  result: Extract<CheckInResult, { ok: true }>;
  /**
   * IANA timezone from the signed-in user's settings. null
   * for the anonymous sub path (we don't know the visitor's
   * tz). When null, we fall back to the browser's local
   * timezone — the visitor's phone clock — which is the
   * closest thing to "their local time" we have.
   */
  visitorTimezone: string | null;
  onReset: () => void;
}) {
  const isCheckIn = result.action === 'checked_in';
  // Show the visitor how far they were from the bound
  // location — confirms "yes the system knows I'm here"
  // and warns if they were on the edge.
  const distance = result.geofenceDistanceMeters;
  const radius = result.geofenceRadiusMeters;
  const ok = result.geofenceOk;
  const showDistance = distance != null && radius != null;
  // Format the timestamp in the visitor's IANA timezone when
  // we know it; otherwise let the browser pick the local tz.
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(visitorTimezone ? { timeZone: visitorTimezone } : {}),
  }).format(new Date(result.when));
  return (
    <div className="min-h-screen bg-cream-2 flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-paper border-2 border-ink p-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-50">
          {workspaceName}
        </div>
        <h1 className="text-2xl font-black mt-1">
          {isCheckIn ? 'You\u2019re checked in' : 'You\u2019re checked out'}
        </h1>
        <div className="mt-4 space-y-2">
          <Row label="Project" value={projectName} />
          <Row label="Who" value={result.whoName} />
          <Row label="Time" value={timeLabel} />
          {showDistance ? (
            <Row
              label="Distance"
              value={
                ok === false
                  ? `${distance} m · outside ${radius} m`
                  : `${distance} m · within ${radius} m`
              }
            />
          ) : null}
        </div>
        {ok === false && isCheckIn ? (
          <div className="mt-4 bg-warning/15 border-2 border-warning p-3 text-[12px] text-ink leading-snug">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-warning-d font-extrabold mb-1">
              ⚠ Out of geofence
            </div>
            You{'\u2019'}re {distance} m from this check-in point. The
            site administrator has been notified. If you{'\u2019'}re
            actually on site, ask the admin to check the GPS
            location bound to this sticker.
          </div>
        ) : null}
        <p className="text-[11px] text-ink-70 mt-4 leading-relaxed">
          {isCheckIn
            ? 'You\u2019re on the clock. Scan the same QR again when you leave to check out.'
            : 'You\u2019re off the clock. Safe travels.'}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-5 w-full min-h-[48px] bg-ink text-cream border-2 border-ink hover:bg-orange hover:border-orange text-[11px] font-extrabold uppercase tracking-[0.12em]"
        >
          Scan again
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-line pb-1.5">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 w-16 shrink-0">
        {label}
      </div>
      <div className="text-[13px] font-extrabold flex-1 break-words">{value}</div>
    </div>
  );
}
