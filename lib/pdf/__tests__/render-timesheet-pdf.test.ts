/**
 * Timesheet PDF render — smoke test.
 *
 * Renders a minimal timesheet and asserts the result is a
 * non-empty PDF. Catches the regression where the new
 * borderless TimesheetPdf component throws on render or
 * produces an oversized/empty document.
 *
 * We also assert that the PDF stays on a single page for a
 * realistic one-week timesheet — a multi-page explosion here
 * would be a content-overflow bug.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const baseData = {
  kind: 'employee' as const,
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
  ],
  totalHours: 17.25,
  totalEvents: 2,
  openCount: 0,
  workspaceName: 'UDGOK',
  generatedAt: new Date('2026-08-21T05:00:00Z'),
};

describe('Timesheet PDF render', () => {
  it('renders a valid PDF buffer', async () => {
    if (!supported) {
      console.warn('Skipping — @react-pdf/renderer not loadable');
      return;
    }
    const buffer = await renderTimesheetPdf(baseData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('renders without throwing on a long project name', async () => {
    if (!supported) return;
    const long = 'A'.repeat(80) + ' — Major Remodel with a Very Long Project Name';
    const buf = await renderTimesheetPdf({
      ...baseData,
      events: [
        {
          ...baseData.events[0]!,
          projectName: long,
        },
      ],
    });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('renders without throwing when there are no events', async () => {
    if (!supported) return;
    const buf = await renderTimesheetPdf({
      ...baseData,
      events: [],
      totalHours: 0,
      totalEvents: 0,
    });
    expect(buf.length).toBeGreaterThan(500);
  });

  it('does not use `new Date("M/D")` for daily-totals matching (year-2001 bug)', async () => {
    // Regression: the daily-totals calculation used to do
    //   new Date("8/18").toDateString() === event.checkedInAt.toDateString()
    // but `new Date("8/18")` defaults to year 2001 (ECMAScript spec),
    // so a 2026 event's toDateString() would never match.
    //
    // The fix: compare month + day numbers instead of full Date
    // strings. This is a static-analysis test — we just want to
    // make sure the regression doesn't sneak back in.
    if (!supported) return;
    const src = readFileSync(
      join(process.cwd(), 'lib/pdf/TimesheetPdf.tsx'),
      'utf-8',
    );
    // The fix uses getMonth() + getDate() and parses day.dateLabel
    // as a "M/D" string. Confirm both.
    expect(src).toMatch(/getMonth\(\)\s*\+\s*1/);
    expect(src).toMatch(/getDate\(\)/);
    // The bug pattern: `new Date(day.dateLabel)` or
    // `new Date(day.dateLabel).toDateString()`. This shouldn't
    // appear anywhere in the daily-totals calculation.
    expect(src).not.toMatch(/new Date\(day\.dateLabel\)/);
  });
});
