'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toggleCheckInAction, type CheckInResult } from './actions';

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
  signedInUser: { id: string; name: string; email: string } | null;
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
}: PublicCheckInViewProps) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle');
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const formRef = useRef<HTMLFormElement | null>(null);

  // Trigger geolocation on first user interaction. We wait
  // for the click so the browser treats this as a "user
  // gesture" — otherwise most browsers block the prompt.
  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    if (geoStatus !== 'idle') return;
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => {
        setGeoStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  }

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
          onFocus={requestGeolocation}
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

          {/* Geolocation status line — visible so the user
              knows whether their location was captured. */}
          <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            Location:{' '}
            {geoStatus === 'idle' ? (
              <span>not yet requested</span>
            ) : geoStatus === 'asking' ? (
              <span className="text-ink-70">asking…</span>
            ) : geoStatus === 'granted' ? (
              <span className="text-success">✓ captured</span>
            ) : (
              <span>not shared (ok)</span>
            )}
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
  onReset,
}: {
  workspaceName: string;
  projectName: string;
  result: Extract<CheckInResult, { ok: true }>;
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
          <Row label="Time" value={new Date(result.when).toLocaleString()} />
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
