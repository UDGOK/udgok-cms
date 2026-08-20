/**
 * Zod schemas shared between the notification
 * server actions and the API routes. Split out so
 * the route file (which only uses some) doesn't
 * pull in the action-only schemas.
 */

import { z } from '@/lib/validation';

export const markReadSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
});
