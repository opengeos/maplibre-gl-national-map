import { describe, it, expect } from 'vitest';
import { STATIC_CATALOG } from '../src/lib/data/catalog';
import { buildLayerSpec, sourceIdFor, layerIdFor } from '../src/lib/data/sourceSpec';

const topo = STATIC_CATALOG.find((s) => s.id === 'basemap/USGSTopo')!;
const contours = STATIC_CATALOG.find((s) => s.id === 'carto/contours')!;
const elevation = STATIC_CATALOG.find((s) => s.id === 'elevation/3DEPElevation')!;

describe('sourceIdFor / layerIdFor', () => {
  it('produces deterministic, prefixed ids', () => {
    expect(sourceIdFor(topo)).toBe('nm-basemap-USGSTopo');
    expect(layerIdFor(topo)).toBe('nm-basemap-USGSTopo-layer');
  });

  it('sanitizes characters not allowed in ids', () => {
    const weird = { ...contours, id: 'carto/My Service/v2.0' };
    expect(sourceIdFor(weird)).toBe('nm-carto-My-Service-v2-0');
  });

  it('produces unique ids across the static catalog', () => {
    const ids = STATIC_CATALOG.map(sourceIdFor);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildLayerSpec', () => {
  it('builds a cached tile source for tile services', () => {
    const spec = buildLayerSpec(topo);
    expect(spec.source.type).toBe('raster');
    expect(spec.source.tileSize).toBe(256);
    expect(spec.source.tiles).toEqual([
      'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    ]);
    expect(spec.source.maxzoom).toBe(16);
    expect(spec.source.attribution).toBe('USGS The National Map');
  });

  it('builds a dynamic export source for export services', () => {
    const spec = buildLayerSpec(contours);
    const url = spec.source.tiles![0];
    expect(url).toContain(
      'https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/export?',
    );
    expect(url).toContain('bbox={bbox-epsg-3857}');
    expect(url).toContain('bboxSR=3857');
    expect(url).toContain('imageSR=3857');
    expect(url).toContain('size=256,256');
    expect(url).toContain('format=png32');
    expect(url).toContain('transparent=true');
    expect(url).toContain('f=image');
    expect(spec.source.tileSize).toBe(256);
  });

  it('builds an exportImage source with rendering rule for ImageServer services', () => {
    const spec = buildLayerSpec(elevation);
    const url = spec.source.tiles![0];
    expect(url).toContain(
      'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?',
    );
    expect(url).toContain('bbox={bbox-epsg-3857}');
    expect(url).toContain('format=png');
    expect(url).toContain(`renderingRule=${encodeURIComponent(elevation.renderingRule!)}`);
    expect(url).toContain('f=image');
    expect(spec.source.tileSize).toBe(256);
  });

  it('omits the rendering rule when the service has none', () => {
    const noRule = { ...elevation, renderingRule: undefined };
    const url = buildLayerSpec(noRule).source.tiles![0];
    expect(url).not.toContain('renderingRule');
  });

  it('wires the layer to its source with full default opacity', () => {
    const spec = buildLayerSpec(topo);
    expect(spec.layer.id).toBe(spec.layerId);
    expect(spec.layer.type).toBe('raster');
    expect(spec.layer.source).toBe(spec.sourceId);
    expect(spec.layer.paint).toEqual({ 'raster-opacity': 1 });
  });

  it('omits zoom bounds when the service has none', () => {
    const spec = buildLayerSpec(contours);
    expect(spec.source.minzoom).toBeUndefined();
    expect(spec.source.maxzoom).toBeUndefined();
  });
});
