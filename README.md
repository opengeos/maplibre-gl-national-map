# MapLibre GL National Map

A [MapLibre GL JS](https://maplibre.org) plugin for searching and adding [USGS National Map web services](https://apps.nationalmap.gov/services/) to a map. It ships as a standard MapLibre `IControl` with a React wrapper, and also builds as a GeoLibre Desktop plugin bundle.

[![npm version](https://img.shields.io/npm/v/maplibre-gl-national-map.svg)](https://www.npmjs.com/package/maplibre-gl-national-map)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?logo=codesandbox)](https://codesandbox.io/p/github/opengeos/maplibre-gl-national-map)
[![Open in StackBlitz](https://img.shields.io/badge/Open%20in-StackBlitz-blue?logo=stackblitz)](https://stackblitz.com/github/opengeos/maplibre-gl-national-map)

## Features

- **Service Catalog** - Browse 20+ USGS National Map services grouped by collapsible categories (Basemaps, Hydrography, Elevation, Cartography, Indexes)
- **Search** - Filter services by name, title, description, or category; matching categories expand automatically
- **Layer Insertion Point** - An "Insert before" selector in the panel (or the `beforeId` option) inserts added layers beneath an existing layer (e.g. labels); changing it re-anchors layers already added
- **Resizable Panel** - Drag the panel edge to resize; works from left and right corner placements
- **Live Catalog Refresh** - Fetches the latest service listings from the National Map ArcGIS REST endpoints at runtime, with a built-in static catalog as an instant-render fallback (works offline)
- **Layer Management** - Toggle visibility, adjust opacity, and remove added layers from an "Active layers" section
- **Light/Dark Theme** - Follows `prefers-color-scheme` by default, with a `theme` option to force light or dark
- **Small-Screen Friendly** - The panel constrains itself to the map height and scrolls vertically
- **Collapsible Control** - 29x29 toggle button matching MapLibre's navigation control, with a floating panel
- **TypeScript Support** - All public types exported from the package root
- **React Integration** - React wrapper component and custom hook
- **GeoLibre Bundle Output** - Builds a zip with root `plugin.json`, bundled ESM, and CSS for GeoLibre Desktop

## Supported Services

The catalog mirrors the map services listed at [apps.nationalmap.gov/services](https://apps.nationalmap.gov/services/). All endpoints are CORS-enabled ArcGIS REST services and need no API key:

| Category    | Services                                                                                              | Rendering                  |
| ----------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| Basemaps    | USGS Topo, Imagery Only, Imagery Topo, Shaded Relief, Hydro Cached                                     | Cached XYZ tiles           |
| Hydrography | 3DHP, NHD, NHDPlus HR, Watershed Boundary Dataset                                                      | Dynamic map export         |
| Elevation   | 3DEP Elevation (hillshade)                                                                            | ImageServer export         |
| Imagery     | NAIP Plus, NAIP False Color Imagery, NAIP NDVI                                                        | ImageServer export         |
| Cartography | Contours, Geographic Names, Governmental Units, Map Indices, Selectable Polygons, Structures, Transportation, USGS Trails | Dynamic map export |
| Hazards     | FEMA National Flood Hazard Layer                                                                      | Dynamic map export         |
| Other Data  | Scanned USA Topo Maps, BLM PLSS, FWS National Wetlands Inventory                                       | Cached tiles / map export  |
| Indexes     | 3DEP Elevation Index, NHDPlus HR Index, Seamless 1m DEM Index, NAIP Imagery Index, US Topo Availability, Special Edition 250K Maps, 3DEP Acquisition Grid | Dynamic map export |

A few services from the page are intentionally excluded: WFS/WCS endpoints and FeatureServers (not raster-displayable), NLCD land cover (WMS landing page only), and partner endpoints that were unreachable at testing time (ScienceBase geology, USGS ecosystems, GAP land cover, earthquake faults, mine symbols, NPS boundaries).

Note: layers added later render on top of earlier ones (or beneath the `beforeId` layer when configured). Remove and re-add layers to change stacking.

## Installation

```bash
npm install maplibre-gl-national-map
```

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import maplibregl from "maplibre-gl";
import { NationalMapControl } from "maplibre-gl-national-map";
import "maplibre-gl-national-map/style.css";

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [-98.5, 39.8],
  zoom: 4,
});

map.on("load", () => {
  const control = new NationalMapControl({
    title: "USGS National Map",
    collapsed: false,
    theme: "auto",
  });

  map.addControl(control, "top-right");

  // Programmatic layer management
  control.addService("basemap/USGSTopo");
  console.log(control.getActiveLayers());
});
```

### React

```tsx
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import {
  NationalMapControlReact,
  useNationalMapState,
} from "maplibre-gl-national-map/react";
import "maplibre-gl-national-map/style.css";

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const { state, toggle } = useNationalMapState();

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-98.5, 39.8],
      zoom: 4,
    });

    mapInstance.on("load", () => setMap(mapInstance));

    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {map && (
        <NationalMapControlReact
          map={map}
          title="National Map"
          collapsed={state.collapsed}
          theme="auto"
          onStateChange={(newState) => console.log(newState)}
        />
      )}
    </div>
  );
}
```

## API

### NationalMapControl

The main control class implementing MapLibre's `IControl` interface.

#### Constructor Options

| Option       | Type      | Default          | Description                                                                |
| ------------ | --------- | ---------------- | -------------------------------------------------------------------------- |
| `collapsed`  | `boolean` | `true`           | Whether the panel starts collapsed (showing only the 29x29 toggle button)  |
| `position`   | `string`  | `'top-right'`    | Control position on the map                                                |
| `title`      | `string`  | `'USGS National Map'` | Title displayed in the header                                              |
| `panelWidth` | `number`  | `320`            | Initial width of the dropdown panel in pixels (user-resizable by dragging the panel edge) |
| `className`  | `string`  | `''`             | Custom CSS class name                                                      |
| `theme`      | `string`  | `'auto'`         | Color theme: `'light'`, `'dark'`, or `'auto'` (follows `prefers-color-scheme`) |
| `beforeId`   | `string`  | `undefined`      | Existing layer id to insert added layers before, so services render underneath it (ignored if the layer does not exist). Also adjustable at runtime via the panel's "Insert before" selector |

#### Methods

- `toggle()` - Toggle the collapsed state
- `expand()` - Expand the panel
- `collapse()` - Collapse the panel
- `getState()` - Get the current state (includes `activeLayerIds`)
- `setState(state)` - Update the state
- `addService(serviceId)` - Add a catalog service to the map (e.g. `"basemap/USGSTopo"`)
- `removeService(serviceId)` - Remove a previously added service
- `getActiveLayers()` - Get the services currently added to the map
- `setTheme(theme)` - Change the theme at runtime
- `on(event, handler)` - Register an event handler
- `off(event, handler)` - Remove an event handler
- `getMap()` - Get the map instance
- `getContainer()` - Get the container element

#### Events

- `collapse` - Fired when the panel is collapsed
- `expand` - Fired when the panel is expanded
- `statechange` - Fired when the state changes
- `layeradd` - Fired when a service is added to the map (`event.service` is the service)
- `layerremove` - Fired when a service is removed from the map

### NationalMapControlReact

React wrapper component for `NationalMapControl`.

#### Props

All `NationalMapControl` options plus:

| Prop            | Type       | Description                         |
| --------------- | ---------- | ----------------------------------- |
| `map`           | `Map`      | MapLibre GL map instance (required) |
| `onStateChange` | `function` | Callback fired when state changes   |

### useNationalMapState

Custom React hook for managing control state.

```typescript
const {
  state, // Current state
  setState, // Replace the state
  setCollapsed, // Set collapsed state
  setPanelWidth, // Set panel width
  setData, // Merge custom data
  reset, // Reset to defaults
  toggle, // Toggle collapsed
} = useNationalMapState({ collapsed: false });
```

### Data Layer

The catalog and spec builders are exported for advanced use without the UI control:

```typescript
import {
  STATIC_CATALOG, // Built-in service catalog
  fetchCatalog, // Live catalog fetch with static fallback
  buildLayerSpec, // NationalMapService -> MapLibre source/layer specs
  filterServices, // Search the catalog
  groupByCategory, // Group services for display
  LayerManager, // Add/remove/visibility/opacity on a map
} from "maplibre-gl-national-map";

const spec = buildLayerSpec(STATIC_CATALOG[0]);
map.addSource(spec.sourceId, spec.source);
map.addLayer(spec.layer);
```

Exported types include `NationalMapService`, `NationalMapControlOptions`, `NationalMapState`, `NationalMapTheme`, `NationalMapHost`, `NationalMapCategory`, `ServiceType`, `ServiceRenderMode`, `ActiveLayer`, `LayerSpec`, and `CategoryGroup`.

## Theming

The control uses CSS custom properties scoped to `.national-map` and `.national-map-panel`. With `theme: 'auto'` (default), dark colors apply when the OS is in dark mode. Use `theme: 'light'` or `theme: 'dark'` to force a theme, or override the `--nm-*` variables in your own CSS:

```css
.national-map-panel {
  --nm-accent: #2e7d32;
  --nm-accent-hover: #1b5e20;
}
```

## Examples

Run locally:

```bash
npm install
npm run dev
```

- Basic: http://localhost:5173/examples/basic/
- React (with theme switcher): http://localhost:5173/examples/react/

## Build a GeoLibre plugin zip

GeoLibre Desktop loads external plugins from an app data `plugins/` directory. The zip must contain `plugin.json` at the root, plus a bundled ESM entry and optional CSS file.

```bash
npm install
npm run package:geolibre
```

This creates:

```text
geolibre-plugin/maplibre-gl-national-map-0.1.0.zip
```

Copy the zip into GeoLibre Desktop's app data `plugins/` directory and restart GeoLibre. On Linux with the default app identifier, that directory is usually:

```text
~/.local/share/org.geolibre.desktop/plugins/
```

For the GeoLibre web app, serve the unpacked plugin with CORS enabled:

```bash
npm run package:geolibre
npm run serve:geolibre -- 8000
```

Then add this manifest URL in GeoLibre Settings > Plugins:

```text
http://localhost:8000/plugin.json
```

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start the dev server
npm test         # Run the test suite
npm run lint     # Lint
npm run build    # Build the library and GeoLibre bundle
```

## Docker

```bash
docker build -t maplibre-gl-national-map .
docker run -p 8080:80 maplibre-gl-national-map
# Open http://localhost:8080/maplibre-gl-national-map/
```

## License

MIT
