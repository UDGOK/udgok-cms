/**
 * Cover page — the hero. Dark ink background, project name in
 * large serif, status badge, and key meta (client, code, contract
 * value, billed to date, timeline, address) arranged in a 2×3
 * grid at the bottom.
 *
 * The orange circles in the background are radial gradients
 * rendered as overlapping solid circles with low opacity. PDF
 * doesn't support CSS radial-gradient, so we fake it with
 * positioned translucent circles. Cheap, looks good.
 */
import { Text, View, StyleSheet, Svg, Circle } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtUsd, fmtDate, projectStatusColor, projectCode } from '../utils';
import { Pill } from './shared/Pill';
import { ProjectData } from '../types';

export function CoverPage({ data, generatedAt }: { data: ProjectData; generatedAt: string }) {
  const code = projectCode(data.code, data.id);
  // We need the project page to compute the total billed, the
  // same way the in-app overview does. The ProjectData already
  // has the payApps with thisDraw totals, so we sum here.
  const totalBilled = data.payApps
    .filter((p) => p.status === 'PAID' || p.status === 'ACKNOWLEDGED' || p.status === 'VIEWED' || p.status === 'SENT')
    .reduce((acc, p) => acc + Number(p.totalThisDraw || 0), 0);

  return (
    <View style={styles.cover}>
      {/* Background "halo" circles — fake radial gradient. */}
      <View style={styles.haloTopRight} fixed>
        <Svg width="400" height="400" viewBox="0 0 400 400">
          <Circle cx="200" cy="200" r="200" fill={colors.orange} opacity={0.08} />
        </Svg>
      </View>
      <View style={styles.haloBottomLeft} fixed>
        <Svg width="350" height="350" viewBox="0 0 350 350">
          <Circle cx="175" cy="175" r="175" fill={colors.orange} opacity={0.05} />
        </Svg>
      </View>

      {/* Eyebrow */}
      <Text style={styles.eyebrow}>{`// PROJECT BOOK · GENERATED ${generatedAt.toUpperCase()}`}</Text>

      {/* Status pill */}
      <View style={{ marginTop: spacing.lg }}>
        <Pill
          label={data.status}
          background={projectStatusColor(data.status)}
        />
      </View>

      {/* Title — the project name. Large serif. */}
      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.subtitle}>
        Comprehensive project record · photos · schedule · pay applications · team activity
      </Text>

      {/* Meta grid — 2 columns × 3 rows. */}
      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>CLIENT</Text>
          <Text style={styles.metaVal}>{data.client?.name ?? 'No client'}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>CODE</Text>
          <Text style={styles.metaVal}>{code}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>CONTRACT VALUE</Text>
          <Text style={styles.metaValBig}>{fmtUsd(data.contractValue ? Number(data.contractValue) : null)}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>BILLED TO DATE</Text>
          <Text style={styles.metaValBig}>{fmtUsd(totalBilled)}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>TIMELINE</Text>
          <Text style={styles.metaVal}>
            {fmtDate(data.startDate)} → {fmtDate(data.endDate)}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>ADDRESS</Text>
          <Text style={styles.metaVal}>
            {[data.address, data.city, data.state, data.zip].filter(Boolean).join(', ') || '—'}
          </Text>
        </View>
      </View>

      {/* Cover footer — brand + page indicator */}
      <View style={styles.coverFooter} fixed>
        <Text style={styles.footerL}>UDGOK Construction · cms.udgok.com</Text>
        <Text style={styles.footerR}>PROJECT BOOK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.ink,
    color: colors.paper,
    padding: 54,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  haloTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
  },
  haloBottomLeft: {
    position: 'absolute',
    bottom: -150,
    left: -100,
  },
  eyebrow: {
    fontSize: font.sizeSm,
    color: colors.orange,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: font.sizeCover,
    color: colors.paper,
    fontFamily: 'Times-Bold',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    lineHeight: 1.05,
  },
  subtitle: {
    fontSize: font.sizeLg,
    color: colors.paper2,
    opacity: 0.7,
    maxWidth: 360,
  },
  metaGrid: {
    position: 'absolute',
    bottom: 100,
    left: 54,
    right: 54,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaCell: {
    width: '50%',
    marginBottom: spacing.lg,
    paddingRight: spacing.lg,
  },
  metaLbl: {
    fontSize: font.sizeSm,
    color: colors.orange,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  metaVal: {
    fontSize: font.sizeLg,
    color: colors.paper,
    fontFamily: 'Helvetica-Bold',
  },
  metaValBig: {
    fontSize: font.sizeCoverMeta,
    color: colors.paper,
    fontFamily: 'Times-Bold',
  },
  coverFooter: {
    position: 'absolute',
    bottom: 30,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.paper2,
    opacity: 0.4,
  },
  footerL: {
    fontSize: font.sizeSm,
    color: colors.paper,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  footerR: {
    fontSize: font.sizeSm,
    color: colors.paper,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
});
