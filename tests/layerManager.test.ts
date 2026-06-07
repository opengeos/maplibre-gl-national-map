import { describe, it, expect, beforeEach } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { LayerManager } from '../src/lib/core/LayerManager';
import { STATIC_CATALOG } from '../src/lib/data/catalog';
import { sourceIdFor, layerIdFor } from '../src/lib/data/sourceSpec';

const topo = STATIC_CATALOG.find((s) => s.id === 'basemap/USGSTopo')!;
const nhd = STATIC_CATALOG.find((s) => s.id === 'hydro/nhd')!;

/** Minimal fake map recording calls in order. */
function createFakeMap() {
  const calls: { method: string; args: unknown[] }[] = [];
  const sources = new Set<string>();
  const layers = new Set<string>();

  const fake = {
    calls,
    addSource(id: string, spec: unknown) {
      calls.push({ method: 'addSource', args: [id, spec] });
      sources.add(id);
    },
    addLayer(spec: { id: string }) {
      calls.push({ method: 'addLayer', args: [spec] });
      layers.add(spec.id);
    },
    removeSource(id: string) {
      calls.push({ method: 'removeSource', args: [id] });
      sources.delete(id);
    },
    removeLayer(id: string) {
      calls.push({ method: 'removeLayer', args: [id] });
      layers.delete(id);
    },
    getSource(id: string) {
      return sources.has(id) ? { id } : undefined;
    },
    getLayer(id: string) {
      return layers.has(id) ? { id } : undefined;
    },
    setLayoutProperty(layerId: string, name: string, value: unknown) {
      calls.push({ method: 'setLayoutProperty', args: [layerId, name, value] });
    },
    setPaintProperty(layerId: string, name: string, value: unknown) {
      calls.push({ method: 'setPaintProperty', args: [layerId, name, value] });
    },
  };
  return fake;
}

describe('LayerManager', () => {
  let map: ReturnType<typeof createFakeMap>;
  let manager: LayerManager;

  beforeEach(() => {
    map = createFakeMap();
    manager = new LayerManager(map as unknown as MapLibreMap);
  });

  it('adds a source then a layer for a service', () => {
    const active = manager.add(topo);
    expect(active).not.toBeNull();
    expect(active!.visible).toBe(true);
    expect(active!.opacity).toBe(1);
    expect(map.calls.map((c) => c.method)).toEqual(['addSource', 'addLayer']);
    expect(manager.has(topo.id)).toBe(true);
  });

  it('is a no-op when adding the same service twice', () => {
    manager.add(topo);
    expect(manager.add(topo)).toBeNull();
    expect(manager.list()).toHaveLength(1);
  });

  it('removes the layer before the source', () => {
    manager.add(topo);
    map.calls.length = 0;

    manager.remove(topo.id);
    expect(map.calls.map((c) => c.method)).toEqual(['removeLayer', 'removeSource']);
    expect(map.calls[0].args[0]).toBe(layerIdFor(topo));
    expect(map.calls[1].args[0]).toBe(sourceIdFor(topo));
    expect(manager.has(topo.id)).toBe(false);
  });

  it('ignores removal of services that were never added', () => {
    manager.remove(topo.id);
    expect(map.calls).toHaveLength(0);
  });

  it('toggles visibility via the layout property', () => {
    manager.add(topo);
    manager.setVisibility(topo.id, false);

    const call = map.calls.at(-1)!;
    expect(call.method).toBe('setLayoutProperty');
    expect(call.args).toEqual([layerIdFor(topo), 'visibility', 'none']);
    expect(manager.list()[0].visible).toBe(false);

    manager.setVisibility(topo.id, true);
    expect(map.calls.at(-1)!.args[2]).toBe('visible');
  });

  it('sets clamped opacity via the raster-opacity paint property', () => {
    manager.add(topo);
    manager.setOpacity(topo.id, 0.5);

    const call = map.calls.at(-1)!;
    expect(call.method).toBe('setPaintProperty');
    expect(call.args).toEqual([layerIdFor(topo), 'raster-opacity', 0.5]);

    manager.setOpacity(topo.id, 2);
    expect(map.calls.at(-1)!.args[2]).toBe(1);
    manager.setOpacity(topo.id, -1);
    expect(map.calls.at(-1)!.args[2]).toBe(0);
  });

  it('lists active layers in insertion order and removes them all', () => {
    manager.add(topo);
    manager.add(nhd);
    expect(manager.list().map((l) => l.service.id)).toEqual([topo.id, nhd.id]);

    manager.removeAll();
    expect(manager.list()).toEqual([]);
    expect(map.getSource(sourceIdFor(topo))).toBeUndefined();
    expect(map.getLayer(layerIdFor(nhd))).toBeUndefined();
  });
});
