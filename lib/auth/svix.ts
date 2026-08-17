import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/nextjs/server';

/**
 * Verify a Clerk webhook request using Svix signature headers.
 * Throws if verification fails.
 *
 * Required headers (set by Svix, Clerk's webhook provider):
 *  - svix-id
 *  - svix-timestamp
 *  - svix-signature
 */
export function verifyClerkWebhook(req: Request): WebhookEvent {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set');
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix signature headers');
  }

  // Svix requires the raw body, not parsed JSON.
  // The handler is responsible for reading the body once and passing the
  // raw string to this function.
  throw new Error(
    'verifyClerkWebhook must be called with the raw body — use verifyClerkWebhookBody instead',
  );
}

/**
 * Verify a Clerk webhook request using a raw body string.
 */
export function verifyClerkWebhookBody(rawBody: string, headers: Headers): WebhookEvent {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set');
  }

  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix signature headers');
  }

  const wh = new Webhook(secret);
  const event = wh.verify(rawBody, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as WebhookEvent;

  return event;
}
