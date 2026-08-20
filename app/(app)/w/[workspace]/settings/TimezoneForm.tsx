'use client';

/**
 * TimezoneForm — settings page widget for picking
 * the user's display timezone. Submits via the
 * updateUserSettingsAction server action.
 *
 * The list is a curated set of common US + a few
 * international zones. The full IANA list has 400+
 * entries; the curated subset covers 99% of UDGOK
 * users. The list is sourced from lib/timezone.ts
 * so the public /e/[token] view + the topbar use the
 * same canonical labels.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserSettingsAction } from '@/lib/auth/user-settings';
import { COMMON_TIMEZONES } from '@/lib/timezone';

export function TimezoneForm({
  currentTimezone,
}: {
  currentTimezone: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState(
    currentTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('timezone', value);
    startTransition(async () => {
      const res = await updateUserSettingsAction(undefined, fd);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        // Force a refresh so all server-rendered
        // dates re-render in the new timezone.
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 max-w-md">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50">
        Timezone
      </div>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 px-3 py-2 bg-cream border border-line text-[13px] text-ink focus:outline-none focus:border-ink"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-ink text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="text-[10px] font-mono text-ink-50">
        Current: <span className="text-ink-70">{value}</span> ·{' '}
        {new Date().toLocaleTimeString('en-US', {
          timeZone: value,
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })}
      </div>
      {error ? (
        <div className="text-[11px] text-error font-mono bg-error/10 border border-error px-2 py-1.5">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="text-[11px] text-success font-mono bg-success/10 border border-success px-2 py-1.5">
          Saved. Dates throughout the app now render in {value}.
        </div>
      ) : null}
    </form>
  );
}
