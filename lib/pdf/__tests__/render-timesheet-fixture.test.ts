/**
 * Timesheet PDF — render-and-save fixture.
 *
 * Renders a realistic timesheet and writes the PDF to
 * /tmp/timesheet-fixture.pdf so the human can open it
 * locally and verify the borderless layout. Skipped if
 * the env doesn't have @react-pdf/renderer loadable.
 *
 *   npx vitest run lib/pdf/__tests__/render-timesheet-fixture.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';

let renderTimesheetPdf:
  | typeof import('../render-timesheet').renderTimesheetPdf;
let supported = true;

beforeAll(async () => {
  try {
    const mod = await import('../render-timesheet');
    renderTimesheetPdf = mod.renderTimesheetPdf;
  } catch {
    supported = false;
  }
});

describe('Timesheet PDF fixture (writes to /tmp)', () => {
  it('writes a sample borderless timesheet PDF', async () => {
    if (!supported) {
      console.warn('Skipping — @react-pdf/renderer not loadable');
      return;
    }
    const buf = await renderTimesheetPdf({
      kind: 'employee',
      name: 'Bob Foreman',
      secondaryLabel: 'Foreman',
      weekStartLabel: 'Aug 18',
      weekEndLabel: 'Aug 24',
      days: [
        { label: 'Mon', dateLabel: '8/18' },
        { label: 'Tue', dateLabel: '8/19' },
        { label: 'Wed', dateLabel: '8/20' },
        { label: 'Thu', dateLabel: '8/21' },
        { label: 'Fri', dateLabel: '8/22' },
        { label: 'Sat', dateLabel: '8/23' },
        { label: 'Sun', dateLabel: '8/24' },
      ],
      events: [
        {
          id: 'e_1',
          projectName: 'Bixby Residence — Bathroom Remodel',
          projectCode: 'BIX-2026',
          siteLabel: '742 Evergreen Terrace',
          checkedInAt: new Date('2026-08-18T07:00:00Z'),
          checkedOutAt: new Date('2026-08-18T15:30:00Z'),
          hours: 8.5,
          note: 'Demo done, framing started',
          isOpen: false,
          isEdited: false,
          editNote: null,
        },
        {
          id: 'e_2',
          projectName: 'Broken Arrow Office Build-Out',
          projectCode: 'BAO-2026',
          siteLabel: null,
          checkedInAt: new Date('2026-08-19T07:15:00Z'),
          checkedOutAt: new Date('2026-08-19T16:00:00Z'),
          hours: 8.75,
          note: null,
          isOpen: false,
          isEdited: true,
          editNote: 'Forgot to clock out — adjusted to actual time',
        },
        {
          id: 'e_3',
          projectName: 'Tulsa Commercial TI',
          projectCode: 'TUL-26',
          siteLabel: '1500 S Boulder',
          checkedInAt: new Date('2026-08-20T07:00:00Z'),
          checkedOutAt: new Date('2026-08-20T15:00:00Z'),
          hours: 8,
          note: 'Drywall taping',
          isOpen: false,
          isEdited: false,
          editNote: null,
        },
      ],
      totalHours: 25.25,
      totalEvents: 3,
      openCount: 0,
      workspaceName: 'UDGOK Construction',
      generatedAt: new Date(),
    });
    writeFileSync('/tmp/timesheet-fixture.pdf', buf);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });
});
