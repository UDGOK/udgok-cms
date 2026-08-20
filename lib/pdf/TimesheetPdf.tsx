/**
 * TimesheetPdf — weekly timesheet template.
 *
 * Used by both the per-employee and per-sub PDF
 * routes. The shape is the same; only the "who"
 * label and the data source differ.
 *
 * Layout:
 *   - Header: name, period, total hours
 *   - Daily grid table (Mon-Sun)
 *   - Event list (each check-in/out with hours)
 *   - Per-project summary
 *   - Signature line at the bottom
 *
 * The signature line is the legally-significant
 * part of a timesheet — foremen sign to confirm
 * their hours; admins sign to approve. This v1
 * just shows a placeholder; v2 could capture the
 * signature inline.
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

const styles = StyleSheet.create({
  page: {
    ...page,
    backgroundColor: colors.paper,
    paddingTop: page.marginTop,
    paddingBottom: page.marginBottom,
    paddingHorizontal: page.marginLeft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    paddingBottom: 10,
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  brand: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  brandAccent: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.orange,
  },
  workspaceLabel: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    letterSpacing: 1.2,
  },
  eyebrow: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: font.sizeSubsection + 4,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginTop: 2,
  },
  sub: {
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica',
    color: colors.ink70,
    marginTop: 2,
  },
  period: {
    fontSize: font.sizeSm,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'right',
  },
  periodLabel: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  totalBox: {
    alignItems: 'flex-end',
  },
  totalNumber: {
    fontSize: font.sizeCoverMeta,
    fontFamily: 'Helvetica-Bold',
    color: colors.orange,
    lineHeight: 1,
  },
  totalUnit: {
    fontSize: font.sizeBase,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginTop: 2,
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper2,
  },
  summaryLabel: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  dailyTable: {
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  dailyRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
  },
  dailyRowLast: {
    flexDirection: 'row',
  },
  dailyHeader: {
    flexDirection: 'row',
    backgroundColor: colors.paper2,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  dailyHeaderCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dailyHeaderCellNarrow: {
    width: 56,
  },
  dailyCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica',
    color: colors.ink,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: colors.lineSoft,
  },
  dailyCellNarrow: {
    width: 56,
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'center',
    backgroundColor: colors.paper2,
  },
  eventRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    paddingVertical: 4,
  },
  eventDate: {
    width: 60,
    fontSize: font.sizeSm,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  eventTime: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica',
    color: colors.ink50,
    marginTop: 1,
  },
  eventProject: {
    flex: 1,
    fontSize: font.sizeSm,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    paddingHorizontal: 6,
  },
  eventHours: {
    width: 60,
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'right',
  },
  eventNote: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Oblique',
    color: colors.ink70,
    marginTop: 1,
  },
  badge: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: colors.paper,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginLeft: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  signature: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    height: 22,
  },
  signatureLabel: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    left: page.marginLeft,
    right: page.marginRight,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica',
    color: colors.ink50,
  },
  noEvents: {
    paddingVertical: 12,
    fontSize: font.sizeSm,
    fontFamily: 'Helvetica-Oblique',
    color: colors.ink50,
    textAlign: 'center',
  },
});

export function TimesheetPdf({ data }: { data: TimesheetPdfData }) {
  // Per-day summary
  const dailyTotals = data.days.map((day) => {
    const dayEvents = data.events.filter(
      (e) => e.checkedInAt.toDateString() === new Date(day.dateLabel).toDateString(),
    );
    const total = dayEvents.reduce((sum, e) => sum + (e.hours ?? 0), 0);
    return Math.round(total * 100) / 100;
  });

  // Per-project summary
  const projectMap = new Map<string, { name: string; code: string | null; hours: number; events: number }>();
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

  return (
    <Document
      title={`Timesheet — ${data.name} — ${data.weekStartLabel}`}
      author="UDGOK CMS"
    >
      <Page size={page.size} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brand}>UDG</Text>
              <Text style={styles.brandAccent}>OK</Text>
              <Text style={styles.workspaceLabel}>· {data.workspaceName}</Text>
            </View>
            <Text style={{ ...styles.eyebrow, marginTop: 8 }}>
              {data.kind === 'employee' ? 'Employee timesheet' : 'Subcontractor timesheet'}
            </Text>
            <Text style={styles.title}>{data.name}</Text>
            {data.secondaryLabel ? (
              <Text style={styles.sub}>{data.secondaryLabel}</Text>
            ) : null}
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.periodLabel}>Period</Text>
            <Text style={styles.period}>{data.weekStartLabel}</Text>
            <Text style={{ ...styles.periodLabel, marginTop: 6 }}>Total hours</Text>
            <Text style={styles.totalNumber}>{data.totalHours.toFixed(2).replace(/\.?0+$/, '')}</Text>
            <Text style={styles.totalUnit}>hours</Text>
          </View>
        </View>

        {/* Summary chips */}
        <View style={styles.summary}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Events</Text>
            <Text style={styles.summaryValue}>{data.totalEvents}</Text>
          </View>
          {data.openCount > 0 ? (
            <View style={{ ...styles.summaryChip, backgroundColor: colors.paper }}>
              <Text style={styles.summaryLabel}>Open</Text>
              <Text style={{ ...styles.summaryValue, color: colors.warning }}>
                {data.openCount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Daily grid */}
        <Text style={styles.sectionTitle}>Daily hours</Text>
        <View style={styles.dailyTable}>
          <View style={styles.dailyHeader}>
            {data.days.map((day, i) => (
              <Text key={i} style={styles.dailyHeaderCell}>
                {day.label}
                {'\n'}
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: colors.ink50 }}>
                  {day.dateLabel}
                </Text>
              </Text>
            ))}
            <Text style={{ ...styles.dailyHeaderCell, ...styles.dailyHeaderCellNarrow, backgroundColor: colors.paper2 }}>
              Total
            </Text>
          </View>
          <View style={styles.dailyRowLast}>
            {dailyTotals.map((h, i) => (
              <Text key={i} style={styles.dailyCell}>
                {h > 0 ? h.toString() : '—'}
              </Text>
            ))}
            <Text style={{ ...styles.dailyCell, ...styles.dailyCellNarrow }}>
              {data.totalHours.toString()}
            </Text>
          </View>
        </View>

        {/* Events list */}
        <Text style={styles.sectionTitle}>Check-in / Check-out detail</Text>
        {data.events.length === 0 ? (
          <Text style={styles.noEvents}>No check-ins recorded for this week.</Text>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.line }}>
            {data.events.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={{ width: 90, paddingHorizontal: 4 }}>
                  <Text style={styles.eventDate}>
                    {e.checkedInAt.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.eventTime}>
                    {e.checkedInAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' → '}
                    {e.checkedOutAt
                      ? e.checkedOutAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : 'open'}
                  </Text>
                </View>
                <View style={styles.eventProject}>
                  <Text>
                    {e.projectName}
                    {e.projectCode ? ` (${e.projectCode})` : ''}
                    {e.siteLabel ? ` · ${e.siteLabel}` : ''}
                    {e.isOpen ? (
                      <Text style={{ ...styles.badge, backgroundColor: colors.warning }}>OPEN</Text>
                    ) : null}
                    {e.isEdited ? (
                      <Text style={{ ...styles.badge, backgroundColor: colors.info }}>EDITED</Text>
                    ) : null}
                  </Text>
                  {e.note ? <Text style={styles.eventNote}>{e.note}</Text> : null}
                  {e.editNote && e.isEdited ? (
                    <Text style={styles.eventNote}>Override note: &ldquo;{e.editNote}&rdquo;</Text>
                  ) : null}
                </View>
                <Text style={styles.eventHours}>
                  {e.hours !== null ? `${e.hours}h` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Per-project summary */}
        {projectSummary.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>By project</Text>
            <View style={{ borderWidth: 1, borderColor: colors.line }}>
              {projectSummary.map((p, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    borderBottomWidth: i === projectSummary.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.lineSoft,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: font.sizeSm, color: colors.ink }}>
                    {p.name}
                    {p.code ? ` (${p.code})` : ''}
                  </Text>
                  <Text style={{ width: 50, fontSize: font.sizeXs, color: colors.ink50, fontFamily: 'Helvetica' }}>
                    {p.events} ev
                  </Text>
                  <Text style={{ width: 60, fontSize: font.sizeSm, fontFamily: 'Helvetica-Bold', color: colors.ink, textAlign: 'right' }}>
                    {p.hours}h
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Signature lines */}
        <View style={styles.signature}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>{data.kind === 'employee' ? 'Employee signature' : 'Subcontractor signature'}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Approved by</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {data.kind === 'employee' ? 'Employee timesheet' : 'Subcontractor timesheet'} · {data.workspaceName}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
