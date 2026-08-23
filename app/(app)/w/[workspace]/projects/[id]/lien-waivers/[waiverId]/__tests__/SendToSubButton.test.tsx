// @vitest-environment jsdom
/**
 * SendToSubButton — the "Send to subcontractor" trigger on the
 * lien waiver detail page.
 *
 * Behavior matrix:
 *   - Default: collapsed, shows a button labeled "Send to subcontractor"
 *   - Click → expands to a form with the sub's contactEmail pre-filled
 *   - Submit → calls sendLienWaiverAction
 *     - on success: shows a success banner; if emailSent, mentions recipient;
 *       if NOT emailSent, mentions "no email went out" so the GC knows to
 *       copy the share link
 *     - on error: shows the error inline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// next/navigation router mock — SendToSubButton calls router.refresh()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock the action module
vi.mock('@/lib/lien-waivers/actions', () => ({
  sendLienWaiverAction: vi.fn(),
}));

import { SendToSubButton } from '../SendToSubButton';
import { sendLienWaiverAction } from '@/lib/lien-waivers/actions';

const mockedAction = sendLienWaiverAction as unknown as ReturnType<typeof vi.fn>;

afterEach(() => cleanup());

beforeEach(() => {
  mockedAction.mockReset();
});

describe('SendToSubButton', () => {
  it('renders collapsed by default with a Send button', () => {
    render(
      <SendToSubButton
        workspaceSlug="udgok"
        projectId="p1"
        waiverId="w1"
        subName="Acme Electric"
        subEmail="jane@acme.example"
      />,
    );
    expect(screen.getByText(/Send to subcontractor/i)).toBeTruthy();
  });

  it('expands on click and pre-fills the sub contact email', async () => {
    mockedAction.mockResolvedValue({
      ok: true,
      emailSent: true,
      recipientEmail: 'jane@acme.example',
      signUrl: 'https://cms.udgok.com/lw/abc',
    });

    render(
      <SendToSubButton
        workspaceSlug="udgok"
        projectId="p1"
        waiverId="w1"
        subName="Acme Electric"
        subEmail="jane@acme.example"
      />,
    );

    fireEvent.click(screen.getByText(/Send to subcontractor/i));
    const input = screen.getByPlaceholderText('jane@acme.example') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('jane@acme.example');

    fireEvent.click(screen.getByText(/^Send$/));
    await waitFor(() => {
      expect(mockedAction).toHaveBeenCalledWith({
        workspaceSlug: 'udgok',
        projectId: 'p1',
        waiverId: 'w1',
        recipientEmail: 'jane@acme.example',
      });
    });
  });

  it('shows "no email went out" success message when emailSent is false', async () => {
    mockedAction.mockResolvedValue({
      ok: true,
      emailSent: false,
      recipientEmail: null,
      signUrl: 'https://cms.udgok.com/lw/abc',
    });

    render(
      <SendToSubButton
        workspaceSlug="udgok"
        projectId="p1"
        waiverId="w1"
        subName="Acme Electric"
        subEmail={null}
      />,
    );

    fireEvent.click(screen.getByText(/Send to subcontractor/i));
    // Type a custom email
    const input = screen.getByPlaceholderText('subcontractor@example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'override@example.com' } });
    fireEvent.click(screen.getByText(/^Send$/));

    await waitFor(() => {
      expect(screen.getByText(/no email went out/i)).toBeTruthy();
    });
  });

  it('shows the error message inline when the action returns ok:false', async () => {
    mockedAction.mockResolvedValue({ ok: false, error: 'Cannot send from SIGNED state' });

    render(
      <SendToSubButton
        workspaceSlug="udgok"
        projectId="p1"
        waiverId="w1"
        subName="Acme Electric"
        subEmail="jane@acme.example"
      />,
    );

    fireEvent.click(screen.getByText(/Send to subcontractor/i));
    fireEvent.click(screen.getByText(/^Send$/));

    await waitFor(() => {
      expect(screen.getByText(/Cannot send from SIGNED state/i)).toBeTruthy();
    });
  });

  it('allows overriding the recipient email', async () => {
    mockedAction.mockResolvedValue({
      ok: true,
      emailSent: true,
      recipientEmail: 'pm@example.com',
      signUrl: 'https://cms.udgok.com/lw/abc',
    });

    render(
      <SendToSubButton
        workspaceSlug="udgok"
        projectId="p1"
        waiverId="w1"
        subName="Acme Electric"
        subEmail="jane@acme.example"
      />,
    );

    fireEvent.click(screen.getByText(/Send to subcontractor/i));
    const input = screen.getByPlaceholderText('jane@acme.example') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'pm@example.com' } });
    fireEvent.click(screen.getByText(/^Send$/));

    await waitFor(() => {
      expect(mockedAction).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'pm@example.com' }),
      );
    });
  });
});
