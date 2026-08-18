/**
 * Permit center / building department directory.
 *
 * When a project has a city set, we look it up here to surface the right
 * permit center phone, website, address, and inspection-scheduling number
 * for that jurisdiction. The user can then call the right number for their
 * project without Googling "permit office near me."
 *
 * To add a new city: append an entry with the lowercase `slug` matching
 * the city name and a `match` array of normalized city names that should
 * resolve to it. State is also matched for cities with the same name in
 * different states.
 */

export interface Jurisdiction {
  /** Slug for matching and routing. */
  slug: string;
  /** Display name. e.g. "City of Tulsa" */
  name: string;
  /** U.S. state (2-letter). */
  state: string;
  /** City names that resolve to this jurisdiction (lowercase). */
  match: string[];
  /** ZIP code prefixes this jurisdiction covers (first 3 digits). */
  zipPrefixes?: string[];
  /** Main permit center phone. */
  phone: string;
  /** Inspection-scheduling phone if different. */
  inspectionPhone?: string;
  /** Public website. */
  website: string;
  /** Physical address. */
  address: string;
  /** Hours (display string). */
  hours: string;
  /** Average permit review time in business days, if known. */
  avgReviewDays?: number;
  /** Inspector portal / inspection request URL if separate. */
  inspectionUrl?: string;
  /** Notes shown to the user. */
  notes?: string;
}

export const JURISDICTIONS: Jurisdiction[] = [
  // ---- Oklahoma (the user is here based on the Tulsa mention) ----
  {
    slug: 'tulsa',
    name: 'City of Tulsa',
    state: 'OK',
    match: ['tulsa'],
    zipPrefixes: ['741'],
    phone: '(918) 596-9456',
    inspectionPhone: '(918) 596-9456',
    website: 'https://www.cityoftulsa.org/development-services/',
    address: '175 E 2nd St, Tulsa, OK 74103',
    hours: 'Mon-Fri 8:00am - 4:30pm',
    avgReviewDays: 10,
    inspectionUrl: 'https://www.cityoftulsa.org/development-services/permits/inspection-scheduling/',
    notes: 'Inspections scheduled before 6am the day of are done that day. Use the online portal for fastest scheduling.',
  },
  {
    slug: 'oklahoma-city',
    name: 'City of Oklahoma City',
    state: 'OK',
    match: ['oklahoma city', 'okc', 'oklahoma-city'],
    zipPrefixes: ['731'],
    phone: '(405) 297-2525',
    inspectionPhone: '(405) 297-2525',
    website: 'https://www.okc.gov/residents/permits',
    address: '420 W Main St, Oklahoma City, OK 73102',
    hours: 'Mon-Fri 8:00am - 4:30pm',
    avgReviewDays: 14,
    inspectionUrl: 'https://www.okc.gov/residents/permits/inspections',
  },
  {
    slug: 'broken-arrow',
    name: 'City of Broken Arrow',
    state: 'OK',
    match: ['broken arrow'],
    zipPrefixes: ['740', '741'],
    phone: '(918) 259-2400',
    website: 'https://www.brokenarrowok.gov/government/development',
    address: '220 S 1st St, Broken Arrow, OK 74012',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 10,
  },
  {
    slug: 'edmond',
    name: 'City of Edmond',
    state: 'OK',
    match: ['edmond'],
    phone: '(405) 359-4540',
    website: 'https://edmondok.gov/178/Development-Services',
    address: '10 S Littler Ave, Edmond, OK 73034',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 12,
  },
  {
    slug: 'norman',
    name: 'City of Norman',
    state: 'OK',
    match: ['norman'],
    phone: '(405) 366-5321',
    website: 'https://www.normanok.gov/public-works/development-permits',
    address: '201 W Gray St, Norman, OK 73069',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 10,
  },

  // ---- Texas ----
  {
    slug: 'grand-prairie',
    name: 'City of Grand Prairie',
    state: 'TX',
    match: ['grand prairie'],
    zipPrefixes: ['750', '751'],
    phone: '(972) 237-8400',
    inspectionPhone: '(972) 237-8400',
    website: 'https://www.gptx.org/282/Permits',
    address: '300 W Main St, Grand Prairie, TX 75050',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 7,
    inspectionUrl: 'https://www.gptx.org/321/Schedule-an-Inspection',
    notes: 'Same-day inspections if scheduled by 7am.',
  },
  {
    slug: 'austin',
    name: 'City of Austin',
    state: 'TX',
    match: ['austin'],
    zipPrefixes: ['787', '786'],
    phone: '(512) 978-4000',
    inspectionPhone: '(512) 978-4000',
    website: 'https://www.austintexas.gov/permit',
    address: '505 Barton Springs Rd, Austin, TX 78704',
    hours: 'Mon-Fri 7:30am - 4:30pm',
    avgReviewDays: 21,
    inspectionUrl: 'https://abc.austintexas.gov/web/inspection/inspectionRequest',
    notes: 'Austin uses AB+C portal. Same-day inspections cut off at 7am.',
  },
  {
    slug: 'dallas',
    name: 'City of Dallas',
    state: 'TX',
    match: ['dallas'],
    zipPrefixes: ['752'],
    phone: '(214) 948-4480',
    inspectionPhone: '(214) 670-5311',
    website: 'https://dallascityhall.com/departments/sustainabledevelopment',
    address: '1500 Marilla St, Dallas, TX 75201',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 14,
    inspectionUrl: 'https://www.dallascityhall.com/departments/sustainabledevelopment/buildinginspection/Pages/inspection-request.aspx',
  },
  {
    slug: 'fort-worth',
    name: 'City of Fort Worth',
    state: 'TX',
    match: ['fort worth', 'ft worth'],
    zipPrefixes: ['761'],
    phone: '(817) 392-2222',
    inspectionPhone: '(817) 392-2222',
    website: 'https://www.fortworthtexas.gov/departments/development-services',
    address: '200 Texas St, Fort Worth, TX 76102',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 10,
  },
  {
    slug: 'houston',
    name: 'City of Houston',
    state: 'TX',
    match: ['houston'],
    zipPrefixes: ['770', '771'],
    phone: '(832) 394-8800',
    inspectionPhone: '(832) 394-9465',
    website: 'https://www.houstonpermittingcenter.org',
    address: '1002 Washington Ave, Houston, TX 77002',
    hours: 'Mon-Fri 7:30am - 4:30pm',
    avgReviewDays: 14,
    inspectionUrl: 'https://www.houstonpermittingcenter.org/inspections',
  },
  {
    slug: 'san-antonio',
    name: 'City of San Antonio',
    state: 'TX',
    match: ['san antonio'],
    zipPrefixes: ['782'],
    phone: '(210) 207-1111',
    inspectionPhone: '(210) 207-1111',
    website: 'https://www.sanantonio.gov/dsd',
    address: '1901 S Alamo St, San Antonio, TX 78204',
    hours: 'Mon-Fri 7:45am - 4:30pm',
    avgReviewDays: 14,
  },
  {
    slug: 'plano',
    name: 'City of Plano',
    state: 'TX',
    match: ['plano'],
    zipPrefixes: ['750'],
    phone: '(972) 941-7000',
    website: 'https://www.plano.gov/187/Building-Inspections',
    address: '1520 K Ave, Plano, TX 75074',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 7,
  },
  {
    slug: 'arlington',
    name: 'City of Arlington',
    state: 'TX',
    match: ['arlington'],
    zipPrefixes: ['760'],
    phone: '(817) 459-6500',
    website: 'https://www.arlingtontx.gov/city_hall/departments/building_official',
    address: '101 W Abram St, Arlington, TX 76010',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 7,
  },
  {
    slug: 'irving',
    name: 'City of Irving',
    state: 'TX',
    match: ['irving'],
    zipPrefixes: ['750'],
    phone: '(972) 721-2371',
    website: 'https://www.cityofirving.org/152/Building-Inspections',
    address: '825 W Irving Blvd, Irving, TX 75060',
    hours: 'Mon-Fri 8:00am - 5:00pm',
    avgReviewDays: 7,
  },
];

/**
 * Look up the jurisdiction for a project by city + state + zip.
 *
 * Order of matching:
 *   1. Exact city + state match
 *   2. ZIP prefix match
 *   3. City name match (state-agnostic)
 */
export function findJurisdiction(
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): Jurisdiction | null {
  const cityKey = city?.toLowerCase().trim();
  const stateKey = state?.toUpperCase().trim();
  const zipPrefix = zip?.slice(0, 3);

  if (cityKey && stateKey) {
    const exact = JURISDICTIONS.find(
      (j) => j.state === stateKey && j.match.some((m) => m === cityKey),
    );
    if (exact) return exact;
  }

  if (zipPrefix) {
    const byZip = JURISDICTIONS.find(
      (j) => j.zipPrefixes?.some((p) => p === zipPrefix),
    );
    if (byZip) return byZip;
  }

  if (cityKey) {
    const byCity = JURISDICTIONS.find((j) => j.match.some((m) => m === cityKey));
    if (byCity) return byCity;
  }

  return null;
}

/**
 * Build a Google Maps search URL for a project address.
 * Used when the user wants directions or a quick search.
 */
export function buildMapSearchUrl(address: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string | null {
  const parts = [address.address, address.city, address.state, address.zip].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
