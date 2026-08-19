/**
 * ProjectPdf — the top-level <Document> for the project book.
 *
 * One <Page> per section, each with its own header and footer.
 * The cover page has its own self-contained dark layout (no
 * standard footer). Body pages use the shared PageHeader and
 * PageFooter.
 *
 * Pagination: react-pdf handles page breaks automatically for
 * long content. We use `wrap={false}` on individual rows that
 * should never be split (a pay-app card, a note card), and let
 * the engine break the rest.
 *
 * The Document is rendered server-side by the route handler
 * into a Buffer; the Buffer is then streamed back as the
 * response body. The component itself never runs in the browser.
 */
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import { colors, page as pageTokens } from './styles';
import { projectCode } from './utils';
import { PageHeader } from './components/shared/PageHeader';
import { PageFooter } from './components/shared/PageFooter';
import { CoverPage } from './components/CoverPage';
import { OverviewSection } from './components/OverviewSection';
import { SovSection } from './components/SovSection';
import { PayAppsSection } from './components/PayAppsSection';
import { TasksSection } from './components/TasksSection';
import { TeamSection } from './components/TeamSection';
import { SubsSection } from './components/SubsSection';
import { PermitsSection } from './components/PermitsSection';
import { PhotosSection } from './components/PhotosSection';
import { NotesSection } from './components/NotesSection';
import { ActivitySection } from './components/ActivitySection';
import type { ProjectData } from './types';

/**
 * The full PDF document. Body pages each render one section
 * and use the shared header/footer. The cover is its own
 * dark-styled page (the Page component is fine; only the
 * background and footer differ).
 */
export function ProjectPdf({
  data,
  generatedAt,
}: {
  data: ProjectData;
  /** Pre-formatted date string like "2026-08-19" — we pass it
   *  in so all pages show the same value (and the cover matches
   *  the footer). */
  generatedAt: string;
}) {
  const code = projectCode(data.code, data.id);
  const projectName = data.name;

  // Helper to render a body page with header + footer + section.
  // We pre-define these so the JSX below stays compact.
  const bodyPage = (sectionKey: string, sectionLabel: string, content: React.ReactNode, pageNumber: number) => (
    <Page key={sectionKey} size={pageTokens.size} style={styles.bodyPage} wrap>
      <PageHeader projectName={projectName} section={sectionLabel} />
      {content}
      <PageFooter
        projectCode={code}
        generatedAt={generatedAt}
        pageNumber={pageNumber}
      />
    </Page>
  );

  // Photos section may need multiple pages — we wrap that
  // ourselves inside the PhotosSection component, but each
  // page still needs a footer. Easiest: render PhotosSection
  // inside a Page that knows to break naturally.
  return (
    <Document
      title={`${projectName} — Project Book`}
      author="UDGOK Construction"
      subject={`Comprehensive project book for ${projectName}`}
      creator="UDGOK CMS"
      producer="UDGOK CMS via @react-pdf/renderer"
    >
      {/* Page 1: cover. No header/footer (it has its own design). */}
      <Page size={pageTokens.size} style={styles.coverPage}>
        <CoverPage data={data} generatedAt={generatedAt} />
      </Page>

      {/* Page 2: overview. */}
      {bodyPage('overview', 'OVERVIEW', <OverviewSection data={data} />, 2)}

      {/* Page 3: schedule of values. */}
      {bodyPage('sov', 'SCHEDULE OF VALUES', <SovSection data={data} />, 3)}

      {/* Page 4: pay applications. */}
      {bodyPage('pay-apps', 'PAY APPLICATIONS', <PayAppsSection data={data} />, 4)}

      {/* Page 5: tasks. */}
      {bodyPage('tasks', 'TASKS', <TasksSection data={data} />, 5)}

      {/* Page 6: team. */}
      {bodyPage('team', 'TEAM', <TeamSection data={data} />, 6)}

      {/* Page 7: subs. */}
      {bodyPage('subs', 'SUBCONTRACTORS', <SubsSection data={data} />, 7)}

      {/* Page 8: permits. */}
      {bodyPage('permits', 'PERMITS', <PermitsSection data={data} />, 8)}

      {/* Page 9+: photos. May span multiple pages depending on count. */}
      {bodyPage('photos', 'PHOTOS', <PhotosSection data={data} />, 9)}

      {/* Page after photos: notes. */}
      {bodyPage('notes', 'NOTES', <NotesSection data={data} />, 10)}

      {/* Final page: activity log. */}
      {bodyPage('activity', 'ACTIVITY', <ActivitySection data={data} />, 11)}
    </Document>
  );
}

const styles = StyleSheet.create({
  coverPage: {
    padding: 0,
    margin: 0,
    backgroundColor: colors.ink,
  },
  bodyPage: {
    paddingTop: pageTokens.marginTop,
    paddingBottom: pageTokens.marginBottom + 24, // leave room for footer
    paddingHorizontal: pageTokens.marginLeft,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: 'Helvetica',
  },
});
