/**
 * Section 08 — Permits & inspections.
 *
 * Each permit is a row with 4 columns: permit number, type,
 * jurisdiction, status. The status pill uses the same color
 * mapping as the in-app permits tab.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtDate, fmtUsd, num, permitStatusInfo } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import { Pill } from './shared/Pill';
import type { ProjectData } from '../types';

export function PermitsSection({ data }: { data: ProjectData }) {
  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 08 · PERMITS"
        title="All permits & inspections"
        subtitle={`${data.permits.length} permit${data.permits.length === 1 ? '' : 's'}`}
      />

      {data.permits.length === 0 ? (
        <Text style={styles.empty}>No permits tracked yet.</Text>
      ) : (
        data.permits.map((p) => {
          const status = permitStatusInfo(p.status);
          return (
            <View key={p.id} style={styles.card} wrap={false}>
              <View style={styles.cell1}>
                <Text style={styles.lbl}>PERMIT #</Text>
                <Text style={styles.valBig}>{p.permitNumber ?? '—'}</Text>
              </View>
              <View style={styles.cell2}>
                <Text style={styles.lbl}>TYPE</Text>
                <Text style={styles.val}>{p.type}</Text>
                {p.notes ? <Text style={styles.notes}>{p.notes}</Text> : null}
              </View>
              <View style={styles.cell3}>
                <Text style={styles.lbl}>JURISDICTION</Text>
                <Text style={styles.val}>{p.jurisdiction ?? '—'}</Text>
                <Text style={styles.meta}>
                  {p.appliedDate ? `Applied ${fmtDate(p.appliedDate)}` : ''}
                  {p.issuedDate ? ` · Issued ${fmtDate(p.issuedDate)}` : ''}
                  {p.expirationDate ? ` · Expires ${fmtDate(p.expirationDate)}` : ''}
                </Text>
              </View>
              <View style={styles.cell4}>
                <Text style={styles.lbl}>STATUS</Text>
                <Pill label={status.label} background={status.color} />
                {p.fee ? <Text style={styles.fee}>Fee: {fmtUsd(num(p.fee))}</Text> : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: font.sizeMd,
    color: colors.ink50,
    fontStyle: 'italic',
  },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cell1: { width: '22%' },
  cell2: { width: '30%', paddingRight: spacing.md },
  cell3: { width: '28%', paddingRight: spacing.md },
  cell4: { width: '20%' },
  lbl: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  val: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  valBig: {
    fontSize: font.sizeLg,
    fontFamily: 'Times-Bold',
    color: colors.ink,
  },
  notes: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    marginTop: 3,
    fontStyle: 'italic',
  },
  meta: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    marginTop: 3,
  },
  fee: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    marginTop: spacing.xs,
  },
});
