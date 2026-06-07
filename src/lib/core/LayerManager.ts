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
 * Options for the LayerManager.
 */
export interface LayerManagerOptions {
  /**
   * Existing layer id to insert added layers before, so they render
   * underneath it. Ignored when the layer does not exist on the map.
   */
  beforeId?: string;
}

/**
 * Manages National Map raster layers on a MapLibre map: adding, removing,
 * toggling visibility, and adjusting opacity. Encapsulates the MapLibre
 * ordering quirks (layers must be removed before their sources) and guards
 * against duplicate ids.
 */
export class LayerManager {
  private _map: MapLibreMap;
  private _beforeId?: string;
  private _layers: globalThis.Map<string, ActiveLayer> = new globalThis.Map();

  /**
   * Creates a LayerManager bound to a map.
   *
   * @param map - The MapLibre GL map instance
   * @param options - Optional settings such as the beforeId insertion point
   */
  constructor(map: MapLibreMap, options?: LayerManagerOptions) {
    this._map = map;
    this._beforeId = options?.beforeId;
  }

  /**
   * Adds a service to the map as a raster source + layer.
   *
   * If the map already has the service's native source (deterministic ids from
   * buildLayerSpec), this adopts it instead of failing: the existing source is
   * reused, the layer is created only when missing, and the tracked entry
   * reflects the layer's current visibility/opacity. This lets host
   * applications that persist and restore the control's native source/layer
   * (re)gain control of those layers.
   *
   * @param service - The service to add
   * @returns The tracked active layer, or null if the service is already tracked
   */
  add(service: NationalMapService): ActiveLayer | null {
    if (this._layers.has(service.id)) return null;

    const spec = buildLayerSpec(service);

    // Insert before the configured layer when it exists so added services
    // render underneath it (e.g. below a label layer).
    const beforeId =
      this._beforeId && this._map.getLayer(this._beforeId) ? this._beforeId : undefined;

    if (this._map.getSource(spec.sourceId)) {
      // Adopt a source the host already created. Add the layer only if it is
      // missing, then read current map state for the tracked entry.
      if (!this._map.getLayer(spec.layerId)) {
        this._map.addLayer(spec.layer, beforeId);
      }
    } else {
      this._map.addSource(spec.sourceId, spec.source);
      this._map.addLayer(spec.layer, beforeId);
    }

    // Read current map state where possible so an adopted layer keeps its
    // existing visibility/opacity (defaults match a freshly created layer).
    const visible = this._map.getLayoutProperty(spec.layerId, 'visibility') !== 'none';
    const rasterOpacity = this._map.getPaintProperty(spec.layerId, 'raster-opacity');
    const opacity = typeof rasterOpacity === 'number' ? rasterOpacity : 1;

    const active: ActiveLayer = {
      service,
      sourceId: spec.sourceId,
      layerId: spec.layerId,
      visible,
      opacity,
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
   * Gets the current insertion-point layer id, if any.
   */
  getBeforeId(): string | undefined {
    return this._beforeId;
  }

  /**
   * Changes the insertion-point layer and re-anchors all managed layers
   * beneath it (or to the top of the style when cleared/missing).
   *
   * @param beforeId - Layer id to insert before, or undefined for top
   */
  setBeforeId(beforeId?: string): void {
    this._beforeId = beforeId;
    const target = beforeId && this._map.getLayer(beforeId) ? beforeId : undefined;
    for (const layer of this._layers.values()) {
      if (this._map.getLayer(layer.layerId)) {
        this._map.moveLayer(layer.layerId, target);
      }
    }
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
