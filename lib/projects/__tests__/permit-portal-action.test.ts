import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * updateProjectDetailsAction — tests for the per-project
 * permit portal override (permitPortalUrl / permitPortalLabel
 * / permitPortalNotes).
 *
 * We focus on validation + DB write. The geocode path is
 * skipped by leaving the address fields blank so shouldGeocode
 * stays false. Tested in isolation from the geocoding tests.
 */

const authMock = vi.fn();
const projectFindFirst = vi.fn();
const projectUpdate = vi.fn();
const geocodeFn = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      findFirst: (...args: unknown[]) => projectFindFirst(...args),
      update: (...args: unknown[]) => projectUpdate(...args),
    },
  },
}));

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({
    userId: 'user_1',
    workspaceId: 'ws_1',
    role: 'OWNER',
  }),
}));

vi.mock('@/lib/workspace/get-workspace', () => ({
  getWorkspace: vi.fn().mockImplementation(async (slug: string) => {
    if (slug === 'my-ws') return { id: 'ws_1', slug: 'my-ws' };
    return null;
  }),
}));

vi.mock('@/lib/projects/geocode', () => ({
  geocodeProjectAddress: (...args: unknown[]) => geocodeFn(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { updateProjectDetailsAction } from '../actions';

beforeEach(() => {
  authMock.mockReset();
  projectFindFirst.mockReset();
  projectUpdate.mockReset();
  geocodeFn.mockReset();
  authMock.mockResolvedValue({ userId: 'user_1' });
  projectFindFirst.mockResolvedValue({
    id: 'proj_1',
    workspaceId: 'ws_1',
    address: null,
    city: 'Bixby',
    state: 'OK',
    zip: '74008',
  });
  projectUpdate.mockResolvedValue({});
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const MINIMAL_BODY = {
  // All address fields blank → shouldGeocode=false, no
  // geocodeProjectAddress call. Lets us isolate the portal
  // field path from the geocode path.
  address: '',
  city: 'Bixby',
  state: 'OK',
  zip: '74008',
  description: '',
  startDate: '',
  endDate: '',
  contractValue: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: '',
};

describe('updateProjectDetailsAction — permit portal override', () => {
  it('persists permitPortalUrl + label + notes to the project', async () => {
    const result = await updateProjectDetailsAction(
      'my-ws',
      'proj_1',
      undefined,
      fd({
        ...MINIMAL_BODY,
        permitPortalUrl: 'https://web.mygov.us/authentication/login/?loginas=applicant&city_id=182',
        permitPortalLabel: 'MyGov (Bixby) — applicant login',
        permitPortalNotes: 'Yuba uses this link to apply.',
      }),
    );
    expect(result?.ok).toBe(true);
    expect(projectUpdate).toHaveBeenCalledTimes(1);
    const arg = projectUpdate.mock.calls[0]?.[0] as {
      data: {
        permitPortalUrl: string;
        permitPortalLabel: string;
        permitPortalNotes: string;
      };
    };
    expect(arg.data.permitPortalUrl).toContain('city_id=182');
    expect(arg.data.permitPortalLabel).toBe('MyGov (Bixby) — applicant login');
    expect(arg.data.permitPortalNotes).toBe('Yuba uses this link to apply.');
  });

  it('persists empty strings as null (so city default takes over)', async () => {
    await updateProjectDetailsAction(
      'my-ws',
      'proj_1',
      undefined,
      fd({
        ...MINIMAL_BODY,
        permitPortalUrl: '',
        permitPortalLabel: '',
        permitPortalNotes: '',
      }),
    );
    const arg = projectUpdate.mock.calls[0]?.[0] as {
      data: {
        permitPortalUrl: null;
        permitPortalLabel: null;
        permitPortalNotes: null;
      };
    };
    expect(arg.data.permitPortalUrl).toBeNull();
    expect(arg.data.permitPortalLabel).toBeNull();
    expect(arg.data.permitPortalNotes).toBeNull();
  });

  it('rejects permitPortalUrl that does not start with http(s)://', async () => {
    const result = await updateProjectDetailsAction(
      'my-ws',
      'proj_1',
      undefined,
      fd({
        ...MINIMAL_BODY,
        permitPortalUrl: 'web.mygov.us/foo',
      }),
    );
    expect(result?.fieldErrors?.permitPortalUrl).toBeTruthy();
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('accepts http:// and https://', async () => {
    for (const proto of ['http://example.com/x', 'https://example.com/x']) {
      projectUpdate.mockClear();
      const result = await updateProjectDetailsAction(
        'my-ws',
        'proj_1',
        undefined,
        fd({ ...MINIMAL_BODY, permitPortalUrl: proto }),
      );
      expect(result?.ok).toBe(true);
      const arg = projectUpdate.mock.calls[0]?.[0] as {
        data: { permitPortalUrl: string };
      };
      expect(arg.data.permitPortalUrl).toBe(proto);
    }
  });

  it('rejects permitPortalUrl over 2048 chars', async () => {
    const result = await updateProjectDetailsAction(
      'my-ws',
      'proj_1',
      undefined,
      fd({
        ...MINIMAL_BODY,
        permitPortalUrl: 'https://example.com/' + 'a'.repeat(2100),
      }),
    );
    expect(result?.fieldErrors?.permitPortalUrl).toBeTruthy();
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('rejects permitPortalLabel over 200 chars', async () => {
    const result = await updateProjectDetailsAction(
      'my-ws',
      'proj_1',
      undefined,
      fd({
        ...MINIMAL_BODY,
        permitPortalLabel: 'L'.repeat(201),
      }),
    );
    expect(result?.fieldErrors?.permitPortalLabel).toBeTruthy();
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('rejects permitPortalNotes over 2000 chars', async () => {
    const result = await updateProjectDetailsAction(
      'my-ws',
      'proj_1',
      undefined,
      fd({
        ...MINIMAL_BODY,
        permitPortalNotes: 'N'.repeat(2001),
      }),
    );
    expect(result?.fieldErrors?.permitPortalNotes).toBeTruthy();
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});
