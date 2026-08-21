import { findJurisdiction, buildMapSearchUrl } from '@/lib/permits/jurisdictions';

interface JurisdictionCardProps {
  project: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    // Per-project override for the permit portal link.
    // When set, the project uses this URL instead of the
    // matched city's default. See Project.permitPortalUrl.
    permitPortalUrl?: string | null;
    permitPortalLabel?: string | null;
    permitPortalNotes?: string | null;
  };
}

export function JurisdictionCard({ project }: JurisdictionCardProps) {
  const j = findJurisdiction(project.city, project.state, project.zip);
  const mapUrl = buildMapSearchUrl(project);
  const hasAddress = Boolean(project.address || project.city || project.zip);

  // Portal link resolution: per-project override wins over
  // the matched city's default. The label follows the same
  // precedence so the user can see which one is in effect.
  const portalUrl = project.permitPortalUrl ?? j?.portalUrl ?? null;
  const portalLabel =
    project.permitPortalLabel ??
    j?.portalLabel ??
    (project.permitPortalUrl ? 'Project portal' : 'Open permit portal');
  const portalIsOverride = Boolean(project.permitPortalUrl);

  if (!hasAddress) {
    return (
      <div className="bg-cream-2 border-2 border-line p-4 text-center">
        <div className="text-2xl mb-1.5">🏛</div>
        <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          {'// Permit office'}
        </div>
        <div className="text-[12px] text-ink-50">Add a project address to see the local permit center</div>
      </div>
    );
  }

  if (!j) {
    return (
      <div className="bg-cream-2 border-2 border-line p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Permit office'}
          </div>
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30">
            not in directory
          </span>
        </div>
        <div className="text-[13px] text-ink-70 mb-2">
          We don&apos;t have permit center info for <b>{project.city || 'this location'}</b> yet.
        </div>
        <div className="text-[11px] text-ink-50">
          Search for &quot;{project.city} permit office&quot; or call your city hall.
        </div>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener"
            className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d hover:underline mt-2 inline-block"
          >
            Search on map →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-paper border-2 border-ink overflow-hidden">
      <div className="px-4 py-2 border-b-2 border-ink flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {'// Permit office'}
        </div>
        <div className="flex items-center gap-2">
          {portalIsOverride ? (
            <span
              className="text-[8px] font-mono uppercase tracking-[0.1em] text-orange border border-orange px-1"
              title="This project has a custom permit portal link that overrides the city default."
            >
              custom link
            </span>
          ) : null}
          <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-success rounded-full" /> matched
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-black text-[16px] leading-tight">{j.name}</h3>
          {j.avgReviewDays ? (
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.05em] bg-cream-2 border border-line flex-shrink-0">
              ~{j.avgReviewDays}d review
            </span>
          ) : null}
        </div>

        <dl className="space-y-2 text-[12px]">
          <Row label="Main" value={
            <a href={`tel:${j.phone.replace(/\D/g, '')}`} className="text-orange-d font-extrabold hover:underline">
              {j.phone}
            </a>
          } />
          {j.inspectionPhone && j.inspectionPhone !== j.phone ? (
            <Row label="Inspections" value={
              <a href={`tel:${j.inspectionPhone.replace(/\D/g, '')}`} className="text-orange-d font-extrabold hover:underline">
                {j.inspectionPhone}
              </a>
            } />
          ) : null}
          <Row label="Address" value={<span className="text-ink-70">{j.address}</span>} />
          <Row label="Hours" value={<span className="text-ink-70">{j.hours}</span>} />
          {j.website ? (
            <Row label="Website" value={
              <a href={j.website} target="_blank" rel="noopener" className="text-orange-d font-extrabold hover:underline break-all">
                {j.website.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            } />
          ) : null}
          {j.inspectionUrl ? (
            <Row label="Schedule inspection" value={
              <a href={j.inspectionUrl} target="_blank" rel="noopener" className="text-orange-d font-extrabold hover:underline break-all">
                {j.inspectionUrl.replace(/^https?:\/\/(www\.)?/, '').split('/').slice(0, 2).join('/') + '/…'}
              </a>
            } />
          ) : null}
        </dl>

        {portalUrl ? (
          <div className="mt-3">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener"
              className="block w-full text-center px-3 py-2.5 bg-ink text-cream text-[11px] font-mono uppercase tracking-[0.12em] font-extrabold hover:bg-orange-d transition-colors"
            >
              {portalLabel} →
            </a>
            <div className="mt-1.5 text-[10px] text-ink-50 font-mono break-all">
              {portalUrl.replace(/^https?:\/\/(www\.)?/, '')}
            </div>
            {project.permitPortalNotes ? (
              <div className="mt-2 px-3 py-2 bg-cream-2 border border-line text-[11px] text-ink-70 leading-relaxed">
                <span className="font-extrabold text-ink-50 mr-1">PROJECT NOTE:</span>
                {project.permitPortalNotes}
              </div>
            ) : null}
          </div>
        ) : null}

        {j.notes ? (
          <div className="mt-3 px-3 py-2 bg-cream-2 border border-line text-[11px] text-ink-70 leading-relaxed">
            <span className="font-extrabold text-ink-50 mr-1">NOTE:</span>
            {j.notes}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 w-[90px] flex-shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 min-w-0">{value}</dd>
    </div>
  );
}
