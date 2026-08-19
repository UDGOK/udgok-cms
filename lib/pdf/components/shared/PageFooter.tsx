/**
 * Page footer — project code (left), generated date (center),
 * page number (right). Uses react-pdf's `fixed` + `render` props
 * so it appears on every page automatically (set on the parent
 * <Page>, not here).
 *
 * The page number is shown as "Page N of M" using react-pdf's
 * built-in `totalPages` (only available when the Document is
 * rendered; we pass it as a prop from the parent).
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../../styles';

export function PageFooter({
  projectCode,
  generatedAt,
  pageNumber,
  totalPages,
}: {
  projectCode: string;
  generatedAt: string;
  pageNumber: number;
  totalPages?: number;
}) {
  return (
    <View style={styles.row} fixed>
      <Text style={styles.col}>{projectCode}</Text>
      <Text style={styles.colCenter}>Generated {generatedAt}</Text>
      <Text style={styles.col}>
        Page {pageNumber}
        {totalPages ? ` of ${totalPages}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    bottom: 30,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.lineSoft,
  },
  col: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  colCenter: {
    fontSize: font.sizeSm,
    color: colors.ink50,
  },
});
