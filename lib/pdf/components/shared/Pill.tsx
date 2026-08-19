/**
 * Small status pill — uppercase, mono-style, color-coded. Used
 * everywhere a status enum needs to be visually distinct: project
 * status, sub status, pay-app status, permit status, photo phase.
 *
 * Background color is passed in; text color is forced to white
 * (with one exception for yellow-on-ink readability).
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font } from '../../styles';

export function Pill({
  label,
  background,
  textColor,
}: {
  label: string;
  background: string;
  textColor?: string;
}) {
  // Yellow needs dark text to stay AA-readable. Everything else
  // is white. We compare the background rgb to the warning yellow
  // and pick text color accordingly.
  const isYellow = background === colors.warning;
  const finalText = textColor ?? (isYellow ? colors.ink : colors.white);
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: background },
      ]}
    >
      <Text style={[styles.label, { color: finalText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: font.sizeSm,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
  },
});
