'use server';

/**
 * User settings — currently just timezone, but
 * the action is shaped to grow (notification
 * preferences, theme, etc.).
 */

import { revalidatePath } from 'next/cache';
import { z } from '@/lib/validation';
import { prisma } from '@/lib/db/client';
import { COMMON_TIMEZONES } from '@/lib/timezone';

const updateSchema = z.object({
  timezone: z.string().refine(
    (tz) => COMMON_TIMEZONES.some((c) => c.value === tz),
    { message: 'Pick a timezone from the list' },
  ),
});

export type UpdateSettingsResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateUserSettingsAction(
  _prev: UpdateSettingsResult | undefined,
  formData: FormData,
): Promise<UpdateSettingsResult> {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const parsed = updateSchema.safeParse({
    timezone: (formData.get('timezone') as string | null)?.trim(),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Invalid timezone', fieldErrors };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { timezone: parsed.data.timezone },
  });

  // Revalidate the entire app layout so any
  // server-rendered dates pick up the new tz
  // on the next request. The hook in the
  // topbar and the timesheet cells re-render
  // because they read user.timezone on each
  // request.
  revalidatePath('/w/[workspace]', 'layout');
  return { ok: true };
}
