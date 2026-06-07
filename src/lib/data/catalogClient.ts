/**
 * Live catalog client: fetches the ArcGIS REST service listings from the
 * National Map hosts and merges them with the built-in static catalog.
 */

import {
  HOST_CATEGORY,
  NATIONAL_MAP_HOSTS,
  STATIC_CATALOG,
  type NationalMapHost,
  type NationalMapService,
  type ServiceRenderMode,
  type ServiceType,
} from './catalog';

/**
 * Shape of an ArcGIS REST `services?f=json` root listing.
 */
export interface RawArcgisCatalog {
  services?: { name: string; type: string }[];
  folders?: string[];
}

const SUPPORTED_TYPES: ServiceType[] = ['MapServer', 'ImageServer'];

/**
 * Infers how a service should be rendered when it is not in the static catalog.
 * Cached basemap tiles are only known for the basemap host; other MapServers
 * default to the dynamic export endpoint, which works for both cached and
 * dynamic services.
 */
function inferRenderMode(host: NationalMapHost, type: ServiceType): ServiceRenderMode {
  if (type === 'ImageServer') return 'exportImage';
  if (host === 'basemap') return 'tile';
  return 'export';
}

/**
 * Parses one host's ArcGIS REST listing into NationalMapService entries.
 * Entries present in `staticById` keep their curated title/description and
 * render settings; unknown services get sensible defaults.
 *
 * @param host - The National Map host the listing came from
 * @param raw - The parsed `services?f=json` response
 * @param staticById - Static catalog entries keyed by service id
 * @returns Services discovered in the listing
 */
export function parseHostCatalog(
  host: NationalMapHost,
  raw: RawArcgisCatalog,
  staticById: globalThis.Map<string, NationalMapService>,
): NationalMapService[] {
  const services: NationalMapService[] = [];

  for (const entry of raw.services ?? []) {
    if (!entry?.name || !SUPPORTED_TYPES.includes(entry.type as ServiceType)) {
      continue;
    }
    // Folder-qualified names (e.g. "Utilities/Geometry") are internal helpers.
    if (entry.name.includes('/')) {
      continue;
    }

    const type = entry.type as ServiceType;
    const id = `${host}/${entry.name}`;
    const known = staticById.get(id);

    if (known) {
      services.push(known);
      continue;
    }

    services.push({
      id,
      host,
      category: HOST_CATEGORY[host],
      name: entry.name,
      type,
      title: entry.name,
      description: '',
      renderMode: inferRenderMode(host, type),
      attribution: 'USGS The National Map',
    });
  }

  return services;
}

/**
 * Merges live catalog entries over the static catalog. Static entries are kept
 * even when missing from the live listing (network hiccups should not hide
 * curated services), and live-only services are appended.
 *
 * @param staticCatalog - The built-in catalog
 * @param live - Services discovered from live listings
 * @returns The merged catalog, static order first, new live services last
 */
export function mergeCatalog(
  staticCatalog: NationalMapService[],
  live: NationalMapService[],
): NationalMapService[] {
  const staticIds = new Set(staticCatalog.map((s) => s.id));
  const liveOnly = live.filter((s) => !staticIds.has(s.id));
  return [...staticCatalog, ...liveOnly];
}

/**
 * Fetches the live service listings from all National Map hosts and merges
 * them with the static catalog. Never rejects: any host failure falls back to
 * the static entries for that host.
 *
 * @param signal - Optional abort signal to cancel in-flight requests
 * @returns The merged catalog (the static catalog if everything fails)
 */
export async function fetchCatalog(signal?: AbortSignal): Promise<NationalMapService[]> {
  const staticById = new globalThis.Map(STATIC_CATALOG.map((s) => [s.id, s]));
  const hosts = Object.keys(NATIONAL_MAP_HOSTS) as NationalMapHost[];

  const results = await Promise.allSettled(
    hosts.map(async (host) => {
      const response = await fetch(`${NATIONAL_MAP_HOSTS[host]}?f=json`, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const raw = (await response.json()) as RawArcgisCatalog;
      return parseHostCatalog(host, raw, staticById);
    }),
  );

  const live = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );

  return mergeCatalog(STATIC_CATALOG, live);
}
