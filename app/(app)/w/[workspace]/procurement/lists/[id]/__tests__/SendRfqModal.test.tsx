/**
 * Regression test for the "Jee Lighting disappeared from the
 * Send-to-Vendor dropdown" bug (Aug 2026).
 *
 * Bug: the modal filtered out vendors that already had an active
 * RFQ (DRAFT/SENT/VIEWED) without showing them at all, so the
 * user thought the vendor was gone and didn't know they needed
 * to open the existing RFQ.
 *
 * Fix: the modal now groups blocked vendors in a disabled
 * <optgroup> with the status + RFQ number visible, and shows
 * a "jump to existing RFQ" hint when a blocked vendor is
 * selected (defensive — shouldn't happen since the option is
 * disabled, but covers autofill / accessibility tools).
 *
 * We test the rendering of the modal in isolation: pass it
 * mock vendors + existing RFQs and assert the right options
 * appear in the right state.
 */

// @vitest-environment jsdom
// (The default node env can't render React — we need a real DOM.)

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SendRfqModal } from '../ListDetailView';

afterEach(() => cleanup());

// Mock the action that the modal calls on submit — we don't
// want to hit the server in a render test.
vi.mock('@/lib/procurement/rfq-actions', () => ({
  createRfqAction: vi.fn().mockResolvedValue({ ok: false, error: 'mock' }),
}));

// next/navigation router.push mock
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const vendors = [
  { id: 'v_broken_arrow', name: 'Broken Arrow Electric', contacts: [
    { id: 'c1', name: 'Pat', email: 'pat@ba.example', isPrimary: true },
  ] },
  { id: 'v_jee_lighting', name: 'Jee Lighting', contacts: [
    { id: 'c2', name: 'Jamie', email: 'jamie@jee.example', isPrimary: true },
  ] },
  { id: 'v_lowes', name: "Lowe's", contacts: [
    { id: 'c3', name: 'Lowes Pro', email: 'pro@lowes.example', isPrimary: true },
  ] },
];

// All selects in the modal are rendered; the Vendor one is the
// only one labelled "Vendor" via the surrounding <label>.
function getVendorSelect() {
  // The form has multiple comboboxes (vendor, then contact, plus
  // the optional contact one). The vendor <select> is the only
  // one whose accessible name includes "Vendor".
  return screen.getByRole('combobox', { name: /vendor/i });
}

describe('SendRfqModal — vendor dropdown', () => {
  it('shows ALL vendors including those with active RFQs (was the Jee Lighting bug)', () => {
    render(
      <SendRfqModal
        listId="list_1"
        listName="Test list"
        workspaceId="ws_1"
        workspaceSlug="udgok"
        vendors={vendors}
        existingRfqs={[
          { rfqId: 'rfq_jee_draft', number: 'RFQ-2026-0004-R2', status: 'DRAFT', vendorId: 'v_jee_lighting' },
        ]}
        onClose={vi.fn()}
      />,
    );

    // All 3 vendor names should be present in the dropdown.
    // Before the fix, Jee Lighting disappeared entirely.
    expect(within(getVendorSelect()).getByRole('option', { name: /Broken Arrow Electric/ })).toBeTruthy();
    expect(within(getVendorSelect()).getByRole('option', { name: /Jee Lighting/ })).toBeTruthy();
    expect(within(getVendorSelect()).getByRole('option', { name: /Lowe's/ })).toBeTruthy();
  });

  it('disables the option for vendors that already have a DRAFT RFQ', () => {
    render(
      <SendRfqModal
        listId="list_1"
        listName="Test list"
        workspaceId="ws_1"
        workspaceSlug="udgok"
        vendors={vendors}
        existingRfqs={[
          { rfqId: 'rfq_jee_draft', number: 'RFQ-2026-0004-R2', status: 'DRAFT', vendorId: 'v_jee_lighting' },
        ]}
        onClose={vi.fn()}
      />,
    );

    const jeeOption = within(getVendorSelect()).getByRole('option', { name: /Jee Lighting/ });
    expect(jeeOption.hasAttribute('disabled')).toBe(true);

    // The option label should mention BOTH the status and the RFQ
    // number — so the user knows WHY it's disabled.
    expect(jeeOption.textContent).toMatch(/DRAFT/);
    expect(jeeOption.textContent).toMatch(/RFQ-2026-0004-R2/);

    // Available vendors must not be disabled
    const brokenArrow = within(getVendorSelect()).getByRole('option', { name: /Broken Arrow Electric/ });
    expect(brokenArrow.hasAttribute('disabled')).toBe(false);
  });

  it('groups blocked vendors under an optgroup labelled "already has an open RFQ"', () => {
    render(
      <SendRfqModal
        listId="list_1"
        listName="Test list"
        workspaceId="ws_1"
        workspaceSlug="udgok"
        vendors={vendors}
        existingRfqs={[
          { rfqId: 'rfq_jee_draft', number: 'RFQ-2026-0004-R2', status: 'DRAFT', vendorId: 'v_jee_lighting' },
        ]}
        onClose={vi.fn()}
      />,
    );

    // <optgroup> is exposed as role="group" in the accessibility
    // tree. The label is read as the accessible name.
    const groups = screen.getAllByRole('group');
    const blockerGroup = groups.find((g) => /already has an open RFQ/i.test(g.getAttribute('label') ?? ''));
    expect(blockerGroup, 'expected the "already has an open RFQ" optgroup').toBeTruthy();
    if (blockerGroup) {
      // Jee Lighting must be inside this optgroup
      expect(within(blockerGroup).getByRole('option', { name: /Jee Lighting/ })).toBeTruthy();
    }
  });

  it('auto-selects the first eligible vendor (skips blocked ones)', () => {
    render(
      <SendRfqModal
        listId="list_1"
        listName="Test list"
        workspaceId="ws_1"
        workspaceSlug="udgok"
        vendors={vendors}
        existingRfqs={[
          { rfqId: 'rfq_jee_draft', number: 'RFQ-2026-0004-R2', status: 'DRAFT', vendorId: 'v_jee_lighting' },
        ]}
        onClose={vi.fn()}
      />,
    );

    // The blocked vendor (Jee Lighting) is in the middle of the
    // list, but the default selection must skip past it to the
    // first eligible vendor.
    expect((getVendorSelect() as HTMLSelectElement).value).toBe('v_broken_arrow');
  });

  it('does NOT show the "open existing" hint on initial render (only when a blocked vendor is selected)', () => {
    render(
      <SendRfqModal
        listId="list_1"
        listName="Test list"
        workspaceId="ws_1"
        workspaceSlug="udgok"
        vendors={vendors}
        existingRfqs={[
          { rfqId: 'rfq_jee_draft', number: 'RFQ-2026-0004-R2', status: 'DRAFT', vendorId: 'v_jee_lighting' },
        ]}
        onClose={vi.fn()}
      />,
    );

    // The hint only appears when a blocked vendor is selected
    // (defensive — the option is disabled so this only fires for
    // browser autofill or accessibility tools). Default selection
    // is the first eligible vendor, so no hint.
    expect(screen.queryByText(/Already has a/)).toBeNull();
  });
});
