/**
 * Shape of the JSON the Python takeoff service returns.
 * Mirrors the `TakeoffResult` in takeoff-service/extractor.py.
 *
 * The DB stores the full result as `BimTakeoff.result Json?` — this
 * type is the contract the UI renders against. If the service
 * evolves, add fields here, don't break the existing ones.
 */
export type TakeoffKind = 'area' | 'length' | 'volume' | 'count';
export type TakeoffUnit = 'SF' | 'LF' | 'CY' | 'EA';

export interface TakeoffItem {
  csiCode: string;
  trade: string;
  kind: TakeoffKind;
  unit: TakeoffUnit;
  quantity: number;
  elementCount: number;
  /** Elements found but with no usable quantity data. The UI MUST
   *  surface this — a "looks low" total that hides the gap is a
   *  bid error waiting to happen. */
  elementsMissingQuantity: number;
}

export interface TakeoffResult {
  schema: string;        // e.g. "IFC4"
  projectName: string | null;
  totalElements: number;
  items: TakeoffItem[];
}

/** Body POSTed to /takeoff */
export interface TakeoffRequestBody {
  url: string;
}

/** What we store on the takeoffs list page (one row per run) */
export interface TakeoffSummary {
  id: string;
  bimModelId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  result: TakeoffResult | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A line the user is going to push to the SOV. */
export interface TakeoffSovLine {
  csiCode: string;
  trade: string;
  budget: number; // quantity * unit cost, computed client-side
}
