import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the Material vendor fields and the duplicate-code
 * path. The "happy path with vendor" check confirms vendor /
 * vendorPartNumber / vendorContact are persisted on create.
 * The "duplicate code triggers increment-qty" check confirms
 * that a re-scan no longer errors — it returns a structured
 * `duplicate` payload and the form can then call
 * incrementMaterialQuantityAction to bump the on-hand count.
 * The "vendor-less create" check confirms the fields are
 * genuinely optional (no schema validation crash, all three
 * columns null on the create).
 */

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

const projectFindFirst = vi.fn();
const materialFindUnique = vi.fn();
const materialCreate = vi.fn();
const materialFindFirst = vi.fn();
const materialUpdate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      findFirst: (...a: unknown[]) => projectFindFirst(...a),
    },
    material: {
      findUnique: (...a: unknown[]) => materialFindUnique(...a),
      findFirst: (...a: unknown[]) => materialFindFirst(...a),
      create: (...a: unknown[]) => materialCreate(...a),
      update: (...a: unknown[]) => materialUpdate(...a),
    },
  },
}));

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({
    userId: 'user_1', workspaceId: 'ws_1', role: 'OWNER', email: 'me@x.com', name: 'Me',
  }),
}));

vi.mock('@/lib/workspace/get-workspace', () => ({
  getWorkspace: vi.fn().mockResolvedValue({ id: 'ws_1', slug: 'my-ws', name: 'Test' }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  createMaterialAction,
  incrementMaterialQuantityAction,
} from '../actions';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'user_1' });
  projectFindFirst.mockResolvedValue({ id: 'proj_1' });
  materialFindUnique.mockResolvedValue(null);
  materialFindFirst.mockResolvedValue({
    id: 'mat_1',
    projectId: 'proj_1',
    name: '2x4 stud, 8ft',
    unit: 'each',
    quantity: { toString: () => '50' },
  });
  materialCreate.mockResolvedValue({ id: 'mat_1' });
  materialUpdate.mockResolvedValue({ id: 'mat_1' });
});

function makeFormData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.append(k, v);
  return fd;
}

describe('createMaterialAction — vendor fields', () => {
  it('persists vendor / vendorPartNumber / vendorContact on create', async () => {
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-VENDOR-1',
      name: '2x4 stud, 8ft',
      unit: 'each',
      unitCost: '3.50',
      quantity: '50',
      vendor: 'Home Depot',
      vendorPartNumber: 'HD-2X4-8',
      vendorContact: 'desk@hd.example / 555-0123',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(materialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendor: 'Home Depot',
          vendorPartNumber: 'HD-2X4-8',
          vendorContact: 'desk@hd.example / 555-0123',
        }),
      }),
    );
  });

  it('allows a vendor-less create (all three columns null)', async () => {
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-NO-VENDOR',
      name: 'Scraps',
      unit: 'each',
      quantity: '5',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(materialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendor: null,
          vendorPartNumber: null,
          vendorContact: null,
        }),
      }),
    );
  });

  it('trims empty strings to null (not blank strings in DB)', async () => {
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-BLANK-VENDOR',
      name: 'Mystery SKU',
      vendor: '',
      vendorPartNumber: '  ',
      // vendorContact is omitted entirely
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(materialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendor: null,
          vendorPartNumber: null,
          vendorContact: null,
        }),
      }),
    );
  });

  it('rejects vendor name longer than 200 chars (zod guard)', async () => {
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-X',
      name: 'X',
      vendor: 'a'.repeat(201),
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors?.vendor).toBeTruthy();
    expect(materialCreate).not.toHaveBeenCalled();
  });
});

describe('createMaterialAction — duplicate code path', () => {
  it('returns a structured duplicate payload (NOT an error) for an existing code', async () => {
    materialFindUnique.mockResolvedValue({
      id: 'mat_existing',
      name: '2x4 stud, 8ft',
      unit: 'each',
      quantity: { toString: () => '12' },
    });
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-123',
      name: 'Same code twice',
    }));
    // The old behaviour: res.ok === false with an error
    // message. The new behaviour: res.ok === false with a
    // `duplicate` payload the form turns into an inline
    // "add to quantity" UI. Either way the action returns
    // ok: false, but the user-facing experience is the
    // killer improvement.
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.duplicate).toBeDefined();
    expect(res.duplicate?.materialId).toBe('mat_existing');
    expect(res.duplicate?.name).toBe('2x4 stud, 8ft');
    expect(res.duplicate?.unit).toBe('each');
    expect(res.duplicate?.currentQuantity).toBe('12');
    expect(materialCreate).not.toHaveBeenCalled();
  });
});

describe('incrementMaterialQuantityAction', () => {
  it('adds to the on-hand count', async () => {
    const res = await incrementMaterialQuantityAction('my-ws', undefined, makeFormData({
      materialId: 'mat_1',
      addQuantity: '10',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.kind).toBe('material');
    expect(materialUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mat_1' },
        data: { quantity: { increment: 10 } },
      }),
    );
  });

  it('rejects zero or negative add quantity', async () => {
    const res = await incrementMaterialQuantityAction('my-ws', undefined, makeFormData({
      materialId: 'mat_1',
      addQuantity: '0',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/greater than zero/i);
    expect(res.fieldErrors?.addQuantity).toBeTruthy();
    expect(materialUpdate).not.toHaveBeenCalled();
  });

  it('rejects non-numeric add quantity', async () => {
    const res = await incrementMaterialQuantityAction('my-ws', undefined, makeFormData({
      materialId: 'mat_1',
      addQuantity: 'bananas',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(materialUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the material does not belong to the workspace', async () => {
    materialFindFirst.mockResolvedValue(null);
    const res = await incrementMaterialQuantityAction('my-ws', undefined, makeFormData({
      materialId: 'mat_evil',
      addQuantity: '5',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/not found/i);
    expect(materialUpdate).not.toHaveBeenCalled();
  });

  it('rejects when materialId is missing', async () => {
    const res = await incrementMaterialQuantityAction('my-ws', undefined, makeFormData({
      addQuantity: '5',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/material reference/i);
    expect(materialUpdate).not.toHaveBeenCalled();
  });

  it('rejects when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await incrementMaterialQuantityAction('my-ws', undefined, makeFormData({
      materialId: 'mat_1',
      addQuantity: '5',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/sign/i);
    expect(materialUpdate).not.toHaveBeenCalled();
  });
});
