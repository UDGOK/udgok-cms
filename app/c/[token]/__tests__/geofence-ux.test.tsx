// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * Regression tests for the geolocation UX in
 * PublicCheckInView.
 *
 * Two things used to be broken in this flow:
 *
 *   1. GPS capture was triggered by `onFocus` on the form,
 *      which is fragile (the form may not be focused yet,
 *      the button click may not bubble in time, and a denied
 *      permission left the form permanently stuck — there was
 *      no retry path). Now the visitor explicitly taps a
 *      "Share my location" button, gets a clear status for
 *      each state, and can retry after a denial.
 *
 *   2. After a successful GPS capture, the visitor sees
 *      "X m from check-in point" with a green or warning
 *      indicator before they tap Check in. This catches
 *      the case where the admin pinned the sticker to the
 *      wrong place.
 *
 * These tests assert (a) the explicit button is present,
 * (b) clicking it calls navigator.geolocation, (c) on
 * success the live distance is shown, and (d) on denial
 * a "Try again" affordance appears.
 */

// Mock the server action so submitting doesn't actually hit
// the database.
vi.mock('../actions', () => ({
  toggleCheckInAction: vi.fn().mockResolvedValue({ ok: true, action: 'checked_in' }),
}));

vi.mock('react-dom', () => ({
  useFormStatus: () => ({ pending: false }),
}));

import { PublicCheckInView } from '../PublicCheckInView';

const baseProject = {
  id: 'proj_1',
  name: 'Smith Residence',
  code: 'SMITH-2026',
  address: '123 Main St',
  workspaceId: 'ws_1',
  workspaceName: 'Acme Builders',
  workspaceSlug: 'acme',
};

const baseProps = {
  token: 'abc123token',
  codeLabel: 'main gate',
  isActive: true,
  signedInUser: null,
  currentOpenEvent: null,
  subs: [],
  codeGeofence: {
    lat: 36.154,
    lng: -95.9928,
    radiusMeters: 150,
    requireWithinGeofence: true,
  } as const,
};

describe('PublicCheckInView — geolocation UX', () => {
  let getCurrentPositionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getCurrentPositionSpy = vi.fn();
    // Install a fake geolocation API on the jsdom navigator.
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionSpy },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders an explicit "Share my location" button (not onFocus)', () => {
    render(<PublicCheckInView {...baseProps} project={baseProject} />);
    // The button label adapts to the geofence presence
    // ("required" when the code has a geofence, "optional"
    // when it doesn't).
    const btn = screen.getByRole('button', { name: /share my location/i });
    expect(btn).toBeTruthy();
    // And the form does NOT have an onFocus-triggered
    // geolocation request anymore (that was the bug).
    // We can't introspect React event handlers directly,
    // but we CAN check that getCurrentPosition has NOT been
    // called on initial render.
    expect(getCurrentPositionSpy).not.toHaveBeenCalled();
  });

  it('calls navigator.geolocation when the visitor taps the button', () => {
    render(<PublicCheckInView {...baseProps} project={baseProject} />);
    const btn = screen.getByRole('button', { name: /share my location/i });
    fireEvent.click(btn);
    expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the live distance to the geofence pin after GPS grant', async () => {
    getCurrentPositionSpy.mockImplementation(
      (success: PositionCallback) =>
        success({
          coords: {
            // ~0.5 km away from the pin in baseProps
            latitude: 36.149,
            longitude: -95.9928,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition),
    );

    render(<PublicCheckInView {...baseProps} project={baseProject} />);
    fireEvent.click(screen.getByRole('button', { name: /share my location/i }));

    await waitFor(() => {
      expect(screen.getByText(/captured/i)).toBeTruthy();
    });
    // The live distance is shown when coords + geofence pin
    // are both present. The text is split across multiple
    // text nodes inside a <span>, so we use a function
    // matcher that joins all text content of any descendant.
    const root = document.body;
    const allText = (root.textContent || '').replace(/\s+/g, ' ');
    // The visitor in this test is ~555 m from the pin
    // (well past the 150 m radius), so the "out of range"
    // branch renders "556 m away — outside the 150 m
    // check-in zone" in warning text. The "within X m"
    // branch ("from check-in point") is tested by the
    // next test below.
    expect(allText).toMatch(/556 m away/i);
    expect(allText).toMatch(/outside the 150 m check-in zone/i);
  });

  it('shows "from check-in point" when the visitor is within the geofence', async () => {
    getCurrentPositionSpy.mockImplementation(
      (success: PositionCallback) =>
        success({
          coords: {
            // ~30 m from the pin — well within the 150 m radius
            latitude: 36.1542,
            longitude: -95.9928,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition),
    );

    render(<PublicCheckInView {...baseProps} project={baseProject} />);
    fireEvent.click(screen.getByRole('button', { name: /share my location/i }));

    await waitFor(() => {
      const allText = (document.body.textContent || '').replace(/\s+/g, ' ');
      expect(allText).toMatch(/from check-in point/i);
    });
  });

  it('shows a "Try again" affordance when geolocation is denied', async () => {
    // err.code 1 = PERMISSION_DENIED
    getCurrentPositionSpy.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: 'denied' } as GeolocationPositionError),
    );

    render(<PublicCheckInView {...baseProps} project={baseProject} />);
    fireEvent.click(screen.getByRole('button', { name: /share my location/i }));

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeTruthy();
    });
    // "Try again" is a second tap target that lets the
    // visitor re-attempt after granting permission via the
    // browser site settings. Without this, a single denied
    // prompt locks the user out of the GPS flow for the
    // rest of the page session.
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('collapses POSITION_UNAVAILABLE and TIMEOUT into a single "unavailable" retry path', async () => {
    // err.code 2 = POSITION_UNAVAILABLE
    getCurrentPositionSpy.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 2, message: 'unavailable' } as GeolocationPositionError),
    );

    render(<PublicCheckInView {...baseProps} project={baseProject} />);
    fireEvent.click(screen.getByRole('button', { name: /share my location/i }));

    await waitFor(() => {
      // The text should NOT say "denied" — we want the
      // visitor to see "try moving outside" instead of
      // the more alarming "permission denied" message.
      expect(screen.queryByText(/permission denied/i)).toBeNull();
    });
    // And the retry path is still present.
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('renders without a geofence pin (legacy "no GPS" code)', () => {
    // The page should still render the form when the code
    // has no GPS pin. The button text changes to "optional"
    // to signal that sharing is not required.
    render(
      <PublicCheckInView
        {...baseProps}
        project={baseProject}
        codeGeofence={null}
      />,
    );
    const btn = screen.getByRole('button', { name: /share my location/i });
    expect(btn).toBeTruthy();
    // And no geofence error from the action.
    expect(getCurrentPositionSpy).not.toHaveBeenCalled();
  });
});
