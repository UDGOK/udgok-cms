/**
 * updateContactAction — tenant-scoped update of an existing
 * vendor contact. Validates the name/email/phone/role/
 * isPrimary fields and handles the "isPrimary demotion":
 * if you tick primary, all other primary contacts for the
 * same vendor are unset first.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockContactFindFirst = vi.fn();
const mockContactUpdate = vi.fn();
const mockContactUpdateMany = vi.fn();
const mockAssertRole = vi.fn();

vi.mock('@/lib/procurement/auth', () => ({
  assertRole: (...args: unknown[]) => mockAssertRole(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    vendorContact: {
      findFirst: (...args: unknown[]) => mockContactFindFirst(...args),
      update: (...args: unknown[]) => mockContactUpdate(...args),
      updateMany: (...args: unknown[]) => mockContactUpdateMany(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { updateContactAction } from '../actions';

beforeEach(() => {
  mockContactFindFirst.mockReset();
  mockContactUpdate.mockReset();
  mockContactUpdateMany.mockReset();
  mockAssertRole.mockReset();
  mockAssertRole.mockResolvedValue(undefined);
  mockContactFindFirst.mockResolvedValue({ id: 'c_1', vendorId: 'v_1' });
  mockContactUpdate.mockResolvedValue({});
  mockContactUpdateMany.mockResolvedValue({ count: 0 });
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe('updateContactAction', () => {
  it('rejects when the role check fails', async () => {
    mockAssertRole.mockRejectedValueOnce(new Error('Forbidden'));
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1', name: 'X', email: 'x@y.com',
    }));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Forbidden');
  });

  it('rejects when the contact is not in this workspace', async () => {
    mockContactFindFirst.mockResolvedValueOnce(null);
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1', name: 'X', email: 'x@y.com',
    }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Contact not found/);
    expect(mockContactUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the email is invalid', async () => {
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1', name: 'X', email: 'not-an-email',
    }));
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.email).toBeTruthy();
  });

  it('rejects when the name is empty', async () => {
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1', name: '', email: 'x@y.com',
    }));
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.name).toBeTruthy();
  });

  it('updates the contact on success', async () => {
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1',
      name: 'Sara Smith',
      email: 'sara@locke.com',
      phone: '918-555-0100',
      role: 'Estimator',
    }));
    expect(res.ok).toBe(true);
    expect(mockContactUpdate).toHaveBeenCalledTimes(1);
    const arg = mockContactUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { name: string; email: string; phone: string; role: string; isPrimary: boolean };
    };
    expect(arg.where.id).toBe('c_1');
    expect(arg.data.name).toBe('Sara Smith');
    expect(arg.data.email).toBe('sara@locke.com');
    expect(arg.data.phone).toBe('918-555-0100');
    expect(arg.data.role).toBe('Estimator');
    expect(arg.data.isPrimary).toBe(false);
  });

  it('demotes other primary contacts when isPrimary is checked', async () => {
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1',
      name: 'Sara',
      email: 'sara@x.com',
      isPrimary: 'on',
    }));
    expect(res.ok).toBe(true);
    // Must have called updateMany to unset other primaries
    expect(mockContactUpdateMany).toHaveBeenCalledTimes(1);
    const demoteArg = mockContactUpdateMany.mock.calls[0]?.[0] as {
      where: { vendorId: string; workspaceId: string; id: { not: string } };
      data: { isPrimary: boolean };
    };
    expect(demoteArg.where.vendorId).toBe('v_1');
    expect(demoteArg.where.workspaceId).toBe('ws_1');
    expect(demoteArg.where.id.not).toBe('c_1');
    expect(demoteArg.data.isPrimary).toBe(false);
  });

  it('skips the demotion step when isPrimary is unchecked', async () => {
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1', name: 'X', email: 'x@y.com',
    }));
    expect(res.ok).toBe(true);
    expect(mockContactUpdateMany).not.toHaveBeenCalled();
  });

  it('clears phone/role to null when empty', async () => {
    const res = await updateContactAction('ws_1', undefined, fd({
      contactId: 'c_1', name: 'X', email: 'x@y.com', phone: '', role: '',
    }));
    expect(res.ok).toBe(true);
    const arg = mockContactUpdate.mock.calls[0]?.[0] as {
      data: { phone: null; role: null };
    };
    expect(arg.data.phone).toBe(null);
    expect(arg.data.role).toBe(null);
  });
});
