import type { Map } from 'maplibre-gl';
import type { NationalMapService } from '../data/catalog';

/**
 * Theme applied to the control UI.
 * - 'light': always light colors
 * - 'dark': always dark colors
 * - 'auto': follow the user's prefers-color-scheme setting
 */
export type NationalMapTheme = 'light' | 'dark' | 'auto';

/**
 * Options for configuring the NationalMapControl
 */
export interface NationalMapControlOptions {
  /**
   * Whether the control panel should start collapsed (showing only the toggle button)
   * @default true
   */
  collapsed?: boolean;

  /**
   * Position of the control on the map
   * @default 'top-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Title displayed in the control header
   * @default 'USGS National Map'
   */
  title?: string;

  /**
   * Width of the control panel in pixels
   * @default 320
   */
  panelWidth?: number;

  /**
   * Custom CSS class name for the control container
   */
  className?: string;

  /**
   * Color theme for the control UI
   * @default 'auto'
   */
  theme?: NationalMapTheme;

  /**
   * Existing layer id to insert National Map layers before, so added
   * services render underneath it (e.g. a label layer). Ignored when the
   * layer does not exist on the map.
   */
  beforeId?: string;
}

/**
 * Internal state of the National Map control
 */
export interface NationalMapState {
  /**
   * Whether the control panel is currently collapsed
   */
  collapsed: boolean;

  /**
   * Current panel width in pixels
   */
  panelWidth: number;

  /**
   * IDs of services currently added to the map (e.g. "basemap/USGSTopo")
   */
  activeLayerIds?: string[];

  /**
   * Any custom state data
   */
  data?: Record<string, unknown>;
}

/**
 * Props for the React wrapper component
 */
export interface NationalMapControlReactProps extends NationalMapControlOptions {
  /**
   * MapLibre GL map instance
   */
  map: Map;

  /**
   * Callback fired when the control state changes
   */
  onStateChange?: (state: NationalMapState) => void;
}

/**
 * Event types emitted by the National Map control
 */
export type NationalMapControlEvent = 'collapse' | 'expand' | 'statechange' | 'layeradd' | 'layerremove';

/**
 * Event handler function type
 */
export type NationalMapControlEventHandler = (event: {
  type: NationalMapControlEvent;
  state: NationalMapState;
  service?: NationalMapService;
}) => void;
