import { fetchWeatherForAddress, projectAddressToQuery, cToF, type WeatherData } from '@/lib/weather/api';
import { buildMapSearchUrl } from '@/lib/permits/jurisdictions';

interface WeatherWidgetProps {
  project: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
}

export async function WeatherWidget({ project }: WeatherWidgetProps) {
  const query = projectAddressToQuery(project);
  if (!query) {
    return (
      <div className="bg-cream-2 border-2 border-line p-4 text-center">
        <div className="text-2xl mb-1.5">🌤</div>
        <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
          {'// Weather'}
        </div>
        <div className="text-[12px] text-ink-50">Add a project address to see live weather</div>
      </div>
    );
  }

  let data: WeatherData | null = null;
  try {
    data = await fetchWeatherForAddress(query);
  } catch {
    data = null;
  }

  const mapUrl = buildMapSearchUrl(project);

  if (!data) {
    return (
      <div className="bg-cream-2 border-2 border-line p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-50">
            {'// Weather'}
          </div>
          <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30">
            unavailable
          </span>
        </div>
        <div className="text-[12px] text-ink-70">
          Couldn&apos;t reach the weather service for {project.city || 'this location'}.
        </div>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener"
            className="text-[10px] font-mono uppercase tracking-[0.1em] text-orange-d hover:underline mt-2 inline-block"
          >
            View on map →
          </a>
        ) : null}
      </div>
    );
  }

  const { location, current, daily } = data;

  return (
    <div className="bg-cream-2 border-2 border-ink overflow-hidden">
      <div className="px-4 py-2 border-b border-line flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {'// Live weather'}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-30">
          updated {new Date(data.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      {/* Current + location */}
      <div className="p-4 flex items-center gap-4">
        <div className="text-5xl leading-none flex-shrink-0" aria-hidden>
          {current.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-3xl leading-none">
            {cToF(current.temperature)}°<span className="text-ink-50 text-lg font-extrabold ml-0.5">F</span>
          </div>
          <div className="text-[12px] text-ink-70 mt-1 truncate">
            {current.description}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1 truncate">
            {location.name}{location.admin1 ? `, ${location.admin1}` : ''}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">FEELS</div>
          <div className="font-extrabold text-[14px]">{cToF(current.feelsLike)}°</div>
          <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1">WIND</div>
          <div className="font-extrabold text-[14px]">{Math.round(current.windSpeed)} km/h</div>
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="border-t border-line grid grid-cols-7 divide-x divide-line-soft bg-paper">
        {daily.slice(0, 7).map((d) => {
          const day = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
          return (
            <div key={d.date} className="p-2 text-center">
              <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
                {day}
              </div>
              <div className="text-xl leading-none my-1.5" aria-hidden>{d.icon}</div>
              <div className="font-extrabold text-[11px] leading-none">{cToF(d.high)}°</div>
              <div className="text-[10px] text-ink-50 leading-none mt-0.5">{cToF(d.low)}°</div>
              {d.precipitationProbability > 20 ? (
                <div className="text-[8px] font-mono text-[var(--ink-2)] mt-1">
                  {d.precipitationProbability}%
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-line flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
        <a
          href={`https://open-meteo.com/`}
          target="_blank"
          rel="noopener"
          className="hover:text-ink"
        >
          open-meteo
        </a>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener"
            className="text-orange-d hover:underline"
          >
            map →
          </a>
        ) : null}
      </div>
    </div>
  );
}
