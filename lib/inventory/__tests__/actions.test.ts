import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the inventory create actions. The actions are
 * project-scoped — every Material/Equipment belongs to one
 * project — and code-unique per (workspaceId, projectId).
 * We verify the validation, the workspace/project check, the
 * duplicate-code guard, and the success path.
 */

// Clerk
const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

// Prisma
const projectFindUnique = vi.fn();
const projectFindFirst = vi.fn();
const materialFindUnique = vi.fn();
const materialCreate = vi.fn();
const equipmentFindUnique = vi.fn();
const equipmentCreate = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    project: {
      findUnique: (...a: unknown[]) => projectFindUnique(...a),
      findFirst: (...a: unknown[]) => projectFindFirst(...a),
    },
    material: {
      findUnique: (...a: unknown[]) => materialFindUnique(...a),
      create: (...a: unknown[]) => materialCreate(...a),
    },
    equipment: {
      findUnique: (...a: unknown[]) => equipmentFindUnique(...a),
      create: (...a: unknown[]) => equipmentCreate(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => transaction(cb),
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

import { createMaterialAction, createEquipmentAction } from '../actions';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'user_1' });
  // Default: project exists, no duplicate
  projectFindUnique.mockResolvedValue({ id: 'proj_1' });
  projectFindFirst.mockResolvedValue({ id: 'proj_1' });
  materialFindUnique.mockResolvedValue(null);
  materialCreate.mockResolvedValue({ id: 'mat_1' });
  equipmentFindUnique.mockResolvedValue(null);
  equipmentCreate.mockResolvedValue({ id: 'eq_1' });
});

function makeFormData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.append(k, v);
  return fd;
}

describe('createMaterialAction', () => {
  it('creates a material on the given project', async () => {
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-123',
      name: '2x4 stud, 8ft',
      unit: 'each',
      unitCost: '3.50',
      quantity: '50',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.id).toBe('mat_1');
    expect(res.kind).toBe('material');
    expect(materialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          uploaderId: 'user_1',
          code: 'UPC-123',
          name: '2x4 stud, 8ft',
          unit: 'each',
          unitCost: 3.5,
          quantity: 50,
        }),
      }),
    );
  });

  it('rejects when the project does not belong to the workspace', async () => {
    projectFindFirst.mockResolvedValue(null);
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_evil',
      code: 'X',
      name: 'X',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/project not found/i);
    expect(materialCreate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate code on the same project', async () => {
    materialFindUnique.mockResolvedValue({ id: 'mat_existing' });
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'UPC-123',
      name: 'Same code twice',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/already exists/i);
    expect(res.fieldErrors?.code).toBeTruthy();
    expect(materialCreate).not.toHaveBeenCalled();
  });

  it('rejects missing required fields', async () => {
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      // code missing
      name: 'No code',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors?.code).toBeTruthy();
  });

  it('rejects when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await createMaterialAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1', code: 'X', name: 'X',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/sign/i);
  });
});

describe('createEquipmentAction', () => {
  it('creates equipment with default condition GOOD', async () => {
    const res = await createEquipmentAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'EQ-CORDLESS-DRILL',
      name: 'Makita XPH07',
      serialNumber: 'SN-12345',
      condition: 'GOOD',
      unitCost: '199.00',
      quantity: '1',
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.kind).toBe('equipment');
    expect(equipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'EQ-CORDLESS-DRILL',
          name: 'Makita XPH07',
          serialNumber: 'SN-12345',
          condition: 'GOOD',
          unitCost: 199,
          quantity: 1,
        }),
      }),
    );
  });

  it('defaults condition to GOOD when omitted', async () => {
    const res = await createEquipmentAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'EQ-X',
      name: 'Something',
    }));
    expect(res.ok).toBe(true);
    const call = equipmentCreate.mock.calls[0][0] as { data: { condition: string } };
    expect(call.data.condition).toBe('GOOD');
  });

  it('rejects an invalid condition enum', async () => {
    const res = await createEquipmentAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'EQ-X',
      name: 'Bad condition',
      condition: 'BANANAS',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors?.condition).toBeTruthy();
  });

  it('rejects a duplicate code on the same project', async () => {
    equipmentFindUnique.mockResolvedValue({ id: 'eq_existing' });
    const res = await createEquipmentAction('my-ws', undefined, makeFormData({
      projectId: 'proj_1',
      code: 'EQ-DUP',
      name: 'Dup',
    }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/already exists/i);
  });
});
