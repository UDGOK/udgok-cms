/**
 * Regression: the onboarding form's plan field is read by the
 * createWorkspaceAction and sets plan + trialEndsAt. Without
 * this, /sign-up?plan=pro would just create a Starter workspace
 * and the trial would never start.
 *
 * The action also stores `trialEndsAt = now + 14 days` when plan
 * is PRO/ENTERPRISE.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const actions = join(process.cwd(), 'app/(app)/onboarding/actions.ts');
const form = join(process.cwd(), 'app/(app)/onboarding/OnboardingForm.tsx');
const signUpPage = join(process.cwd(), 'app/(auth)/sign-up/[[...rest]]/page.tsx');

describe('Trial onboarding flow', () => {
  it('createWorkspaceAction reads plan from formData', () => {
    const src = readFileSync(actions, 'utf-8');
    expect(src).toMatch(/formData\.get\(['"]plan['"]\)/);
  });

  it('createWorkspaceAction sets plan to PRO/ENTERPRISE for trial', () => {
    const src = readFileSync(actions, 'utf-8');
    expect(src).toMatch(/initialPlan/);
    expect(src).toMatch(/trialEndsAt/);
    expect(src).toMatch(/PRO/);
    expect(src).toMatch(/ENTERPRISE/);
  });

  it('createWorkspaceAction stamps trialEndsAt as now + 14 days', () => {
    const src = readFileSync(actions, 'utf-8');
    expect(src).toMatch(/TRIAL_DAYS/);
    expect(src).toMatch(/14/);
  });

  it('OnboardingForm passes the plan as a hidden input', () => {
    const src = readFileSync(form, 'utf-8');
    expect(src).toMatch(/<input[^>]+name="plan"/);
  });

  it('sign-up page reads ?plan=pro from searchParams', () => {
    const src = readFileSync(signUpPage, 'utf-8');
    expect(src).toMatch(/searchParams.*plan/);
    expect(src).toMatch(/plan\s*===\s*['"]pro['"]/);
  });

  it('sign-up page shows the trial copy when ?plan is set', () => {
    const src = readFileSync(signUpPage, 'utf-8');
    expect(src).toMatch(/Start your .* Pro trial/);
    expect(src).toMatch(/14 days Pro/);
  });
});
