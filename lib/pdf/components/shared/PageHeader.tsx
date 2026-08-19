/**
 * Page header — a thin strip at the top of every page after the
 * cover. The strip carries: project name (left) and section
 * name (right). Both are small monospace so they read like a
 * watermark, not a heading.
 *
 * Why a header: at print scale, users flip through the PDF to
 * find a specific section. The header is the cheapest possible
 * wayfinding — it works even on black-and-white prints.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../../styles';

export function PageHeader({
  projectName,
  section,
}: {
  projectName: string;
  section: string;
}) {
  return (
    <View style={styles.row} fixed>
      <Text style={styles.left}>{projectName}</Text>
      <Text style={styles.right}>{section}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    marginBottom: spacing.md,
  },
  left: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  right: {
    fontSize: font.sizeSm,
    color: colors.orange,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
});
