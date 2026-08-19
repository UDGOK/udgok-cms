/**
 * Server-side render entry point for the Project Book PDF.
 *
 * Separated from the route handler so the route stays a pure
 * .ts file (no JSX, easier to unit-test the auth + permission
 * logic without needing a JSX-aware test runner).
 *
 * The route calls `renderProjectPdf(data, generatedAt)` which
 * internally uses JSX to compose the React-PDF Document. This
 * is the only place in the API layer that touches JSX.
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { ProjectPdf } from './ProjectPdf';
import type { ProjectData } from './types';

/**
 * Render the project book PDF as a Buffer. Throws on render
 * failure — the caller is responsible for catching and returning
 * a 500.
 */
export async function renderProjectPdf(
  data: ProjectData,
  generatedAt: string,
): Promise<Buffer> {
  return renderToBuffer(<ProjectPdf data={data} generatedAt={generatedAt} />);
}
