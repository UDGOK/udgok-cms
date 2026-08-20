/**
 * CSV utilities. Tiny — no dependency on a CSV lib
 * because the format is simple enough that pulling
 * in a library would add more weight than it saves.
 *
 * We use RFC 4180 escaping:
 *   - fields containing ", \r, or \n are quoted
 *   - quotes inside the field are escaped by doubling
 *   - rows are CRLF-terminated (Excel-friendly)
 */

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvEscape).join(',');
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export function csvHeaders(filename: string, contentLength: number): HeadersInit {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': contentLength.toString(),
    'Cache-Control': 'no-store',
  };
}
