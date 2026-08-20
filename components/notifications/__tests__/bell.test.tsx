// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// =====================================================================
// NotificationBell — render & interaction tests
//
// We mock fetch (the hook hits /api/notifications on
// mount and on a 30/60s poll). Tests focus on the
// contract the user sees: the bell renders with a
// count, click opens the panel, "mark all read" /
// dismiss work optimistically, the compose modal
// opens for pushers.
// =====================================================================

// Router stub — used by the row click handler to
// navigate to the notification's link.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// useWorkspace is provided by a context above
// the bell in the real tree; in tests we render the
// bell directly so we don't have that context.
// (NotificationBell doesn't actually use useWorkspace
// — workspaceSlug comes in as a prop.)

// Mock the server action used by the compose modal
// so the test can assert the form calls it correctly.
const { pushActionMock } = vi.hoisted(() => ({
  pushActionMock: vi.fn(),
}));
vi.mock('@/lib/notifications/actions', () => ({
  pushNotificationAction: (...a: unknown[]) => pushActionMock(...a),
}));

import { NotificationBell } from '../NotificationBell';

function mockPanelResponse(overrides: Partial<{
  unread: Array<{ id: string; workspaceId: string; type: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null; createdBy: { id: string; name: string } | null }>;
  earlier: Array<{ id: string; workspaceId: string; type: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null; createdBy: { id: string; name: string } | null }>;
  unreadCount: number;
}> = {}) {
  return {
    unread: overrides.unread ?? [],
    earlier: overrides.earlier ?? [],
    counts: { unread: overrides.unreadCount ?? overrides.unread?.length ?? 0 },
  };
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

const baseProps = {
  workspaceId: 'ws_1',
  workspaceSlug: 'udgok',
  canPush: true,
  members: [
    { id: 'u_1', name: 'Alice Owner', role: 'OWNER' },
    { id: 'u_2', name: 'Bob PM', role: 'PM' },
    { id: 'u_3', name: 'Charlie Field', role: 'FIELD' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetchOk(
    mockPanelResponse({
      unread: [
        {
          id: 'n_1',
          workspaceId: 'ws_1',
          type: 'team_push',
          title: 'Crew meeting at 7am',
          body: 'Bring PPE',
          link: '/projects/abc',
          createdAt: new Date().toISOString(),
          readAt: null,
          createdBy: { id: 'u_1', name: 'Alice' },
        },
      ],
      unreadCount: 1,
    }),
  );
});

afterEach(() => {
  cleanup();
});

describe('NotificationBell', () => {
  it('renders the bell with a "1" badge when there is one unread', async () => {
    render(<NotificationBell {...baseProps} />);
    // The button uses aria-label that includes the
    // count when there are unread.
    const bell = await screen.findByLabelText(/notifications \(1 unread\)/i);
    expect(bell).toBeTruthy();
  });

  it('renders the bell with a "9+" badge when count > 9', async () => {
    global.fetch = mockFetchOk(
      mockPanelResponse({ unreadCount: 42 }),
    );
    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/notifications \(42 unread\)/i);
    expect(bell).toBeTruthy();
    // The "9+" visual label.
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('does NOT show a badge when count is 0', async () => {
    global.fetch = mockFetchOk(mockPanelResponse({ unreadCount: 0 }));
    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/^notifications$/i);
    expect(bell).toBeTruthy();
  });

  it('opens the panel on click and shows the unread notification', async () => {
    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/notifications \(1 unread\)/i);
    fireEvent.click(bell);
    // The panel renders the notification title.
    expect(await screen.findByText('Crew meeting at 7am')).toBeTruthy();
    // And the body.
    expect(screen.getByText('Bring PPE')).toBeTruthy();
    // And "1 new" in the header.
    expect(screen.getByText('1 new')).toBeTruthy();
  });

  it('shows the "+ Send alert" button when canPush is true', async () => {
    render(<NotificationBell {...baseProps} canPush={true} />);
    const bell = await screen.findByLabelText(/notifications/i);
    fireEvent.click(bell);
    expect(await screen.findByText('+ Send alert')).toBeTruthy();
  });

  it('hides the "+ Send alert" button when canPush is false', async () => {
    render(<NotificationBell {...baseProps} canPush={false} />);
    const bell = await screen.findByLabelText(/notifications/i);
    fireEvent.click(bell);
    await screen.findByText('Crew meeting at 7am');
    expect(screen.queryByText('+ Send alert')).toBeNull();
  });

  it('shows the empty state when there are no notifications', async () => {
    global.fetch = mockFetchOk(mockPanelResponse({ unreadCount: 0 }));
    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/^notifications$/i);
    fireEvent.click(bell);
    expect(await screen.findByText('No notifications')).toBeTruthy();
  });

  it('marks all read optimistically and calls PATCH', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          mockPanelResponse({
            unread: [
              {
                id: 'n_1',
                workspaceId: 'ws_1',
                type: 'team_push',
                title: 'Crew meeting at 7am',
                body: null,
                link: null,
                createdAt: new Date().toISOString(),
                readAt: null,
                createdBy: null,
              },
            ],
            unreadCount: 1,
          }),
      });
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/notifications \(1 unread\)/i);
    fireEvent.click(bell);

    const markAll = await screen.findByText('Mark all read');
    fireEvent.click(markAll);

    // PATCH called with all=true.
    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      const fd = (patchCall![1] as RequestInit).body as FormData;
      expect(fd.get('all')).toBe('true');
    });
  });

  it('opens the compose modal when "+ Send alert" is clicked', async () => {
    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/notifications/i);
    fireEvent.click(bell);
    const sendBtn = await screen.findByText('+ Send alert');
    fireEvent.click(sendBtn);
    // Modal renders a "Send alert" header (the panel
    // header says "Notifications").
    expect(await screen.findByText('Push to your team')).toBeTruthy();
  });

  it('calls pushNotificationAction from the compose modal', async () => {
    pushActionMock.mockResolvedValue({ ok: true, recipientCount: 2 });

    render(<NotificationBell {...baseProps} />);
    const bell = await screen.findByLabelText(/notifications/i);
    fireEvent.click(bell);
    fireEvent.click(await screen.findByText('+ Send alert'));

    // Fill the title.
    const titleInput = await screen.findByPlaceholderText(/crew meeting/i);
    fireEvent.change(titleInput, { target: { value: 'Standup at 7am' } });

    // Submit.
    const sendButton = screen.getByRole('button', { name: /^send$/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(pushActionMock).toHaveBeenCalled();
    });
    const callArgs = pushActionMock.mock.calls[0];
    const formData = callArgs[1] as FormData;
    expect(formData.get('title')).toBe('Standup at 7am');
    expect(formData.get('workspaceSlug')).toBe('udgok');
    expect(formData.get('type')).toBe('team_push');
  });
});
