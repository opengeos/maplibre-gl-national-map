/**
 * Pure builders that turn a NationalMapService into MapLibre raster source and
 * layer specifications. No DOM or map access; fully unit-testable.
 */

import type { RasterLayerSpecification, RasterSourceSpecification } from 'maplibre-gl';
import { NATIONAL_MAP_HOSTS, type NationalMapService } from './catalog';

/**
 * A ready-to-add MapLibre source/layer pair for a National Map service.
 */
export interface LayerSpec {
  sourceId: string;
  layerId: string;
  source: RasterSourceSpecification;
  layer: RasterLayerSpecification;
}

/** Replaces characters MapLibre ids should not contain. */
function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Deterministic MapLibre source id for a service, e.g. "nm-basemap-USGSTopo".
 *
 * @param service - The service to derive the id from
 */
export function sourceIdFor(service: NationalMapService): string {
  return `nm-${service.host}-${sanitize(service.name)}`;
}

/**
 * Deterministic MapLibre layer id for a service, e.g. "nm-basemap-USGSTopo-layer".
 *
 * @param service - The service to derive the id from
 */
export function layerIdFor(service: NationalMapService): string {
  return `${sourceIdFor(service)}-layer`;
}

/** Tile size used for all sources. Required to be 256 for {bbox-epsg-3857}
 * substitution to produce correctly aligned dynamic-export imagery. */
const TILE_SIZE = 256;

/** Builds the tile/export URL template for a service. */
function tileUrlFor(service: NationalMapService): string {
  const base = `${NATIONAL_MAP_HOSTS[service.host]}/${service.name}/${service.type}`;

  switch (service.renderMode) {
    case 'tile':
      return `${base}/tile/{z}/{y}/{x}`;
    case 'export':
      return (
        `${base}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857` +
        `&size=${TILE_SIZE},${TILE_SIZE}&format=png32&transparent=true&f=image`
      );
    case 'exportImage': {
      const renderingRule = service.renderingRule
        ? `&renderingRule=${encodeURIComponent(service.renderingRule)}`
        : '';
      return (
        `${base}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857` +
        `&size=${TILE_SIZE},${TILE_SIZE}&format=png${renderingRule}&f=image`
      );
    }
  }
}

/**
 * Builds the MapLibre raster source and layer specifications for a service.
 *
 * @param service - The service to build specs for
 * @returns Source/layer ids and specifications ready for map.addSource/addLayer
 */
export function buildLayerSpec(service: NationalMapService): LayerSpec {
  const sourceId = sourceIdFor(service);
  const layerId = layerIdFor(service);

  const source: RasterSourceSpecification = {
    type: 'raster',
    tiles: [tileUrlFor(service)],
    tileSize: TILE_SIZE,
  };
  if (service.attribution) source.attribution = service.attribution;
  if (service.minzoom !== undefined) source.minzoom = service.minzoom;
  if (service.maxzoom !== undefined) source.maxzoom = service.maxzoom;

  const layer: RasterLayerSpecification = {
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': 1,
    },
  };

  return { sourceId, layerId, source, layer };
}
