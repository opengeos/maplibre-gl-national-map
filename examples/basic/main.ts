import maplibregl from 'maplibre-gl';
import { NationalMapControl } from '../../src/index';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

// Create map centered on the contiguous United States so the USGS
// National Map services have visible coverage.
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [-98.5, 39.8],
  zoom: 4,
});

// Add navigation controls to top-right
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add fullscreen control to top-right (after navigation)
map.addControl(new maplibregl.FullscreenControl(), 'top-right');

// Add the National Map control when the map loads
map.on('load', () => {
  // Set collapsed: true to start with just the 29x29 button (like navigation control)
  const nationalMapControl = new NationalMapControl({
    title: 'National Map',
    collapsed: false,
    panelWidth: 320,
    theme: 'auto',
  });

  // Add control to the map
  map.addControl(nationalMapControl, 'top-right');

  // Add Globe control to the map
  map.addControl(new maplibregl.GlobeControl(), 'top-right');

  // Listen for layer and state changes
  nationalMapControl.on('layeradd', (event) => {
    console.log('Layer added:', event.service?.id);
  });

  nationalMapControl.on('layerremove', (event) => {
    console.log('Layer removed:', event.service?.id);
  });

  nationalMapControl.on('statechange', (event) => {
    console.log('Control state changed:', event.state);
  });

  console.log('National Map control added to map');
});
