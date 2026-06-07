// Import styles
import './lib/styles/national-map.css';

// Main entry point - Core exports
export { NationalMapControl } from './lib/core/NationalMapControl';
export { LayerManager } from './lib/core/LayerManager';
export type { ActiveLayer } from './lib/core/LayerManager';

// Type exports
export type {
  NationalMapControlOptions,
  NationalMapState,
  NationalMapTheme,
  NationalMapControlEvent,
  NationalMapControlEventHandler,
} from './lib/core/types';

// Data layer exports (catalog, live fetch, source specs, search)
export {
  NATIONAL_MAP_HOSTS,
  HOST_CATEGORY,
  STATIC_CATALOG,
  parseHostCatalog,
  mergeCatalog,
  fetchCatalog,
  buildLayerSpec,
  sourceIdFor,
  layerIdFor,
  filterServices,
  groupByCategory,
  CATEGORY_ORDER,
} from './lib/data';
export type {
  NationalMapHost,
  NationalMapCategory,
  NationalMapService,
  ServiceType,
  ServiceRenderMode,
  RawArcgisCatalog,
  LayerSpec,
  CategoryGroup,
} from './lib/data';

// Utility exports
export {
  clamp,
  formatNumericValue,
  generateId,
  debounce,
  throttle,
  classNames,
} from './lib/utils';
