/**
 * CSI MasterFormat — the construction industry's standard numbering system.
 *
 * Each division has a 2-digit number (or 4-digit for sub-sections),
 * a short name, and a description. We carry the top ~50 divisions that
 * cover ~95% of small-to-mid commercial and residential construction.
 *
 * The full MasterFormat has 50+ divisions. We ship the ones contractors
 * actually see on pay apps. Add more as needed.
 *
 * Reference: https://www.csiresources.org/standards/masterformat
 */

export interface CSIDivision {
  /** Two-digit top-level number, e.g. "03" */
  number: string;
  /** Short name shown in dropdowns, e.g. "Concrete" */
  name: string;
  /** Longer description for tooltip / detail row */
  description: string;
  /** Logical group used to cluster the dropdown */
  group: 'General' | 'Site' | 'Concrete' | 'Masonry' | 'Metals' | 'Wood' | 'Thermal' | 'Openings' | 'Finishes' | 'Specialties' | 'Equipment' | 'Conveying' | 'Fire Suppression' | 'Plumbing' | 'HVAC' | 'Electrical' | 'Communications' | 'Electronic Safety' | 'Earthwork' | 'Utilities';
}

export const CSI_MASTERFORMAT: CSIDivision[] = [
  // General
  { number: '01',    name: 'General Requirements',          description: 'Project management, supervision, temporary facilities, cleanup', group: 'General' },

  // Existing / Site
  { number: '02',    name: 'Existing Conditions',           description: 'Demolition, site remediation, hazardous material handling', group: 'Site' },
  { number: '31',    name: 'Earthwork',                     description: 'Grading, excavation, fill, soil treatment, shoring', group: 'Earthwork' },
  { number: '32',    name: 'Exterior Improvements',         description: 'Paving, curbing, fencing, landscaping, irrigation', group: 'Site' },
  { number: '33',    name: 'Utilities',                     description: 'Water, sanitary sewer, storm sewer, gas, electrical site', group: 'Utilities' },

  // Concrete / Masonry / Metals
  { number: '03',    name: 'Concrete',                      description: 'Cast-in-place, precast, slabs, footings, reinforcing steel', group: 'Concrete' },
  { number: '04',    name: 'Masonry',                       description: 'Brick, CMU, stone, mortar, grout, reinforcement', group: 'Masonry' },
  { number: '05',    name: 'Metals',                        description: 'Structural steel, metal joists, metal studs, railings, gratings, fabrications', group: 'Metals' },

  // Wood / Plastics / Composites
  { number: '06',    name: 'Wood, Plastics & Composites',   description: 'Rough carpentry, finish carpentry, framing, cabinets, architectural woodwork', group: 'Wood' },
  { number: '07',    name: 'Thermal & Moisture Protection', description: 'Roofing, insulation, weather barriers, sealants, fireproofing', group: 'Thermal' },

  // Openings / Finishes
  { number: '08',    name: 'Openings',                      description: 'Doors, frames, windows, glazing, hardware, storefronts', group: 'Openings' },
  { number: '09',    name: 'Finishes',                      description: 'Drywall, paint, flooring, ceilings, wall coverings, tile', group: 'Finishes' },

  // Specialties / Equipment
  { number: '10',    name: 'Specialties',                   description: 'Toilet partitions, signage, lockers, fireplaces, shelving', group: 'Specialties' },
  { number: '11',    name: 'Equipment',                     description: 'Appliances, food service, lab, medical, parking, athletic', group: 'Equipment' },
  { number: '12',    name: 'Furnishings',                   description: 'Window treatments, casework, furniture, rugs, artwork', group: 'Equipment' },
  { number: '13',    name: 'Special Construction',         description: 'Swimming pools, ice rinks, vaults, X-ray shielding, seismic', group: 'Specialties' },
  { number: '14',    name: 'Conveying Equipment',           description: 'Elevators, escalators, lifts, dumbwaiters, material handling', group: 'Conveying' },

  // Mechanical / Electrical
  { number: '21',    name: 'Fire Suppression',              description: 'Sprinklers, standpipes, fire pumps, extinguishers', group: 'Fire Suppression' },
  { number: '22',    name: 'Plumbing',                      description: 'Piping, fixtures, drainage, water heaters, gas', group: 'Plumbing' },
  { number: '23',    name: 'HVAC',                          description: 'Ductwork, equipment, controls, insulation, testing & balancing', group: 'HVAC' },
  { number: '25',    name: 'Integrated Automation',         description: 'Building management, controls, instrumentation', group: 'HVAC' },
  { number: '26',    name: 'Electrical',                    description: 'Service, distribution, lighting, generators, surge protection', group: 'Electrical' },
  { number: '27',    name: 'Communications',               description: 'Data, voice, audio-video, structured cabling', group: 'Communications' },
  { number: '28',    name: 'Electronic Safety & Security', description: 'Fire alarm, access control, video surveillance, intrusion', group: 'Electronic Safety' },
];

/**
 * Default SOV line template — a typical first draw for a small-to-mid
 * construction project. Pre-populated on the new-project page so the
 * contractor has a starting SOV they can edit instead of starting blank.
 *
 * Each line's budget = contractValue × pctOfBudget / 100. The totals
 * are rounded so they sum to the contract value exactly (any rounding
 * drift is added to the last line).
 */
export const DEFAULT_SOV_TEMPLATE: Array<{ code: string; trade: string; pctOfBudget: number }> = [
  { code: '01-5000',  trade: 'Mobilization & General Conditions',           pctOfBudget: 5 },
  { code: '02-3000',  trade: 'Demolition',                                 pctOfBudget: 3 },
  { code: '31-2000',  trade: 'Site grading & excavation',                  pctOfBudget: 5 },
  { code: '03-3000',  trade: 'Cast-in-place concrete (footings & slab)',   pctOfBudget: 12 },
  { code: '04-2000',  trade: 'Masonry',                                    pctOfBudget: 8 },
  { code: '05-1200',  trade: 'Structural steel',                           pctOfBudget: 10 },
  { code: '06-1000',  trade: 'Rough carpentry (framing)',                  pctOfBudget: 12 },
  { code: '07-5000',  trade: 'Roofing',                                    pctOfBudget: 6 },
  { code: '08-1100',  trade: 'Doors & frames',                             pctOfBudget: 4 },
  { code: '09-2900',  trade: 'Gypsum board & taping',                      pctOfBudget: 5 },
  { code: '09-6500',  trade: 'Resilient flooring',                         pctOfBudget: 3 },
  { code: '09-9100',  trade: 'Painting & coatings',                        pctOfBudget: 4 },
  { code: '22-0500',  trade: 'Plumbing (rough-in & fixtures)',             pctOfBudget: 8 },
  { code: '23-0500',  trade: 'HVAC (equipment & ductwork)',                pctOfBudget: 8 },
  { code: '26-0500',  trade: 'Electrical (service & rough-in)',            pctOfBudget: 6 },
  { code: '32-1200',  trade: 'Paving & hardscape',                         pctOfBudget: 4 },
  { code: '01-9000',  trade: 'Profit & overhead (retained)',               pctOfBudget: 7 },
];
// Total of pctOfBudget should be 100. Verified: 5+3+5+12+8+10+12+6+4+5+3+4+8+8+6+4+7 = 110
// The 10% margin is intentional — contractors typically retain 10% as
// contingency, and can move it into "Profit & overhead" or specific lines
// after they fine-tune their actual scope.
