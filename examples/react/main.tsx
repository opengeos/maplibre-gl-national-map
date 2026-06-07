import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl, { Map } from 'maplibre-gl';
import { NationalMapControlReact, useNationalMapState } from '../../src/react';
import type { NationalMapTheme } from '../../src/react';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Main App component demonstrating the React integration
 */
function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [theme, setTheme] = useState<NationalMapTheme>('auto');
  const { state, toggle } = useNationalMapState({ collapsed: false });

  // Initialize the map
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-98.5, 39.8],
      zoom: 4,
    });

    // Add navigation controls to top-right
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add fullscreen control to top-right (after navigation)
    mapInstance.addControl(new maplibregl.FullscreenControl(), 'top-right');

    mapInstance.on('load', () => {
      setMap(mapInstance);
    });

    return () => {
      mapInstance.remove();
    };
  }, []);

  const handleStateChange = (newState: typeof state) => {
    console.log('Control state changed:', newState);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* External controls: panel toggle and theme selector */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={toggle}
          style={{
            padding: '8px 16px',
            background: '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {state.collapsed ? 'Expand' : 'Collapse'} Panel
        </button>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as NationalMapTheme)}
          aria-label="Control theme"
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          <option value="auto">Theme: Auto</option>
          <option value="light">Theme: Light</option>
          <option value="dark">Theme: Dark</option>
        </select>
      </div>

      {/* National Map control */}
      {map && (
        <NationalMapControlReact
          map={map}
          title="National Map"
          collapsed={state.collapsed}
          panelWidth={320}
          theme={theme}
          onStateChange={handleStateChange}
        />
      )}
    </div>
  );
}

// Mount the app
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
