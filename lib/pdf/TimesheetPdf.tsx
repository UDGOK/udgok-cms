/**
 * TimesheetPdf — borderless weekly timesheet.
 *
 * Design: Atelier-themed, US Letter (8.5" × 11"), borderless.
 * Section dividers are single 1pt lines, not boxes. Typography
 * is Helvetica (body) + Times-Bold (display). Colors come from
 * the shared `styles` module so the printed page matches the
 * rest of the app.
 *
 * Sections:
 *   1. Top meta row: brand · workspace | period | total hours
 *   2. Person block: name (h1), role, ID
 *   3. Daily hours strip: 7 days + total, single thin rule under
 *   4. Event list: date / project (notes) / hours, minimal separators
 *   5. Per-project summary table
 *   6. Signature row
 *   7. Footer
 *
 * All content width is 504pt (8.5" minus 0.75" margins × 2).
 * No element exceeds 504pt; long project names wrap inside
 * the event row instead of forcing horizontal overflow.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { colors, font, page } from './styles';

export interface TimesheetPdfData {
  kind: 'employee' | 'sub';
  name: string;
  secondaryLabel: string | null;
  weekStartLabel: string;
  weekEndLabel: string;
  days: Array<{ label: string; dateLabel: string }>;
  events: Array<{
    id: string;
    projectName: string;
    projectCode: string | null;
    siteLabel: string | null;
    checkedInAt: Date;
    checkedOutAt: Date | null;
    hours: number | null;
    note: string | null;
    isOpen: boolean;
    isEdited: boolean;
    editNote: string | null;
  }>;
  totalHours: number;
  totalEvents: number;
  openCount: number;
  workspaceName: string;
  generatedAt: Date;
}

// 504pt = 8.5" page − 0.75" × 2 margins.
const CONTENT_WIDTH = 612 - 108;

// Column widths within the daily strip. 7 flex days share
// the remaining space after the fixed total column.
const DAILY_TOTAL_COL = 56;
const DAILY_DAY_COL = (CONTENT_WIDTH - DAILY_TOTAL_COL) / 7;

// Event row column widths. Date 64, time 78, project flex, hours 50.
const EVENT_DATE_COL = 64;
const EVENT_TIME_COL = 78;
const EVENT_HOURS_COL = 50;

const styles = StyleSheet.create({
  page: {
    ...page,
    backgroundColor: colors.paper,
    paddingTop: 56,        // slightly tighter top margin
    paddingBottom: 56,
    paddingHorizontal: 54,
    color: colors.ink,
    fontFamily: 'Helvetica',
    fontSize: font.sizeBase,
  },

  // ─── Top meta row: brand left, period/total right ────────────
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandName: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  brandAccent: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.orange,
  },
  brandSub: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  periodStack: {
    alignItems: 'flex-end',
  },
  periodLabel: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    textTransform: 'uppercase',
  },
  periodDates: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginTop: 2,
  },

  // ─── Top divider — single thick rule ─────────────────────────
  thickRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    marginTop: 6,
    marginBottom: 14,
  },
  thinRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.line,
    marginTop: 6,
    marginBottom: 10,
  },
  dottedRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.line,
    borderBottomStyle: 'dashed',
    marginTop: 4,
    marginBottom: 8,
  },

  // ─── Person block ────────────────────────────────────────────
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  personBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    textTransform: 'uppercase',
  },
  personName: {
    fontSize: 24,                    // large display size
    fontFamily: 'Times-Bold',
    color: colors.ink,
    marginTop: 4,
  },
  personSub: {
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica',
    color: colors.ink70,
    marginTop: 2,
  },
  totalBlock: {
    alignItems: 'flex-end',
  },
  totalNumber: {
    fontSize: 32,                    // big orange total
    fontFamily: 'Helvetica-Bold',
    color: colors.orange,
    lineHeight: 1,
  },
  totalUnit: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // ─── Section title (eyebrow style) ──────────────────────────
  sectionTitle: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },

  // ─── Daily hours strip ───────────────────────────────────────
  dailyStrip: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  dailyCell: {
    width: DAILY_DAY_COL,
    alignItems: 'center',
  },
  dailyLabel: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    textTransform: 'uppercase',
  },
  dailyDate: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: colors.ink30,
    marginTop: 1,
  },
  dailyHours: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginTop: 4,
  },
  dailyHoursMuted: {
    color: colors.ink30,
  },
  dailyTotalCell: {
    width: DAILY_TOTAL_COL,
    alignItems: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: colors.line,
    paddingLeft: 4,
  },
  dailyTotalHours: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: colors.orange,
    marginTop: 4,
  },

  // ─── Event list ──────────────────────────────────────────────
  eventRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    alignItems: 'flex-start',
  },
  eventDateCol: {
    width: EVENT_DATE_COL,
  },
  eventTimeCol: {
    width: EVENT_TIME_COL,
  },
  eventDateText: {
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  eventTimeText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    marginTop: 1,
  },
  eventProject: {
    flex: 1,
    paddingRight: 6,
  },
  eventProjectName: {
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  eventProjectMeta: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    marginTop: 1,
  },
  eventNote: {
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
    color: colors.ink70,
    marginTop: 1,
  },
  eventHours: {
    width: EVENT_HOURS_COL,
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'right',
  },
  eventHoursMuted: {
    color: colors.ink30,
  },
  badge: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: colors.paper,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  // ─── Per-project summary ────────────────────────────────────
  projRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    alignItems: 'baseline',
  },
  projName: {
    flex: 1,
    fontSize: font.sizeBase,
    color: colors.ink,
  },
  projEv: {
    width: 48,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    textAlign: 'right',
  },
  projHours: {
    width: 50,
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'right',
  },

  // ─── Signature row ──────────────────────────────────────────
  sigRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 28,
  },
  sigBlock: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: colors.ink,
    height: 26,
  },
  sigLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // ─── Footer ─────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    left: 54,
    right: 54,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: colors.ink50,
  },

  // ─── Empty state ────────────────────────────────────────────
  noEvents: {
    paddingVertical: 14,
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica-Oblique',
    color: colors.ink30,
    textAlign: 'center',
  },
});

// Format helpers — kept here so the PDF doesn't depend on
// lib/timesheets/hours (which is a server module and would
// pull in Prisma if re-imported). Pure functions only.
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDayLabel(label: string): string {
  // 'short' day label is already "Mon" / "Tue" etc. Uppercase
  // it to match the eyebrow treatment used elsewhere.
  return label.toUpperCase();
}

export function TimesheetPdf({ data }: { data: TimesheetPdfData }) {
  // Per-day totals. day.dateLabel is something like "8/18" — we
  // can't just `new Date("8/18")` because that defaults to year
  // 2001 (ECMAScript spec) and would never match the 2026 events.
  // Compare month + day numbers instead, which is robust to year
  // and timezone.
  const dailyTotals = data.days.map((day) => {
    const parts = day.dateLabel.split('/');
    const month = Number(parts[0]);
    const dayNum = Number(parts[1]);
    const total = data.events
      .filter((e) => {
        const d = e.checkedInAt;
        return d.getMonth() + 1 === month && d.getDate() === dayNum;
      })
      .reduce((sum, e) => sum + (e.hours ?? 0), 0);
    return Math.round(total * 100) / 100;
  });

  // Per-project totals
  const projectMap = new Map<
    string,
    { name: string; code: string | null; hours: number; events: number }
  >();
  for (const e of data.events) {
    let p = projectMap.get(e.projectName);
    if (!p) {
      p = { name: e.projectName, code: e.projectCode, hours: 0, events: 0 };
      projectMap.set(e.projectName, p);
    }
    p.hours += e.hours ?? 0;
    p.events += 1;
  }
  const projectSummary = Array.from(projectMap.values())
    .map((p) => ({ ...p, hours: Math.round(p.hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);

  const generated = data.generatedAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Document
      title={`Timesheet — ${data.name} — ${data.weekStartLabel}`}
      author="UDGOK CMS"
    >
      <Page size="LETTER" style={styles.page}>
        {/* ── Top meta row ──────────────────────────────────── */}
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Text style={styles.brandName}>UDG</Text>
            <Text style={styles.brandAccent}>OK</Text>
            {data.workspaceName && data.workspaceName.toLowerCase() !== 'udgok' && data.workspaceName.toLowerCase() !== 'udgok construction' ? (
              <Text style={styles.brandSub}>· {data.workspaceName}</Text>
            ) : null}
          </View>
          <View style={styles.periodStack}>
            <Text style={styles.periodLabel}>Week of</Text>
            <Text style={styles.periodDates}>
              {data.weekStartLabel} – {data.weekEndLabel}
            </Text>
          </View>
        </View>
        <View style={styles.thickRule} />

        {/* ── Person block ──────────────────────────────────── */}
        <View style={styles.personRow}>
          <View style={styles.personBlock}>
            <Text style={styles.eyebrow}>
              {data.kind === 'employee' ? 'Employee timesheet' : 'Subcontractor timesheet'}
            </Text>
            <Text style={styles.personName}>{data.name}</Text>
            {data.secondaryLabel ? (
              <Text style={styles.personSub}>{data.secondaryLabel}</Text>
            ) : null}
          </View>
          <View style={styles.totalBlock}>
            <Text style={styles.eyebrow}>Total hours</Text>
            <Text style={styles.totalNumber}>
              {data.totalHours.toFixed(2).replace(/\.?0+$/, '')}
            </Text>
            <Text style={styles.totalUnit}>this week</Text>
          </View>
        </View>
        <View style={styles.thinRule} />

        {/* ── Daily hours strip ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>Daily hours</Text>
        <View style={styles.dailyStrip}>
          {data.days.map((day, i) => (
            <View key={i} style={styles.dailyCell}>
              <Text style={styles.dailyLabel}>{fmtDayLabel(day.label)}</Text>
              <Text style={styles.dailyDate}>{day.dateLabel}</Text>
              <Text
                style={
                  dailyTotals[i] > 0 ? styles.dailyHours : styles.dailyHoursMuted
                }
              >
                {dailyTotals[i] > 0 ? dailyTotals[i].toString() : '—'}
              </Text>
            </View>
          ))}
          <View style={styles.dailyTotalCell}>
            <Text style={styles.dailyLabel}>Total</Text>
            <Text style={{ height: 9 }} />
            <Text style={styles.dailyTotalHours}>
              {data.totalHours.toFixed(2).replace(/\.?0+$/, '')}
            </Text>
          </View>
        </View>
        <View style={styles.thinRule} />

        {/* ── Event list ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Check-in / check-out detail</Text>
        {data.events.length === 0 ? (
          <Text style={styles.noEvents}>No check-ins recorded for this week.</Text>
        ) : (
          <>
            {data.events.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={styles.eventDateCol}>
                  <Text style={styles.eventDateText}>{fmtDateShort(e.checkedInAt)}</Text>
                </View>
                <View style={styles.eventTimeCol}>
                  <Text style={styles.eventTimeText}>
                    {fmtTime(e.checkedInAt)}
                    {' — '}
                    {e.checkedOutAt ? fmtTime(e.checkedOutAt) : 'open'}
                  </Text>
                </View>
                <View style={styles.eventProject}>
                  <Text style={styles.eventProjectName}>
                    {e.projectName}
                    {e.projectCode ? `  ·  ${e.projectCode}` : ''}
                    {e.isOpen ? (
                      <Text style={{ ...styles.badge, backgroundColor: colors.warning }}>
                        OPEN
                      </Text>
                    ) : null}
                    {e.isEdited ? (
                      <Text style={{ ...styles.badge, backgroundColor: colors.info }}>
                        EDITED
                      </Text>
                    ) : null}
                  </Text>
                  {e.siteLabel ? (
                    <Text style={styles.eventProjectMeta}>at {e.siteLabel}</Text>
                  ) : null}
                  {e.note ? <Text style={styles.eventNote}>{e.note}</Text> : null}
                  {e.editNote && e.isEdited ? (
                    <Text style={styles.eventNote}>
                      Override note: &quot;{e.editNote}&quot;
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={
                    e.hours !== null ? styles.eventHours : styles.eventHoursMuted
                  }
                >
                  {e.hours !== null ? `${e.hours}h` : '—'}
                </Text>
              </View>
            ))}
            {/* close the implicit top border on the first row */}
            <View style={{ borderTopWidth: 0.5, borderTopColor: colors.line }} />
          </>
        )}

        {/* ── Per-project summary ──────────────────────────── */}
        {projectSummary.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>By project</Text>
            {projectSummary.map((p, i) => (
              <View key={i} style={styles.projRow}>
                <Text style={styles.projName}>
                  {p.name}
                  {p.code ? `  (${p.code})` : ''}
                </Text>
                <Text style={styles.projEv}>
                  {p.events} {p.events === 1 ? 'event' : 'events'}
                </Text>
                <Text style={styles.projHours}>{p.hours}h</Text>
              </View>
            ))}
            <View style={{ borderTopWidth: 0.5, borderTopColor: colors.line }} />
          </>
        ) : null}

        {/* ── Signature row ────────────────────────────────── */}
        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>
              {data.kind === 'employee' ? 'Employee signature' : 'Subcontractor signature'}
            </Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Approved by</Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Date</Text>
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text>
            {data.kind === 'employee' ? 'Employee timesheet' : 'Subcontractor timesheet'}
            {' · '}
            {data.workspaceName}
            {' · generated '}
            {generated}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
