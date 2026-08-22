// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/**
 * Tests for the public /c/[token] page.
 *
 * We mock the data layer and Clerk auth so the page
 * renders against a known fixture, then assert that:
 *   - active code → renders the project name and a
 *     "Check in" button
 *   - retired code → renders the "code retired" shell
 *   - signed-in user → renders the auto-attributed path
 *   - anonymous visitor → renders the sub-picker dropdown
 */

// Clerk — used inside the page for the signedInUser path.
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

// Prisma: only the few lookups the page actually makes.
const { codeFindUnique, subFindMany, userFindUnique } = vi.hoisted(() => ({
  codeFindUnique: vi.fn(),
  subFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    siteCheckInCode: {
      findUnique: (...a: unknown[]) => codeFindUnique(...a),
    },
    subcontractor: {
      findMany: (...a: unknown[]) => subFindMany(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
  },
}));

// The page now also calls findOpenCheckIn (for the
// signed-in path) to show the user's current state. We
// mock the helper directly so the test doesn't have to
// thread a prisma.checkInEvent mock through the deep
// import path. Default: no open event.
const { findOpenCheckInMock } = vi.hoisted(() => ({
  findOpenCheckInMock: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/checkins/queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/checkins/queries')>(
    '@/lib/checkins/queries',
  );
  return {
    ...actual,
    findOpenCheckIn: (...a: unknown[]) => findOpenCheckInMock(...a),
  };
});

// next/navigation
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// next/cache (server action revalidate calls inside the form)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// react-dom `useFormStatus` — we don't need it for the
// initial render and the form's "submit" handler is mocked
// via the toggleCheckInAction import below.
vi.mock('react-dom', () => ({
  useFormStatus: () => ({ pending: false }),
}));

// The server action — we render-only the form so we
// stub it with a noop.
const { toggleCheckInActionMock } = vi.hoisted(() => ({
  toggleCheckInActionMock: vi.fn().mockResolvedValue({ ok: true, action: 'checked_in' }),
}));
vi.mock('../actions', () => ({
  toggleCheckInAction: toggleCheckInActionMock,
}));

import PublicCheckInPage from '../page';

const baseProject = {
  id: 'proj_1',
  name: 'Smith Residence',
  code: 'SMITH-2026',
  address: '123 Main St',
  city: 'Tulsa',
  state: 'OK',
  zip: '74103',
  workspaceId: 'ws_1',
  workspace: { name: 'Acme Builders', slug: 'acme' },
};

const baseProps = {
  params: { token: 'abc123token' },
};

beforeEach(() => {
  vi.clearAllMocks();
  subFindMany.mockResolvedValue([
    { id: 'sub_1', name: 'Acme Concrete', primaryTrade: '03' },
    { id: 'sub_2', name: 'Smith Electric', primaryTrade: '26' },
  ]);
  authMock.mockResolvedValue({ userId: null });
  userFindUnique.mockResolvedValue(null);
});

// Clean up the rendered DOM between tests so each
// render(el) starts from a fresh body. Without this,
// the second test's assertions about "should NOT be
// visible" pick up elements from the first test's
// render — which is why the anonymous select was
// still found when we expected the signed-in path.
afterEach(() => {
  cleanup();
});

describe('PublicCheckInPage — active code', () => {
  it('renders the project name and a check-in button', async () => {
    codeFindUnique.mockResolvedValue({
      id: 'code_1',
      label: 'main gate',
      isActive: true,
      workspaceId: 'ws_1',
      token: 'abc123token',
      project: baseProject,
    });

    const el = await PublicCheckInPage(baseProps);
    render(el);

    // "Check in at" eyebrow + project name
    expect(screen.getByText(/check in at/i)).toBeTruthy();
    expect(screen.getByText('Smith Residence')).toBeTruthy();
    // Anonymous path with no open event → button reads
    // "Check in" (the toggle to "Check out" only appears
    // for signed-in users who already have an open event).
    expect(screen.getByRole('button', { name: /^check in$/i })).toBeTruthy();
    // The sub-picker should be visible (we're anonymous)
    expect(screen.getByLabelText(/pick your subcontractor/i)).toBeTruthy();
  });

  it('renders the auto-attributed path when signed in', async () => {
    authMock.mockResolvedValue({ userId: 'user_emp' });
    userFindUnique.mockResolvedValue({
      id: 'user_emp',
      name: 'Bob Builder',
      email: 'bob@acme.com',
    });
    codeFindUnique.mockResolvedValue({
      id: 'code_1',
      label: 'main gate',
      isActive: true,
      workspaceId: 'ws_1',
      token: 'abc123token',
      project: baseProject,
    });
    // No open event → "Check in" button (signed-in path
    // still defaults to check-in when off site).
    findOpenCheckInMock.mockResolvedValue(null);

    const el = await PublicCheckInPage(baseProps);
    render(el);

    expect(screen.getByText(/signed in as/i)).toBeTruthy();
    expect(screen.getByText('Bob Builder')).toBeTruthy();
    expect(screen.getByText('bob@acme.com')).toBeTruthy();
    // Sub-picker should NOT be visible in the signed-in path
    expect(screen.queryByLabelText(/pick your subcontractor/i)).toBeNull();
    // Button reads "Check in" when off site
    expect(screen.getByRole('button', { name: /^check in$/i })).toBeTruthy();
    // "On site" banner should NOT be present
    expect(screen.queryByText(/you.re on site/i)).toBeNull();
  });

  it('renders the on-site banner and a Check out button when the user is already on site', async () => {
    authMock.mockResolvedValue({ userId: 'user_emp' });
    userFindUnique.mockResolvedValue({
      id: 'user_emp',
      name: 'Bob Builder',
      email: 'bob@acme.com',
    });
    codeFindUnique.mockResolvedValue({
      id: 'code_1',
      label: 'main gate',
      isActive: true,
      workspaceId: 'ws_1',
      token: 'abc123token',
      project: baseProject,
    });
    // User already has an open check-in → "Check out" + banner
    findOpenCheckInMock.mockResolvedValue({
      id: 'evt_1',
      checkedInAt: new Date('2026-08-19T14:00:00Z'),
      checkedOutAt: null,
    });

    const el = await PublicCheckInPage(baseProps);
    render(el);

    // Banner: "You're on site" + since-time + "tap below to check out"
    expect(screen.getByText(/you.re on site/i)).toBeTruthy();
    // The "since" copy includes the formatted time
    expect(screen.getByText(/since/i)).toBeTruthy();
    // Button label flips to "Check out" when on site
    expect(screen.getByRole('button', { name: /^check out$/i })).toBeTruthy();
  });

  it('formats the "since X" time in the signed-in user\u2019s IANA timezone', async () => {
    // Signed-in user has America/Chicago set in their
    // settings. The check-in happened at 14:00 UTC, which
    // is 9:00 AM Chicago (CDT in August = UTC-5). The
    // server-rendered "since" label MUST show 9:00 AM (or
    // 09:00 / 9 AM, depending on the intl formatter) — not
    // 14:00 / 2 PM (UTC) which is what the server would
    // produce by default on Vercel.
    authMock.mockResolvedValue({ userId: 'user_emp' });
    userFindUnique.mockResolvedValue({
      id: 'user_emp',
      name: 'Bob Builder',
      email: 'bob@acme.com',
      timezone: 'America/Chicago',
    });
    codeFindUnique.mockResolvedValue({
      id: 'code_1',
      label: 'main gate',
      isActive: true,
      workspaceId: 'ws_1',
      token: 'abc123token',
      project: baseProject,
    });
    findOpenCheckInMock.mockResolvedValue({
      id: 'evt_1',
      checkedInAt: new Date('2026-08-19T14:00:00Z'),
      checkedOutAt: null,
    });

    const el = await PublicCheckInPage(baseProps);
    render(el);

    // The label is rendered as a text node inside the
    // "since" copy. We match 9 AM / 9:00 AM / 09:00 — the
    // exact format depends on the intl formatter for the
    // host locale, but 9 must be in the output.
    const bannerText = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(bannerText).toMatch(/9:00 AM|9 AM|09:00/);
    // And it must NOT show the UTC time (14:00 / 2 PM).
    expect(bannerText).not.toMatch(/2:00 PM/);
  });

  it('falls back to a sensible default tz when the user has no preference set', async () => {
    // User signed in but never set a timezone preference.
    // The page should still render a since-label (UTC is
    // the documented fallback) without crashing.
    authMock.mockResolvedValue({ userId: 'user_emp' });
    userFindUnique.mockResolvedValue({
      id: 'user_emp',
      name: 'Bob Builder',
      email: 'bob@acme.com',
      timezone: null,
    });
    codeFindUnique.mockResolvedValue({
      id: 'code_1',
      label: 'main gate',
      isActive: true,
      workspaceId: 'ws_1',
      token: 'abc123token',
      project: baseProject,
    });
    findOpenCheckInMock.mockResolvedValue({
      id: 'evt_1',
      checkedInAt: new Date('2026-08-19T14:00:00Z'),
      checkedOutAt: null,
    });

    const el = await PublicCheckInPage(baseProps);
    render(el);

    // Banner should still render with a time label.
    expect(screen.getByText(/you.re on site/i)).toBeTruthy();
  });
});

describe('PublicCheckInPage — retired code', () => {
  it('shows the "code retired" shell', async () => {
    codeFindUnique.mockResolvedValue({
      id: 'code_1',
      label: 'main gate',
      isActive: false,
      workspaceId: 'ws_1',
      token: 'abc123token',
      project: baseProject,
    });

    const el = await PublicCheckInPage(baseProps);
    render(el);

    // The retired shell uses <RetiredCodeShell> which
    // shows the workspace name, the "Code retired"
    // heading, and a copy block. The page never renders
    // the form, so the "Check in" button should not exist.
    expect(screen.getAllByText(/code retired/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^check in$/i })).toBeNull();
  });
});

describe('PublicCheckInPage — unknown token', () => {
  it('throws NEXT_NOT_FOUND when the code is missing', async () => {
    codeFindUnique.mockResolvedValue(null);
    await expect(PublicCheckInPage(baseProps)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
