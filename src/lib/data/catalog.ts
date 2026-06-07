/**
 * USGS National Map service catalog: types, host registry, and the built-in
 * static catalog used as an instant-render fallback when the live ArcGIS REST
 * listings are unreachable.
 *
 * @see https://apps.nationalmap.gov/services/
 */

/**
 * The five CORS-enabled ArcGIS REST hosts under nationalmap.gov.
 */
export type NationalMapHost = 'basemap' | 'hydro' | 'elevation' | 'carto' | 'index';

/**
 * Display category a service is grouped under in the control panel.
 */
export type NationalMapCategory =
  | 'Basemaps'
  | 'Hydrography'
  | 'Elevation'
  | 'Cartography'
  | 'Indexes';

/**
 * ArcGIS REST service types supported by this plugin.
 */
export type ServiceType = 'MapServer' | 'ImageServer';

/**
 * How a service is turned into a MapLibre raster source:
 * - 'tile': cached tiles via `/MapServer/tile/{z}/{y}/{x}`
 * - 'export': dynamic MapServer via `/export?bbox={bbox-epsg-3857}&...`
 * - 'exportImage': ImageServer via `/exportImage?bbox={bbox-epsg-3857}&...`
 */
export type ServiceRenderMode = 'tile' | 'export' | 'exportImage';

/**
 * A web service from the USGS National Map that can be added to a MapLibre map.
 */
export interface NationalMapService {
  /** Stable unique id, e.g. "basemap/USGSTopo". */
  id: string;
  /** Host subdomain serving this service. */
  host: NationalMapHost;
  /** Display category for grouping in the panel. */
  category: NationalMapCategory;
  /** ArcGIS service name, e.g. "USGSTopo". */
  name: string;
  /** ArcGIS service type. */
  type: ServiceType;
  /** Friendly display title. */
  title: string;
  /** Short human-readable description. */
  description: string;
  /** Strategy used to build the MapLibre raster source. */
  renderMode: ServiceRenderMode;
  /** Optional ImageServer rendering rule JSON (e.g. hillshade). */
  renderingRule?: string;
  /** Attribution shown on the map. */
  attribution?: string;
  /** Minimum zoom level for the source. */
  minzoom?: number;
  /** Maximum zoom level for the source. */
  maxzoom?: number;
}

/**
 * Base ArcGIS REST services URL for each National Map host.
 */
export const NATIONAL_MAP_HOSTS: Record<NationalMapHost, string> = {
  basemap: 'https://basemap.nationalmap.gov/arcgis/rest/services',
  hydro: 'https://hydro.nationalmap.gov/arcgis/rest/services',
  elevation: 'https://elevation.nationalmap.gov/arcgis/rest/services',
  carto: 'https://carto.nationalmap.gov/arcgis/rest/services',
  index: 'https://index.nationalmap.gov/arcgis/rest/services',
};

/**
 * Display category for each host.
 */
export const HOST_CATEGORY: Record<NationalMapHost, NationalMapCategory> = {
  basemap: 'Basemaps',
  hydro: 'Hydrography',
  elevation: 'Elevation',
  carto: 'Cartography',
  index: 'Indexes',
};

const USGS_ATTRIBUTION = 'USGS The National Map';

/** Shorthand factory for static catalog entries. */
function service(
  host: NationalMapHost,
  name: string,
  type: ServiceType,
  renderMode: ServiceRenderMode,
  title: string,
  description: string,
  extra?: Partial<NationalMapService>,
): NationalMapService {
  return {
    id: `${host}/${name}`,
    host,
    category: HOST_CATEGORY[host],
    name,
    type,
    title,
    description,
    renderMode,
    attribution: USGS_ATTRIBUTION,
    ...extra,
  };
}

/**
 * Built-in catalog of known National Map services. Used for instant rendering
 * and as a fallback when the live catalog fetch fails. Friendly titles and
 * descriptions here take precedence over live metadata.
 */
export const STATIC_CATALOG: NationalMapService[] = [
  // --- Basemaps (tile-cached, EPSG:3857, 256px) ---
  service(
    'basemap',
    'USGSTopo',
    'MapServer',
    'tile',
    'USGS Topo',
    'Primary USGS topographic base map combining contours, hydrography, transportation, boundaries, and geographic names.',
    { maxzoom: 16 },
  ),
  service(
    'basemap',
    'USGSImageryOnly',
    'MapServer',
    'tile',
    'USGS Imagery Only',
    'Orthoimagery base map from the National Agriculture Imagery Program (NAIP) and other sources.',
    { maxzoom: 16 },
  ),
  service(
    'basemap',
    'USGSImageryTopo',
    'MapServer',
    'tile',
    'USGS Imagery Topo',
    'Orthoimagery combined with topographic map features such as contours, roads, and names.',
    { maxzoom: 16 },
  ),
  service(
    'basemap',
    'USGSShadedReliefOnly',
    'MapServer',
    'tile',
    'USGS Shaded Relief',
    'Terrain shaded relief base map derived from the 3D Elevation Program (3DEP).',
    { maxzoom: 16 },
  ),
  service(
    'basemap',
    'USGSHydroCached',
    'MapServer',
    'tile',
    'USGS Hydro Cached',
    'Cartographic representation of the National Hydrography Dataset as a cached overlay.',
    { maxzoom: 16 },
  ),

  // --- Hydrography (dynamic MapServer) ---
  service(
    'hydro',
    '3DHP_all',
    'MapServer',
    'export',
    '3D Hydrography Program (3DHP)',
    'All 3D Hydrography Program data: flowlines, waterbodies, and hydrologic networks.',
  ),
  service(
    'hydro',
    'nhd',
    'MapServer',
    'export',
    'National Hydrography Dataset (NHD)',
    'Surface water features including streams, rivers, lakes, and ponds.',
  ),
  service(
    'hydro',
    'NHDPlus_HR',
    'MapServer',
    'export',
    'NHDPlus High Resolution',
    'High-resolution hydrography with value-added attributes for modeling and analysis.',
  ),
  service(
    'hydro',
    'wbd',
    'MapServer',
    'export',
    'Watershed Boundary Dataset (WBD)',
    'Hydrologic unit boundaries defining the areal extent of surface water drainage.',
  ),

  // --- Elevation (ImageServer) ---
  service(
    'elevation',
    '3DEPElevation',
    'ImageServer',
    'exportImage',
    '3DEP Elevation (Hillshade)',
    'Dynamic hillshade rendering of the 3D Elevation Program seamless digital elevation model.',
    { renderingRule: '{"rasterFunction":"Hillshade Gray"}' },
  ),

  // --- Cartography (dynamic MapServer) ---
  service(
    'carto',
    'contours',
    'MapServer',
    'export',
    'Elevation Contours',
    'Elevation contour lines derived from the 3D Elevation Program.',
  ),
  service(
    'carto',
    'geonames',
    'MapServer',
    'export',
    'Geographic Names (GNIS)',
    'Place names from the Geographic Names Information System.',
  ),
  service(
    'carto',
    'govunits',
    'MapServer',
    'export',
    'Governmental Unit Boundaries',
    'National, state, county, and other administrative boundaries.',
  ),
  service(
    'carto',
    'map_indices',
    'MapServer',
    'export',
    'Map Indices',
    'US Topo and historical topographic map cell index grids.',
  ),
  service(
    'carto',
    'selectable_polygons',
    'MapServer',
    'export',
    'Selectable Polygons',
    'Polygon reference layers used for area selection in National Map applications.',
  ),
  service(
    'carto',
    'structures',
    'MapServer',
    'export',
    'Structures',
    'Man-made structures such as schools, hospitals, post offices, and fire stations.',
  ),
  service(
    'carto',
    'transportation',
    'MapServer',
    'export',
    'Transportation',
    'Roads, railroads, trails, and airports from national and local sources.',
  ),

  // --- Indexes (dynamic MapServer) ---
  service(
    'index',
    '3DEPElevationIndex',
    'MapServer',
    'export',
    '3DEP Elevation Index',
    'Index of available 3DEP elevation products and their footprints.',
  ),
  service(
    'index',
    'NHDPlus_HR_Index',
    'MapServer',
    'export',
    'NHDPlus HR Index',
    'Status and availability index for NHDPlus High Resolution data.',
  ),
  service(
    'index',
    'USGS_Seamless1m_Index',
    'MapServer',
    'export',
    'Seamless 1m DEM Index',
    'Availability index for the seamless 1-meter digital elevation model.',
  ),
  service(
    'index',
    'USGSNAIPImageryIndex',
    'MapServer',
    'export',
    'NAIP Imagery Index',
    'Availability index for National Agriculture Imagery Program imagery.',
  ),
  service(
    'index',
    'USTopoAvailability',
    'MapServer',
    'export',
    'US Topo Availability',
    'Availability index for current US Topo map products.',
  ),
];
