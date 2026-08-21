/**
 * updateTaskAction — unit tests.
 *
 * Tests the validation + tenant-scoping of the edit flow.
 * The task board's "Edit" button calls this with the form
 * data; the action updates the row and revalidates the
 * tasks page.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockWorkspaceFindUnique = vi.fn();
const mockTaskFindFirst = vi.fn();
const mockTaskUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: {
      findUnique: (...args: unknown[]) => mockWorkspaceFindUnique(...args),
    },
    task: {
      findFirst: (...args: unknown[]) => mockTaskFindFirst(...args),
      update: (...args: unknown[]) => mockTaskUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { auth } from '@clerk/nextjs/server';
import { updateTaskAction } from '../actions';

beforeEach(() => {
  mockWorkspaceFindUnique.mockReset();
  mockTaskFindFirst.mockReset();
  mockTaskUpdate.mockReset();
  mockRevalidatePath.mockReset();
  vi.mocked(auth).mockResolvedValue({ userId: 'user_test' } as never);
  mockWorkspaceFindUnique.mockResolvedValue({ id: 'ws_1' });
  mockTaskFindFirst.mockResolvedValue({ id: 'task_1', createdById: 'user_test' });
  mockTaskUpdate.mockResolvedValue({});
});

const SAMPLE = {
  taskId: 'task_1',
  title: 'Updated title',
  description: 'Updated desc',
  priority: 'HIGH',
  dueDate: '2026-09-01',
  assigneeId: 'user_2',
  projectId: 'proj_1',
  clientId: 'client_1',
};

function makeFormData(payload: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(payload)) fd.set(k, v);
  return fd;
}

describe('updateTaskAction', () => {
  it('refuses when not signed in', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const res = await updateTaskAction('ws_1', undefined, makeFormData(SAMPLE));
    expect(res?.error).toMatch(/Not signed in/);
  });

  it('refuses when workspace is not found', async () => {
    mockWorkspaceFindUnique.mockResolvedValueOnce(null);
    const res = await updateTaskAction('ws_1', undefined, makeFormData(SAMPLE));
    expect(res?.error).toMatch(/Workspace not found/);
  });

  it('rejects empty title', async () => {
    const res = await updateTaskAction('ws_1', undefined, makeFormData({ ...SAMPLE, title: '' }));
    expect(res?.error).toBeTruthy();
    expect(res?.fieldErrors?.title).toBeTruthy();
  });

  it('rejects too-long title', async () => {
    const res = await updateTaskAction(
      'ws_1',
      undefined,
      makeFormData({ ...SAMPLE, title: 'x'.repeat(201) }),
    );
    expect(res?.fieldErrors?.title).toBeTruthy();
  });

  it('rejects when task is not in the workspace (tenant scope)', async () => {
    mockTaskFindFirst.mockResolvedValueOnce(null);
    const res = await updateTaskAction('ws_1', undefined, makeFormData(SAMPLE));
    expect(res?.error).toMatch(/Task not found/);
  });

  it('updates the task and revalidates the tasks page on success', async () => {
    const res = await updateTaskAction('ws_1', undefined, makeFormData(SAMPLE));
    expect(res?.ok).toBe(true);
    expect(mockTaskUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockTaskUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: {
        title: string;
        description: string | null;
        priority: string;
        dueDate: Date | null;
        assigneeId: string | null;
        projectId: string | null;
        clientId: string | null;
      };
    };
    expect(updateArg.where.id).toBe('task_1');
    expect(updateArg.data.title).toBe('Updated title');
    expect(updateArg.data.description).toBe('Updated desc');
    expect(updateArg.data.priority).toBe('HIGH');
    expect(updateArg.data.dueDate).toBeInstanceOf(Date);
    expect(updateArg.data.assigneeId).toBe('user_2');
    expect(updateArg.data.projectId).toBe('proj_1');
    expect(updateArg.data.clientId).toBe('client_1');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/w/ws_1/tasks');
  });

  it('converts empty dueDate to null', async () => {
    const res = await updateTaskAction(
      'ws_1',
      undefined,
      makeFormData({ ...SAMPLE, dueDate: '' }),
    );
    expect(res?.ok).toBe(true);
    const updateArg = mockTaskUpdate.mock.calls[0]?.[0] as {
      data: { dueDate: null };
    };
    expect(updateArg.data.dueDate).toBe(null);
  });
});
