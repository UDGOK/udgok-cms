/**
 * Section title block. Used at the top of every section in the
 * body of the PDF (not the cover, which has its own treatment).
 *
 * Layout:
 *   // SECTION 03 · SCHEDULE OF VALUES  ← eyebrow (orange mono)
 *   Every line item                    ← serif heading
 *   $828,300 across 14 divisions…     ← subtle sub
 *
 * The serif heading is Times-Roman (default). Bold variants are
 * used for the section number badge to keep weight.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../../styles';

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: font.sizeSm,
    color: colors.orange,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: font.sizeSection,
    color: colors.ink,
    fontFamily: 'Times-Bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: font.sizeMd,
    color: colors.ink50,
  },
});
