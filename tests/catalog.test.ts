import { describe, it, expect } from 'vitest';
import {
  STATIC_CATALOG,
  HOST_CATEGORY,
  NATIONAL_MAP_HOSTS,
  type NationalMapService,
} from '../src/lib/data/catalog';
import {
  parseHostCatalog,
  mergeCatalog,
  type RawArcgisCatalog,
} from '../src/lib/data/catalogClient';

const staticById = new Map(STATIC_CATALOG.map((s) => [s.id, s]));

describe('STATIC_CATALOG', () => {
  it('contains the five cached basemap services', () => {
    const basemaps = STATIC_CATALOG.filter((s) => s.host === 'basemap');
    expect(basemaps.map((s) => s.name).sort()).toEqual([
      'USGSHydroCached',
      'USGSImageryOnly',
      'USGSImageryTopo',
      'USGSShadedReliefOnly',
      'USGSTopo',
    ]);
    expect(basemaps.every((s) => s.renderMode === 'tile')).toBe(true);
  });

  it('uses unique ids', () => {
    const ids = STATIC_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each service a service URL matching its type', () => {
    for (const service of STATIC_CATALOG) {
      expect(service.serviceUrl).toMatch(/^https:\/\//);
      expect(service.serviceUrl.endsWith(`/${service.type}`)).toBe(true);
    }
  });

  it('defaults nationalmap-hosted services to their host category', () => {
    const hosted = STATIC_CATALOG.filter((s) => s.host && s.category === HOST_CATEGORY[s.host!]);
    expect(hosted.length).toBeGreaterThan(0);
  });

  it('renders the 3DEP ImageServer via exportImage with a hillshade rule', () => {
    const elevation = STATIC_CATALOG.find((s) => s.id === 'elevation/3DEPElevation');
    expect(elevation?.type).toBe('ImageServer');
    expect(elevation?.renderMode).toBe('exportImage');
    expect(elevation?.renderingRule).toContain('Hillshade');
  });

  it('covers all live-fetched nationalmap hosts', () => {
    const hosts = new Set(STATIC_CATALOG.flatMap((s) => (s.host ? [s.host] : [])));
    expect([...hosts].sort()).toEqual(Object.keys(NATIONAL_MAP_HOSTS).sort());
  });

  it('includes partner-hosted services', () => {
    const partnerIds = STATIC_CATALOG.filter((s) => !s.host).map((s) => s.id);
    expect(partnerIds).toEqual(
      expect.arrayContaining(['fema/NFHL', 'esri/USA_Topo_Maps', 'blm/PLSS', 'fws/Wetlands']),
    );
  });
});

describe('parseHostCatalog', () => {
  it('reuses curated static entries for known services', () => {
    const raw: RawArcgisCatalog = {
      services: [
        { name: 'USGSTopo', type: 'MapServer' },
        { name: 'USGSImageryOnly', type: 'MapServer' },
      ],
    };
    const parsed = parseHostCatalog('basemap', raw, staticById);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toBe(staticById.get('basemap/USGSTopo'));
    expect(parsed[0].title).toBe('USGS Topo');
  });

  it('infers exportImage for unknown ImageServer services', () => {
    const raw: RawArcgisCatalog = {
      services: [{ name: 'NewElevation', type: 'ImageServer' }],
    };
    const [parsed] = parseHostCatalog('elevation', raw, staticById);
    expect(parsed.renderMode).toBe('exportImage');
    expect(parsed.category).toBe('Elevation');
    expect(parsed.title).toBe('NewElevation');
  });

  it('infers tile for unknown basemap MapServers and export elsewhere', () => {
    const basemapRaw: RawArcgisCatalog = {
      services: [{ name: 'USGSNewBasemap', type: 'MapServer' }],
    };
    const [basemap] = parseHostCatalog('basemap', basemapRaw, staticById);
    expect(basemap.renderMode).toBe('tile');

    const cartoRaw: RawArcgisCatalog = {
      services: [{ name: 'new_layer', type: 'MapServer' }],
    };
    const [carto] = parseHostCatalog('carto', cartoRaw, staticById);
    expect(carto.renderMode).toBe('export');
  });

  it('skips unsupported types and folder-qualified names', () => {
    const raw: RawArcgisCatalog = {
      services: [
        { name: 'wbd', type: 'FeatureServer' },
        { name: 'Utilities/Geometry', type: 'MapServer' },
        { name: 'nhd', type: 'MapServer' },
      ],
      folders: ['Utilities'],
    };
    const parsed = parseHostCatalog('hydro', raw, staticById);
    expect(parsed.map((s) => s.name)).toEqual(['nhd']);
  });

  it('handles an empty or malformed listing', () => {
    expect(parseHostCatalog('carto', {}, staticById)).toEqual([]);
    expect(parseHostCatalog('carto', { services: [] }, staticById)).toEqual([]);
  });
});

describe('mergeCatalog', () => {
  it('keeps static entries even when missing from live results', () => {
    const merged = mergeCatalog(STATIC_CATALOG, []);
    expect(merged).toEqual(STATIC_CATALOG);
  });

  it('appends live-only services after the static catalog', () => {
    const liveOnly: NationalMapService = {
      id: 'carto/brand_new',
      host: 'carto',
      category: 'Cartography',
      name: 'brand_new',
      type: 'MapServer',
      title: 'brand_new',
      description: '',
      renderMode: 'export',
    };
    const merged = mergeCatalog(STATIC_CATALOG, [
      staticById.get('carto/contours')!,
      liveOnly,
    ]);
    expect(merged).toHaveLength(STATIC_CATALOG.length + 1);
    expect(merged.at(-1)).toBe(liveOnly);
  });

  it('does not duplicate services present in both static and live', () => {
    const merged = mergeCatalog(STATIC_CATALOG, [...STATIC_CATALOG]);
    expect(merged).toHaveLength(STATIC_CATALOG.length);
  });
});
