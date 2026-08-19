/**
 * Regression tests for the project-photo update action.
 *
 * The update action handles three concerns:
 *   1. Authorization — uploader or workspace OWNER/ADMIN only.
 *   2. Metadata edits — caption, room, area, phase, folderId.
 *   3. Image replacement — when a file is provided, upload to
 *      Vercel Blob, swap the URL, delete the old blob.
 *
 * The first two are testable without a real Vercel Blob (we
 * mock the prisma client). The third is a passthrough to
 * `@vercel/blob`'s `put` + `del`, which we don't unit-test
 * here — that's covered by integration / Vercel logs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();
const mockMembershipFindUnique = vi.fn();
const mockPhotoFindUnique = vi.fn();
const mockPhotoFolderFindUnique = vi.fn();
const mockPhotoUpdate = vi.fn();
const mockWorkspaceFindUnique = vi.fn();
const mockLogActivity = vi.fn();
const mockBlobPut = vi.fn();
const mockBlobDel = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    workspace: { findUnique: (...args: unknown[]) => mockWorkspaceFindUnique(...args) },
    membership: { findUnique: (...args: unknown[]) => mockMembershipFindUnique(...args) },
    projectPhoto: {
      findUnique: (...args: unknown[]) => mockPhotoFindUnique(...args),
      update: (...args: unknown[]) => mockPhotoUpdate(...args),
    },
    projectPhotoFolder: { findUnique: (...args: unknown[]) => mockPhotoFolderFindUnique(...args) },
  },
}));

vi.mock('@/lib/activity/log', () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

vi.mock('@/lib/monitoring', () => ({
  captureError: () => undefined,
  captureWarning: () => undefined,
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
}));

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockBlobPut(...args),
  del: (...args: unknown[]) => mockBlobDel(...args),
}));

import { updateProjectPhotoAction } from '../actions';

const USER_ID = 'user_test_123';
const WORKSPACE_ID = 'ws_test';
const PROJECT_ID = 'proj_test';
const PHOTO_ID = 'photo_test';
const FOLDER_ID = 'folder_test';

function makeFormData(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.set(k, v);
  }
  return fd;
}

describe('updateProjectPhotoAction — authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockWorkspaceFindUnique.mockResolvedValue({ id: WORKSPACE_ID, slug: 'udgok' });
    mockPhotoFindUnique.mockResolvedValue({
      id: PHOTO_ID,
      projectId: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      uploaderId: 'other_user',
      url: 'https://blob.example/old.jpg',
      filename: 'old.jpg',
      project: { id: PROJECT_ID, workspaceId: WORKSPACE_ID },
    });
  });

  it('rejects an unauthenticated user', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'New name' });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toEqual({ error: 'Not signed in' });
  });

  it('rejects a non-uploader who is not OWNER/ADMIN', async () => {
    mockMembershipFindUnique.mockResolvedValueOnce({ role: 'FIELD' });
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'New name' });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toEqual({ error: 'You can only edit your own photos' });
  });

  it('allows the original uploader even if not an admin', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'other_user' });
    mockPhotoUpdate.mockResolvedValueOnce({
      id: PHOTO_ID,
      caption: 'Renamed',
      url: 'https://blob.example/old.jpg',
      filename: 'old.jpg',
    });
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'Renamed' });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toEqual({
      ok: true,
      photo: { id: PHOTO_ID, caption: 'Renamed', url: 'https://blob.example/old.jpg', filename: 'old.jpg' },
    });
  });

  it('allows a workspace OWNER to edit any photo', async () => {
    mockMembershipFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    mockPhotoUpdate.mockResolvedValueOnce({
      id: PHOTO_ID,
      caption: 'Admin rename',
      url: 'https://blob.example/old.jpg',
      filename: 'old.jpg',
    });
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'Admin rename' });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toMatchObject({ ok: true });
  });
});

describe('updateProjectPhotoAction — metadata edits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockWorkspaceFindUnique.mockResolvedValue({ id: WORKSPACE_ID, slug: 'udgok' });
    mockPhotoFindUnique.mockResolvedValue({
      id: PHOTO_ID,
      projectId: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      uploaderId: USER_ID,
      url: 'https://blob.example/photo.jpg',
      filename: 'IMG_4340.jpeg',
      project: { id: PROJECT_ID, workspaceId: WORKSPACE_ID },
    });
    mockPhotoUpdate.mockResolvedValue({
      id: PHOTO_ID,
      caption: 'Master Bath Rough-In',
      url: 'https://blob.example/photo.jpg',
      filename: 'IMG_4340.jpeg',
    });
  });

  it('only updates fields the caller sent (presence-based)', async () => {
    // Only send caption — phase, room, area, folderId should
    // NOT be touched. We assert this by checking the update
    // call's `data` argument.
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'Master Bath Rough-In' });
    await updateProjectPhotoAction('udgok', undefined, fd);
    expect(mockPhotoUpdate).toHaveBeenCalledTimes(1);
    const data = mockPhotoUpdate.mock.calls[0][0].data;
    expect(data).toEqual({ caption: 'Master Bath Rough-In' });
    // Should NOT have any of these keys since they weren't sent.
    expect(data).not.toHaveProperty('phase');
    expect(data).not.toHaveProperty('room');
    expect(data).not.toHaveProperty('area');
    expect(data).not.toHaveProperty('folderId');
    expect(data).not.toHaveProperty('url');
  });

  it('clears the caption when the caller sends an empty string', async () => {
    const fd = makeFormData({ photoId: PHOTO_ID, caption: '' });
    await updateProjectPhotoAction('udgok', undefined, fd);
    const data = mockPhotoUpdate.mock.calls[0][0].data;
    expect(data.caption).toBeNull();
  });

  it('clears the folder by sending an empty folderId', async () => {
    const fd = makeFormData({ photoId: PHOTO_ID, folderId: '' });
    await updateProjectPhotoAction('udgok', undefined, fd);
    const data = mockPhotoUpdate.mock.calls[0][0].data;
    expect(data.folderId).toBeNull();
  });

  it('rejects an invalid folder (wrong project)', async () => {
    mockPhotoFolderFindUnique.mockResolvedValueOnce({
      id: FOLDER_ID,
      projectId: 'other_project',
    });
    const fd = makeFormData({ photoId: PHOTO_ID, folderId: FOLDER_ID });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toEqual({ error: 'Invalid folder' });
  });

  it('logs an activity entry on every successful edit', async () => {
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'New' });
    await updateProjectPhotoAction('udgok', undefined, fd);
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity.mock.calls[0][0]).toMatchObject({
      action: 'updated',
      entityType: 'project',
      entityId: PROJECT_ID,
    });
  });
});

describe('updateProjectPhotoAction — image replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockWorkspaceFindUnique.mockResolvedValue({ id: WORKSPACE_ID, slug: 'udgok' });
    mockPhotoFindUnique.mockResolvedValue({
      id: PHOTO_ID,
      projectId: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      uploaderId: USER_ID,
      url: 'https://blob.example/old.jpg',
      filename: 'old.jpg',
      project: { id: PROJECT_ID, workspaceId: WORKSPACE_ID },
    });
    mockBlobPut.mockResolvedValue({
      url: 'https://blob.example/new.jpg',
      downloadUrl: 'https://blob.example/new.jpg',
    });
    mockPhotoUpdate.mockResolvedValue({
      id: PHOTO_ID,
      caption: 'Same caption',
      url: 'https://blob.example/new.jpg',
      filename: 'new.jpg',
    });
  });

  it('uploads a new file and swaps the URL', async () => {
    const newFile = new File(['fake-image-bytes'], 'new.jpg', { type: 'image/jpeg' });
    const fd = makeFormData({
      photoId: PHOTO_ID,
      caption: 'Same caption',
      file: newFile,
    });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(mockBlobPut).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      ok: true,
      photo: { url: 'https://blob.example/new.jpg', filename: 'new.jpg' },
    });
    const data = mockPhotoUpdate.mock.calls[0][0].data;
    expect(data.url).toBe('https://blob.example/new.jpg');
    expect(data.filename).toBe('new.jpg');
  });

  it('deletes the old blob after a successful replace', async () => {
    const newFile = new File(['fake-image-bytes'], 'new.jpg', { type: 'image/jpeg' });
    const fd = makeFormData({ photoId: PHOTO_ID, file: newFile });
    await updateProjectPhotoAction('udgok', undefined, fd);
    expect(mockBlobDel).toHaveBeenCalledWith('https://blob.example/old.jpg');
  });

  it('rejects a non-image replacement file', async () => {
    const badFile = new File(['not an image'], 'evil.exe', { type: 'application/octet-stream' });
    const fd = makeFormData({ photoId: PHOTO_ID, file: badFile });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toEqual({ error: 'Replacement file must be an image' });
    expect(mockBlobPut).not.toHaveBeenCalled();
  });

  it('rejects a replacement file over 50 MB', async () => {
    // 51 MB of zeros.
    const huge = new File([new Uint8Array(51 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    const fd = makeFormData({ photoId: PHOTO_ID, file: huge });
    const res = await updateProjectPhotoAction('udgok', undefined, fd);
    expect(res).toMatchObject({ error: expect.stringMatching(/too large/i) });
  });

  it('does NOT call blob del if no file was provided (metadata-only edit)', async () => {
    const fd = makeFormData({ photoId: PHOTO_ID, caption: 'New name' });
    await updateProjectPhotoAction('udgok', undefined, fd);
    expect(mockBlobPut).not.toHaveBeenCalled();
    expect(mockBlobDel).not.toHaveBeenCalled();
  });
});
