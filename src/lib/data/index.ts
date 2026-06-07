export {
  NATIONAL_MAP_HOSTS,
  HOST_CATEGORY,
  STATIC_CATALOG,
} from './catalog';
export type {
  NationalMapHost,
  NationalMapCategory,
  NationalMapService,
  ServiceType,
  ServiceRenderMode,
} from './catalog';

export { parseHostCatalog, mergeCatalog, fetchCatalog } from './catalogClient';
export type { RawArcgisCatalog } from './catalogClient';

export { buildLayerSpec, sourceIdFor, layerIdFor } from './sourceSpec';
export type { LayerSpec } from './sourceSpec';

export { filterServices, groupByCategory, CATEGORY_ORDER } from './filter';
export type { CategoryGroup } from './filter';
