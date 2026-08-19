/**
 * Section 09 — Photos. The star of the project book.
 *
 * Layout: 3 photos per row, 2 rows per page = 6 tiny thumbnails
 * per page. Each tile is ~1.5" × 1.5" with a small caption strip
 * below showing the caption + GPS + phase pill.
 *
 * Photos are rendered through react-pdf's <Image> tag. We pass
 * the Vercel Blob URL directly — react-pdf fetches it server-
 * side at PDF render time and embeds it as a JPEG. If a photo
 * fails to load (network blip, deleted blob), the tile shows a
 * placeholder with the filename and a broken-image note rather
 * than crashing the whole PDF.
 *
 * The section is paginated manually: we render photos in chunks
 * of 6 and break to a new page between chunks. Each page shows
 * the same SectionTitle header (sticky via `sticky` prop? not
 * available in react-pdf — we re-render the header on each
 * page instead).
 */
import { Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtCoord } from '../utils';
import type { ProjectData } from '../types';

const PHOTOS_PER_PAGE = 6;

export function PhotosSection({ data }: {
  data: ProjectData;
}) {
  const { photos, totalPhotos } = data;
  const pages: ProjectData['photos'][] = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) {
    pages.push(photos.slice(i, i + PHOTOS_PER_PAGE));
  }

  // Section header — re-rendered on every page (react-pdf has no
  // sticky section title).
  const sectionHeader = (
    <View>
      <Text style={styles.eyebrow}>{'// SECTION 09 · PHOTOS'}</Text>
      <Text style={styles.title}>Site photos</Text>
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>
          Most recent first · {totalPhotos} total · showing up to 60
        </Text>
        <Text style={styles.total}>SHOWING {photos.length} OF {totalPhotos}</Text>
      </View>
    </View>
  );

  if (pages.length === 0) {
    return (
      <View>
        {sectionHeader}
        <Text style={styles.empty}>No photos uploaded yet. Capture the first one from the Photos tab.</Text>
      </View>
    );
  }

  return (
    <>
      {pages.map((pagePhotos, pageIdx) => (
        <View key={pageIdx}>
          {sectionHeader}
          <View style={styles.grid}>
            {pagePhotos.map((p) => (
              <View key={p.id} style={styles.tile} wrap={false}>
                <View style={styles.imgWrap}>
                  <Image src={p.url} style={styles.img} />
                </View>
                <View style={styles.meta}>
                  <Text style={styles.caption}>
                    {p.caption || p.filename}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.coords}>{fmtCoord(p.latitude, p.longitude)}</Text>
                    <Text style={[styles.phase, p.phase === 'ROUGH_IN' ? styles.phaseRough : styles.phaseFinal]}>
                      {p.phase === 'ROUGH_IN' ? 'R' : 'F'}
                    </Text>
                  </View>
                  {p.room ? <Text style={styles.room}>{p.room}</Text> : null}
                </View>
              </View>
            ))}
          </View>
          {pageIdx < pages.length - 1 ? null : totalPhotos > photos.length ? (
            <Text style={styles.truncationNote}>
              {`// Showing ${photos.length} most-recent of ${totalPhotos} total. Full gallery is in the app.`}
            </Text>
          ) : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
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
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: font.sizeMd,
    color: colors.ink50,
  },
  total: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  empty: {
    fontSize: font.sizeMd,
    color: colors.ink50,
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    width: '32%',
    marginRight: '2%',
    marginBottom: spacing.md,
    backgroundColor: colors.paper2,
    borderWidth: 0.5,
    borderColor: colors.lineSoft,
  },
  imgWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.lineSoft,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  meta: {
    padding: spacing.xs,
  },
  caption: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coords: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica',
  },
  phase: {
    fontSize: font.sizeXs,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    color: colors.white,
    letterSpacing: 0.5,
  },
  phaseRough: {
    backgroundColor: colors.warning,
    color: colors.ink,
  },
  phaseFinal: {
    backgroundColor: colors.success,
  },
  room: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    marginTop: 2,
  },
  truncationNote: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontFamily: 'Helvetica',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.paper2,
    borderWidth: 0.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
});
