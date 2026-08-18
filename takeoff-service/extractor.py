"""
IFC -> per-trade quantity takeoff.

Strategy (in order of trust):
  1. Read BaseQuantities (Qto_* property sets) that Revit/IFC exporters
     attach to elements — these are the authoritative numbers.
  2. Fall back to counting when no quantity set exists (fixtures etc.
     are count-based anyway).

All lengths/areas/volumes are converted from the file's declared unit
to imperial: LF, SF, CY. Counts are EA. The "export base quantities"
checkbox in Revit's IFC export dialog controls whether step 1
produces any output — see the README.

LGPL note: ifcopenshell is LGPL, which permits commercial use as a
dynamically linked library. We do NOT copy any of its source into
this repo or the CMS.
"""
from collections import defaultdict

import ifcopenshell
import ifcopenshell.util.element as el_util
import ifcopenshell.util.unit as unit_util

# IFC class -> (CSI division code, trade name, quantity kind)
# quantity kind: "area" | "length" | "volume" | "count"
TRADE_MAP = [
    # Concrete
    ("IfcFooting",            "03-3000", "Cast-in-place concrete — footings",   "volume"),
    ("IfcSlab",               "03-3000", "Cast-in-place concrete — slabs",      "volume"),
    # Structural steel
    ("IfcBeam",               "05-1200", "Structural steel — beams",            "length"),
    ("IfcColumn",             "05-1200", "Structural steel — columns",          "count"),
    ("IfcMember",             "05-1200", "Structural steel — misc members",     "length"),
    # Walls / framing / drywall (TODO: classify masonry by material)
    ("IfcWall",               "09-2900", "Walls / gypsum board assemblies",     "area"),
    ("IfcWallStandardCase",   "09-2900", "Walls / gypsum board assemblies",     "area"),
    # Doors & windows
    ("IfcDoor",               "08-1000", "Doors & frames",                      "count"),
    ("IfcWindow",             "08-5000", "Windows",                             "count"),
    # Roofing
    ("IfcRoof",               "07-5000", "Roofing",                             "area"),
    # Floor/ceiling finishes
    ("IfcCovering",           "09-6000", "Finishes — flooring/ceiling/covering","area"),
    # Plumbing
    ("IfcPipeSegment",        "22-1000", "Plumbing — piping",                   "length"),
    ("IfcPipeFitting",        "22-1000", "Plumbing — fittings",                 "count"),
    ("IfcSanitaryTerminal",   "22-4000", "Plumbing — fixtures",                 "count"),
    ("IfcValve",              "22-1000", "Plumbing — valves",                   "count"),
    # HVAC
    ("IfcDuctSegment",        "23-3000", "HVAC — ductwork",                     "length"),
    ("IfcDuctFitting",        "23-3000", "HVAC — duct fittings",                "count"),
    ("IfcAirTerminal",        "23-3000", "HVAC — air terminals/diffusers",      "count"),
    ("IfcUnitaryEquipment",   "23-7000", "HVAC — equipment",                    "count"),
    ("IfcBoiler",             "23-5000", "HVAC — heating equipment",            "count"),
    # Electrical
    ("IfcCableCarrierSegment","26-0500", "Electrical — cable tray/conduit",     "length"),
    ("IfcCableSegment",       "26-0500", "Electrical — cable/wire",             "length"),
    ("IfcLightFixture",       "26-5000", "Electrical — light fixtures",         "count"),
    ("IfcOutlet",             "26-2700", "Electrical — outlets/devices",        "count"),
    ("IfcSwitchingDevice",    "26-2700", "Electrical — switches",               "count"),
    ("IfcElectricDistributionBoard", "26-2400", "Electrical — panels",          "count"),
    # Fire protection
    ("IfcFireSuppressionTerminal", "21-1000", "Fire protection — sprheads",     "count"),
    # Sitework-ish
    ("IfcStair",              "05-5000", "Stairs",                              "count"),
    ("IfcRailing",            "05-5200", "Railings",                            "length"),
]

# Which Qto quantity names to try, per kind. Exporters vary in what
# they populate — we walk this list in order and take the first
# positive value. Net before Gross is intentional: net excludes
# openings (better bid accuracy for wall finishes).
QTY_NAMES = {
    "area":   ["NetSideArea", "GrossSideArea", "NetArea", "GrossArea", "OuterSurfaceArea"],
    "length": ["Length", "NominalLength"],
    "volume": ["NetVolume", "GrossVolume"],
}

M_TO_FT = 3.28084
M2_TO_SF = 10.7639
M3_TO_CY = 1.30795

KIND_EXPONENT = {"length": 1, "area": 2, "volume": 3}


def _find_quantity(element, kind: str, scale: float):
    """Pull the first matching base quantity, scale to meters, then
    convert to imperial. Returns None if no usable quantity is found
    — caller bumps `missingQty` so the UI can surface the gap."""
    psets = el_util.get_psets(element, qtos_only=True)
    for qset in psets.values():
        for name in QTY_NAMES.get(kind, []):
            val = qset.get(name)
            if isinstance(val, (int, float)) and val > 0:
                si = val * scale ** KIND_EXPONENT[kind]
                if kind == "length":
                    return si * M_TO_FT
                if kind == "area":
                    return si * M2_TO_SF
                if kind == "volume":
                    return si * M3_TO_CY
    return None


def run_takeoff(path: str) -> dict:
    model = ifcopenshell.open(path)
    # scale converts the file's declared length unit to meters.
    # Revit files exported as meters will have scale=1; imperial
    # files (feet) will have scale=0.3048. NEVER assume one or the
    # other — this is the #1 source of wrong takeoff numbers.
    scale = unit_util.calculate_unit_scale(model)

    buckets: dict[tuple, dict] = defaultdict(
        lambda: {"quantity": 0.0, "count": 0, "missingQty": 0}
    )

    for ifc_class, csi, trade, kind in TRADE_MAP:
        try:
            elements = model.by_type(ifc_class)
        except RuntimeError:
            # Class not in this schema version (IFC2x3 vs IFC4 vs IFC4X3)
            continue
        for e in elements:
            key = (csi, trade, kind)
            b = buckets[key]
            b["count"] += 1
            if kind == "count":
                b["quantity"] += 1
            else:
                q = _find_quantity(e, kind, scale)
                if q is None:
                    b["missingQty"] += 1
                else:
                    b["quantity"] += q

    unit_label = {"area": "SF", "length": "LF", "volume": "CY", "count": "EA"}
    items = []
    for (csi, trade, kind), b in sorted(buckets.items()):
        if b["count"] == 0:
            continue
        items.append({
            "csiCode": csi,
            "trade": trade,
            "kind": kind,
            "unit": unit_label[kind],
            "quantity": round(b["quantity"], 1),
            "elementCount": b["count"],
            # Surface in the UI: the user needs to know the number
            # is incomplete. Never hide this.
            "elementsMissingQuantity": b["missingQty"],
        })

    project = next(iter(model.by_type("IfcProject")), None)
    return {
        "schema": model.schema,  # e.g. "IFC4"
        "projectName": project.Name if project else None,
        "totalElements": sum(i["elementCount"] for i in items),
        "items": items,
    }
