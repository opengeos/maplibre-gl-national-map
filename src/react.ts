// React entry point
export { NationalMapControlReact } from './lib/core/NationalMapControlReact';

// React hooks
export { useNationalMapState } from './lib/hooks';

// Re-export types for React consumers
export type {
  NationalMapControlOptions,
  NationalMapState,
  NationalMapTheme,
  NationalMapControlReactProps,
  NationalMapControlEvent,
  NationalMapControlEventHandler,
} from './lib/core/types';
export type {
  NationalMapHost,
  NationalMapCategory,
  NationalMapService,
  ServiceType,
  ServiceRenderMode,
} from './lib/data';
export type { ActiveLayer } from './lib/core/LayerManager';
