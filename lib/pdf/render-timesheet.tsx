/**
 * Server-side render entry for the timesheet PDF.
 * Same pattern as the project book PDF — keeps the
 * JSX in a separate file so the route handlers
 * stay plain .ts.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { TimesheetPdf, type TimesheetPdfData } from './TimesheetPdf';

export async function renderTimesheetPdf(
  data: TimesheetPdfData,
): Promise<Buffer> {
  return renderToBuffer(<TimesheetPdf data={data} />);
}
