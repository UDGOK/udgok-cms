/**
 * Regression: the Clerk webhook on user.created must also notify the
 * platform owner. Earlier this was missing — the webhook just synced
 * the user record and the owner never knew a new signup happened.
 *
 * This test guards the wiring, not the email side-effect (which is
 * best-effort and best tested in production).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const webhook = join(process.cwd(), 'app/api/webhooks/clerk/route.ts');

describe('Clerk webhook — owner alert on signup', () => {
  it('imports sendNewSignupAlert', () => {
    const src = readFileSync(webhook, 'utf-8');
    expect(src).toContain("sendNewSignupAlert");
  });

  it('calls sendNewSignupAlert on user.created', () => {
    const src = readFileSync(webhook, 'utf-8');
    // Find the user.created case block and confirm it fires the alert
    const block = src.match(/case 'user\.created':[\s\S]{0,1500}/);
    expect(block).not.toBeNull();
    expect(block![0]).toContain('sendNewSignupAlert');
  });

  it('failure of the alert does not fail the webhook (try/catch)', () => {
    const src = readFileSync(webhook, 'utf-8');
    const block = src.match(/case 'user\.created':[\s\S]{0,2000}/);
    expect(block).not.toBeNull();
    // The alert call must be wrapped in try/catch so a Resend outage
    // doesn't break the webhook and cause Clerk to retry forever.
    expect(block![0]).toMatch(/try\s*\{/);
    expect(block![0]).toMatch(/catch/);
  });
});
