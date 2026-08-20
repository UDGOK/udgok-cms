/**
 * Shared design tokens for the Project Book PDF. These mirror the
 * Atelier design system (Tailwind `paper` / `ink` / `orange` family)
 * so the printed page looks like it came from the app, not from
 * a stock PDF generator.
 *
 * react-pdf uses rgb() strings (not hex), so we convert once here
 * instead of inlining 30+ times across components.
 *
 * Font choices: we use the default Helvetica family shipped with
 * react-pdf. Bundling a custom font would add 100-400KB to the
 * server bundle per family and isn't worth it for an internal
 * project book PDF. Serif titles use Times-Roman (default bold)
 * which renders crisply in print.
 */

export const colors = {
  paper: 'rgb(245, 241, 232)',      // #f5f1e8 — page background
  paper2: 'rgb(235, 230, 215)',     // #ebe6d7 — card / table header
  ink: 'rgb(30, 42, 58)',           // #1e2a3a — primary text, totals row
  ink70: 'rgb(74, 85, 102)',        // #4a5566 — secondary text
  ink50: 'rgb(124, 134, 148)',      // #7c8694 — tertiary text
  ink30: 'rgb(184, 188, 196)',      // #b8bcc4 — disabled
  line: 'rgb(201, 193, 173)',       // #c9c1ad — borders
  lineSoft: 'rgb(221, 213, 190)',   // #ddd5be — soft borders / dashed
  orange: 'rgb(255, 90, 31)',       // #ff5a1f — accent
  orangeD: 'rgb(229, 74, 20)',      // #e54a14 — accent dark
  success: 'rgb(44, 138, 95)',      // #2c8a5f
  warning: 'rgb(232, 169, 58)',     // #e8a93a
  error: 'rgb(200, 66, 58)',        // #c8423a
  info: 'rgb(42, 111, 181)',        // #2a6fb5
  white: 'rgb(255, 255, 255)',
} as const;

/** Letter-size page (8.5" × 11") with 0.75" margins. */
export const page = {
  size: 'LETTER' as const,
  marginTop: 54,        // 0.75"
  marginBottom: 54,
  marginLeft: 54,
  marginRight: 54,
};

/** Typography scale. react-pdf uses points (pt) for fontSize. */
export const font = {
  sizeXs: 7,
  sizeSm: 8,
  sizeBase: 9,
  sizeMd: 10,
  sizeLg: 12,
  sizeXl: 14,
  sizeHero: 36,         // cover page project name
  sizeCover: 56,        // cover page huge title
  sizeSection: 22,      // section titles (h2)
  sizeSubsection: 16,   // subsection titles (h3)
  sizeKpi: 18,          // KPI numbers
  sizeKpiBig: 22,       // KPI big numbers
  sizeCoverMeta: 24,    // cover meta big numbers
  // react-pdf fontFamily values. We use the default
  // Helvetica family + Times-Roman for serif titles. No
  // custom fonts shipped (would add 100-400KB per family).
  body: 'Helvetica',
  bodyBold: 'Helvetica-Bold',
  headline: 'Times-Roman',
  headlineBold: 'Times-Bold',
  headlineItalic: 'Times-Italic',
  mono: 'Courier',
  monoBold: 'Courier-Bold',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
} as const;
