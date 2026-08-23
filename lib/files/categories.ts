// File category definitions — used by the sidebar, upload form, and
// everywhere else that needs to render the same list. Keep this in sync
// with the schema's `category` field (a free-form string in the DB).
export interface FileCategory {
  id: string;
  label: string;
}

// "all" is a virtual category (matches every file), not a stored value.
export const FILE_CATEGORIES: readonly FileCategory[] = [
  { id: 'all',           label: 'All Files' },
  { id: 'brochures',     label: 'Brochures' },
  { id: 'marketing',     label: 'Marketing' },
  { id: 'floorplans',    label: 'Floorplans' },
  { id: 'contracts',     label: 'Contracts' },
  { id: 'site_photos',   label: 'Site Photos' },
  { id: 'submittals',    label: 'Submittals' },
  { id: 'invoices',      label: 'Invoices' },
  { id: 'drawings',      label: 'Drawings' },
  // CM compliance suite (Aug 2026)
  { id: 'change_orders', label: 'Change Orders' },
  { id: 'lien_waivers',  label: 'Lien Waivers' },
];

// Categories the user can pick when uploading (everything except 'all').
export const UPLOAD_CATEGORIES: readonly FileCategory[] = FILE_CATEGORIES.filter(
  (c) => c.id !== 'all',
).concat([{ id: 'other', label: 'Other' }]);

export function getCategoryLabel(id: string | null | undefined): string {
  if (!id) return 'Uncategorized';
  return FILE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
