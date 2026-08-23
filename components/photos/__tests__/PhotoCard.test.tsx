// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * Smoke tests for the extracted PhotoCard. The component is
 * presentational — the parent (ProjectPhotosClient) owns the
 * state and passes handlers as props. We verify the click +
 * menu + rename-edit entry points all call the right handlers.
 */

import { PhotoCard } from '../PhotoCard';
import type { ProjectPhotoListItem } from '@/lib/photos/queries';

const basePhoto: ProjectPhotoListItem = {
  id: 'p1',
  caption: 'Test photo',
  filename: 'test.jpg',
  url: 'https://example.com/test.jpg',
  phase: 'ROUGH_IN',
  folderId: null,
  folderName: null,
  folderColor: null,
  room: null,
  area: null,
  latitude: null,
  longitude: null,
  takenAt: null,
  uploaderId: 'u1',
  uploader: {
    id: 'u1',
    name: 'Yasir',
    email: 'yasir@udgok.com',
    avatarUrl: null,
  },
  createdAt: new Date('2026-08-22T14:00:00Z'),
};

const noop = () => {};
// onApplyEdit takes (id, patch) — most tests don't care about
// the args, so use vi.fn() which ESLint won't flag for unused
// parameters (it doesn't read function arg names).
const noopEdit = vi.fn();

describe('PhotoCard', () => {
  beforeEach(() => {
    // jsdom doesn't auto-cleanup between tests — the two-img
    // match in the onClick test was caused by the previous
    // render still being in the document.
    cleanup();
  });
  afterEach(() => cleanup());

  it('renders the caption, filename, and phase badge', () => {
    render(
      <PhotoCard
        photo={basePhoto}
        onClick={noop}
        canEdit
        isEditing={false}
        onStartRename={noop}
        onCancelRename={noop}
        onSavedRename={noop}
        onApplyEdit={noopEdit}
        menuOpen={false}
        onToggleMenu={noop}
        onMenuDelete={noop}
        onMenuEdit={noop}
        workspaceSlug="udgok"
      />,
    );
    expect(screen.getByText('Test photo')).toBeTruthy();
    expect(screen.getByText('test.jpg')).toBeTruthy();
    expect(screen.getByText('Rough-in')).toBeTruthy();
  });

  it('calls onClick when the image area is tapped', () => {
    const onClick = vi.fn();
    render(
      <PhotoCard
        photo={basePhoto}
        onClick={onClick}
        canEdit={false}
        isEditing={false}
        onStartRename={noop}
        onCancelRename={noop}
        onSavedRename={noop}
        onApplyEdit={noopEdit}
        menuOpen={false}
        onToggleMenu={noop}
        onMenuDelete={noop}
        onMenuEdit={noop}
        workspaceSlug="udgok"
      />,
    );
    fireEvent.click(screen.getByAltText('Test photo'));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows the action menu only when canEdit', () => {
    const { rerender } = render(
      <PhotoCard
        photo={basePhoto}
        onClick={noop}
        canEdit={false}
        isEditing={false}
        onStartRename={noop}
        onCancelRename={noop}
        onSavedRename={noop}
        onApplyEdit={noopEdit}
        menuOpen={false}
        onToggleMenu={noop}
        onMenuDelete={noop}
        onMenuEdit={noop}
        workspaceSlug="udgok"
      />,
    );
    expect(screen.queryByLabelText('Photo actions')).toBeNull();

    rerender(
      <PhotoCard
        photo={basePhoto}
        onClick={noop}
        canEdit
        isEditing={false}
        onStartRename={noop}
        onCancelRename={noop}
        onSavedRename={noop}
        onApplyEdit={noopEdit}
        menuOpen={false}
        onToggleMenu={noop}
        onMenuDelete={noop}
        onMenuEdit={noop}
        workspaceSlug="udgok"
      />,
    );
    expect(screen.getByLabelText('Photo actions')).toBeTruthy();
  });

  it('fires onMenuDelete when the menu Delete is tapped', () => {
    const onMenuDelete = vi.fn();
    render(
      <PhotoCard
        photo={basePhoto}
        onClick={noop}
        canEdit
        isEditing={false}
        onStartRename={noop}
        onCancelRename={noop}
        onSavedRename={noop}
        onApplyEdit={noopEdit}
        menuOpen
        onToggleMenu={noop}
        onMenuDelete={onMenuDelete}
        onMenuEdit={noop}
        workspaceSlug="udgok"
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onMenuDelete).toHaveBeenCalled();
  });

  it('fires onStartRename when the "?" button is tapped on an untitled photo', () => {
    const onStartRename = vi.fn();
    render(
      <PhotoCard
        photo={{ ...basePhoto, caption: null }}
        onClick={noop}
        canEdit
        isEditing={false}
        onStartRename={onStartRename}
        onCancelRename={noop}
        onSavedRename={noop}
        onApplyEdit={noopEdit}
        menuOpen={false}
        onToggleMenu={noop}
        onMenuDelete={noop}
        onMenuEdit={noop}
        workspaceSlug="udgok"
      />,
    );
    fireEvent.click(screen.getByLabelText('Name this photo'));
    expect(onStartRename).toHaveBeenCalled();
  });
});
