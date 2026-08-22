/**
 * Timesheet PDF — page-bounds regression test.
 *
 * BUG (Round 23, "this is the 4th time you broke the timesheet"):
 * The page style spread `...page` (which carries `marginTop/
 * Bottom/Left/Right: 54`) AND added its own `padding`. In
 * react-pdf, `margin` on a <Page> is purely cosmetic — the
 * layout engine treats the entire 612×792pt page as the
 * content box. Only `padding` constrains children. The
 * double-spacing bug ate 108pt of the right margin, so the
 * 504pt-wide daily strip + the "25.25" total both overflowed
 * the page edge (max xMax ≈ 621, page is 612pt wide).
 *
 * This test renders a realistic one-week timesheet, extracts
 * the text bounding boxes via `pdftotext -bbox-layout`, and
 * asserts:
 *   1. No word's right edge is past the right page margin
 *      (page width 612 − 54pt right padding = 558pt).
 *   2. The daily-strip day cells lay out in the expected
 *      horizontal sequence (Mon at left, Sun + Total to
 *      the right of Mon) — catches a "regressed to vertical
 *      stack" bug if anyone replaces the flex row with
 *      `flexDirection: 'column'`.
 *   3. Total hours shows in full, not truncated to "25".
 *
 * Skipped if the env doesn't have @react-pdf/renderer or
 * pdftotext loadable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
  // Confirm pdftotext exists on PATH
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    supported = false;
  }
});

/** Parse <word xMin= yMin= xMax= yMax>…</word> from a single page. */
function parseBboxLayout(pdfPath: string) {
  const out = execFileSync('pdftotext', ['-bbox-layout', pdfPath, '-'], {
    encoding: 'utf8',
  });
  // Each page opens <page width="..." height="..."> … <flow>…
  const pages = out.split(/<page /).slice(1);
  return pages.map((p) => {
    const wMatch = /width="([\d.]+)"/.exec(p);
    const words = [...p.matchAll(
      /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g,
    )].map((m) => ({
      xMin: Number(m[1]),
      yMin: Number(m[2]),
      xMax: Number(m[3]),
      yMax: Number(m[4]),
      text: m[5],
    }));
    return { width: wMatch ? Number(wMatch[1]) : 0, words };
  });
}

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
  generatedAt: new Date('2026-08-22T05:00:00Z'),
};

describe('Timesheet PDF — page bounds & layout', () => {
  it('renders a single-page Letter PDF', async () => {
    if (!supported) {
      console.warn('Skipping — @react-pdf/renderer or pdftotext not loadable');
      return;
    }
    const buf = await renderTimesheetPdf(baseData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');

    const dir = mkdtempSync(join(tmpdir(), 'ts-bbox-'));
    const path = join(dir, 'ts.pdf');
    writeFileSync(path, buf);
    const pages = parseBboxLayout(path);

    // Single page, Letter (612 × 792).
    expect(pages).toHaveLength(1);
    expect(pages[0]!.width).toBe(612);
  });

  it('does not overflow the right page margin', async () => {
    if (!supported) return;
    const buf = await renderTimesheetPdf(baseData);
    const dir = mkdtempSync(join(tmpdir(), 'ts-bbox-'));
    const path = join(dir, 'ts.pdf');
    writeFileSync(path, buf);
    const pages = parseBboxLayout(path);

    // Page is 612pt, right padding 54pt → no word's right edge
    // should be past x = 612 - 54 = 558pt. The previous bug let
    // text reach xMax ≈ 621 (off the page). We allow a 0.5pt
    // tolerance because pdftotext sometimes reports xMax with
    // sub-point precision that just barely crosses the line
    // (e.g. 558.0001) even when the text is visually flush.
    const PAGE_WIDTH = 612;
    const RIGHT_PADDING = 54;
    const RIGHT_EDGE = PAGE_WIDTH - RIGHT_PADDING;
    const TOLERANCE = 0.5;

    const overflow = pages[0]!.words.filter((w) => w.xMax > RIGHT_EDGE + TOLERANCE);
    if (overflow.length > 0) {
      console.error('Overflowing words:');
      for (const w of overflow.slice(0, 10)) {
        console.error(`  "${w.text}" xMax=${w.xMax} (limit ${RIGHT_EDGE})`);
      }
    }
    expect(overflow).toHaveLength(0);
  });

  it('lays out the daily strip horizontally (Mon left, Sun + Total right)', async () => {
    if (!supported) return;
    const buf = await renderTimesheetPdf(baseData);
    const dir = mkdtempSync(join(tmpdir(), 'ts-bbox-'));
    const path = join(dir, 'ts.pdf');
    writeFileSync(path, buf);
    const pages = parseBboxLayout(path);

    // Find the y-band containing the daily strip. The strip sits
    // just below the "DAILY HOURS" eyebrow and above the
    // "CHECK-IN / CHECK-OUT DETAIL" eyebrow. Day labels are all
    // on the same y row, so we group by rounded yMin and pick
    // the band with the most day labels.
    const words = pages[0]!.words;

    // Get the y-band for the day-label row by finding the band
    // that contains "MON" and looking at the words at that y.
    const monWord = words.find((w) => w.text === 'MON');
    expect(monWord).toBeDefined();

    // All day labels at the same y as MON.
    const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'TOTAL'];
    const sameBand = (a: number, b: number) => Math.abs(a - b) < 2;
    const row = words.filter(
      (w) => sameBand(w.yMin, monWord!.yMin) && dayLabels.includes(w.text),
    );

    // 7 day labels + TOTAL = 8.
    expect(row.map((w) => w.text).sort()).toEqual(
      ['FRI', 'MON', 'SAT', 'SUN', 'THU', 'TOTAL', 'TUE', 'WED'],
    );

    // In a horizontal row, MON is leftmost, TOTAL is rightmost.
    const sorted = [...row].sort((a, b) => a.xMin - b.xMin);
    expect(sorted[0]!.text).toBe('MON');
    expect(sorted[sorted.length - 1]!.text).toBe('TOTAL');
  });

  it('shows total hours in full (not truncated to "25")', async () => {
    if (!supported) return;
    const buf = await renderTimesheetPdf(baseData);
    const dir = mkdtempSync(join(tmpdir(), 'ts-bbox-'));
    const path = join(dir, 'ts.pdf');
    writeFileSync(path, buf);
    const pages = parseBboxLayout(path);

    // The big "25.25" total must appear as a full word, not split
    // into "25" and "0.25" with the first half falling off the
    // page. We search for any word whose text starts with "25"
    // and verify the ".25" is in the same line.
    const allText = pages[0]!.words.map((w) => w.text).join(' ');
    expect(allText).toMatch(/25\.25/);
  });
});
