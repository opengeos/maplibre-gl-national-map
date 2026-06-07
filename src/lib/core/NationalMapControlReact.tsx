import { useEffect, useRef } from "react";
import { NationalMapControl } from "./NationalMapControl";
import type { NationalMapControlReactProps } from "./types";

/**
 * React wrapper component for NationalMapControl.
 *
 * This component manages the lifecycle of a NationalMapControl instance,
 * adding it to the map on mount and removing it on unmount.
 *
 * @example
 * ```tsx
 * import { NationalMapControlReact } from 'maplibre-gl-national-map/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <NationalMapControlReact
 *           map={map}
 *           title="USGS National Map"
 *           collapsed={false}
 *           theme="auto"
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and control options
 * @returns null - This component renders nothing directly
 */
export function NationalMapControlReact({
  map,
  onStateChange,
  ...options
}: NationalMapControlReactProps): null {
  const controlRef = useRef<NationalMapControl | null>(null);

  useEffect(() => {
    if (!map) return;

    // Create the control instance
    const control = new NationalMapControl(options);
    controlRef.current = control;

    // Register state change handler if provided
    if (onStateChange) {
      control.on("statechange", (event) => {
        onStateChange(event.state);
      });
    }

    // Add control to map
    map.addControl(control, options.position || "top-right");

    // Cleanup on unmount
    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map]);

  // Update options when they change
  useEffect(() => {
    if (controlRef.current) {
      // Handle collapsed state changes
      const currentState = controlRef.current.getState();
      if (
        options.collapsed !== undefined &&
        options.collapsed !== currentState.collapsed
      ) {
        if (options.collapsed) {
          controlRef.current.collapse();
        } else {
          controlRef.current.expand();
        }
      }
    }
  }, [options.collapsed]);

  // Update theme when it changes
  useEffect(() => {
    if (controlRef.current && options.theme) {
      controlRef.current.setTheme(options.theme);
    }
  }, [options.theme]);

  return null;
}
