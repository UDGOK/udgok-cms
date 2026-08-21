import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static-source tests for JurisdictionCard. The card shows
 * the permit portal link from the matched jurisdiction OR a
 * per-project override. We assert the source has the right
 * shape so a future refactor doesn't drop the override path
 * or accidentally leak the project override URL into the
 * "city default" branch.
 */

const CARD = readFileSync(
  join(process.cwd(), 'app/(app)/w/[workspace]/projects/[id]/JurisdictionCard.tsx'),
  'utf8',
);

describe('JurisdictionCard — portal link', () => {
  it('reads permitPortalUrl, permitPortalLabel, permitPortalNotes from the project prop', () => {
    expect(CARD).toContain('permitPortalUrl');
    expect(CARD).toContain('permitPortalLabel');
    expect(CARD).toContain('permitPortalNotes');
  });

  it('prefers the per-project override over the city default', () => {
    // The resolution order: project.permitPortalUrl ?? j?.portalUrl
    expect(CARD).toMatch(/portalUrl\s*=\s*project\.permitPortalUrl\s*\?\?\s*j\??\.portalUrl/);
  });

  it('shows a "custom link" badge when the project overrides the city default', () => {
    expect(CARD).toContain('custom link');
    expect(CARD).toMatch(/portalIsOverride\s*=\s*Boolean\(project\.permitPortalUrl\)/);
  });

  it('renders a portal button when portalUrl resolves to a URL', () => {
    expect(CARD).toMatch(/href=\{portalUrl\}/);
    expect(CARD).toContain('→'); // button arrow
  });

  it('shows the project override notes when set', () => {
    expect(CARD).toContain('PROJECT NOTE');
  });
});
