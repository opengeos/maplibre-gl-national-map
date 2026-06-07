import { describe, it, expect } from 'vitest';
import { STATIC_CATALOG } from '../src/lib/data/catalog';
import { filterServices, groupByCategory, CATEGORY_ORDER } from '../src/lib/data/filter';

describe('filterServices', () => {
  it('returns all services for an empty or whitespace query', () => {
    expect(filterServices(STATIC_CATALOG, '')).toEqual(STATIC_CATALOG);
    expect(filterServices(STATIC_CATALOG, '   ')).toEqual(STATIC_CATALOG);
  });

  it('matches case-insensitively against the title', () => {
    const results = filterServices(STATIC_CATALOG, 'usgs topo');
    expect(results.some((s) => s.id === 'basemap/USGSTopo')).toBe(true);
  });

  it('matches against the service name', () => {
    const results = filterServices(STATIC_CATALOG, 'NHDPlus_HR');
    expect(results.some((s) => s.id === 'hydro/NHDPlus_HR')).toBe(true);
  });

  it('matches against the description', () => {
    const results = filterServices(STATIC_CATALOG, 'hillshade');
    expect(results.some((s) => s.id === 'elevation/3DEPElevation')).toBe(true);
  });

  it('matches against the category', () => {
    const results = filterServices(STATIC_CATALOG, 'indexes');
    const indexServices = STATIC_CATALOG.filter((s) => s.category === 'Indexes');
    for (const service of indexServices) {
      expect(results).toContain(service);
    }
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterServices(STATIC_CATALOG, 'zzz-no-such-service')).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('groups all static services in the fixed category order', () => {
    const groups = groupByCategory(STATIC_CATALOG);
    expect(groups.map((g) => g.category)).toEqual(CATEGORY_ORDER);
  });

  it('omits empty groups', () => {
    const basemapsOnly = STATIC_CATALOG.filter((s) => s.category === 'Basemaps');
    const groups = groupByCategory(basemapsOnly);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('Basemaps');
    expect(groups[0].services).toEqual(basemapsOnly);
  });

  it('returns no groups for an empty input', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
