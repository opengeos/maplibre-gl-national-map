import type { Map as MapLibreMap } from 'maplibre-gl';
import type { NationalMapService } from '../data/catalog';
import { buildLayerSpec } from '../data/sourceSpec';
import { clamp } from '../utils';

/**
 * A National Map service currently added to the map.
 */
export interface ActiveLayer {
  service: NationalMapService;
  sourceId: string;
  layerId: string;
  visible: boolean;
  opacity: number;
}

/**
 * Manages National Map raster layers on a MapLibre map: adding, removing,
 * toggling visibility, and adjusting opacity. Encapsulates the MapLibre
 * ordering quirks (layers must be removed before their sources) and guards
 * against duplicate ids.
 */
export class LayerManager {
  private _map: MapLibreMap;
  private _layers: globalThis.Map<string, ActiveLayer> = new globalThis.Map();

  /**
   * Creates a LayerManager bound to a map.
   *
   * @param map - The MapLibre GL map instance
   */
  constructor(map: MapLibreMap) {
    this._map = map;
  }

  /**
   * Adds a service to the map as a raster source + layer.
   *
   * @param service - The service to add
   * @returns The tracked active layer, or null if it was already added
   */
  add(service: NationalMapService): ActiveLayer | null {
    if (this._layers.has(service.id)) return null;

    const spec = buildLayerSpec(service);
    if (this._map.getSource(spec.sourceId)) return null;

    this._map.addSource(spec.sourceId, spec.source);
    this._map.addLayer(spec.layer);

    const active: ActiveLayer = {
      service,
      sourceId: spec.sourceId,
      layerId: spec.layerId,
      visible: true,
      opacity: 1,
    };
    this._layers.set(service.id, active);
    return active;
  }

  /**
   * Removes a service's layer and source from the map.
   *
   * @param serviceId - The service id (e.g. "basemap/USGSTopo")
   */
  remove(serviceId: string): void {
    const active = this._layers.get(serviceId);
    if (!active) return;

    // Layer must be removed before its source, or MapLibre throws.
    if (this._map.getLayer(active.layerId)) {
      this._map.removeLayer(active.layerId);
    }
    if (this._map.getSource(active.sourceId)) {
      this._map.removeSource(active.sourceId);
    }
    this._layers.delete(serviceId);
  }

  /**
   * Shows or hides a service's layer.
   *
   * @param serviceId - The service id
   * @param visible - Whether the layer should be visible
   */
  setVisibility(serviceId: string, visible: boolean): void {
    const active = this._layers.get(serviceId);
    if (!active) return;

    this._map.setLayoutProperty(active.layerId, 'visibility', visible ? 'visible' : 'none');
    active.visible = visible;
  }

  /**
   * Sets a service layer's opacity.
   *
   * @param serviceId - The service id
   * @param opacity - Opacity in the range [0, 1] (clamped)
   */
  setOpacity(serviceId: string, opacity: number): void {
    const active = this._layers.get(serviceId);
    if (!active) return;

    const clamped = clamp(opacity, 0, 1);
    this._map.setPaintProperty(active.layerId, 'raster-opacity', clamped);
    active.opacity = clamped;
  }

  /**
   * Checks whether a service is currently added.
   *
   * @param serviceId - The service id
   */
  has(serviceId: string): boolean {
    return this._layers.has(serviceId);
  }

  /**
   * Lists active layers in the order they were added.
   */
  list(): ActiveLayer[] {
    return [...this._layers.values()];
  }

  /**
   * Removes all managed layers and sources (used on control teardown).
   */
  removeAll(): void {
    for (const serviceId of [...this._layers.keys()]) {
      this.remove(serviceId);
    }
  }
}
