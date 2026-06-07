/**
 * USGS National Map service catalog: types, host registry, and the built-in
 * static catalog used as an instant-render fallback when the live ArcGIS REST
 * listings are unreachable.
 *
 * @see https://apps.nationalmap.gov/services/
 */

/**
 * The CORS-enabled ArcGIS REST hosts under nationalmap.gov whose service
 * listings are fetched live at runtime.
 */
export type NationalMapHost =
  | 'basemap'
  | 'hydro'
  | 'elevation'
  | 'imagery'
  | 'carto'
  | 'partnerships'
  | 'index';

/**
 * Display category a service is grouped under in the control panel.
 */
export type NationalMapCategory =
  | 'Basemaps'
  | 'Hydrography'
  | 'Elevation'
  | 'Imagery'
  | 'Cartography'
  | 'Hazards'
  | 'Other Data'
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
  /** Full ArcGIS REST endpoint URL ending in /MapServer or /ImageServer. */
  serviceUrl: string;
  /** Host key when served from a nationalmap.gov subdomain (partner services omit this). */
  host?: NationalMapHost;
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
  imagery: 'https://imagery.nationalmap.gov/arcgis/rest/services',
  carto: 'https://carto.nationalmap.gov/arcgis/rest/services',
  partnerships: 'https://partnerships.nationalmap.gov/arcgis/rest/services',
  index: 'https://index.nationalmap.gov/arcgis/rest/services',
};

/**
 * Default display category for services discovered live on each host.
 * Curated static entries may override this per service.
 */
export const HOST_CATEGORY: Record<NationalMapHost, NationalMapCategory> = {
  basemap: 'Basemaps',
  hydro: 'Hydrography',
  elevation: 'Elevation',
  imagery: 'Imagery',
  carto: 'Cartography',
  partnerships: 'Other Data',
  index: 'Indexes',
};

const USGS_ATTRIBUTION = 'USGS The National Map';

/** Shorthand factory for nationalmap.gov-hosted catalog entries. */
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
    serviceUrl: `${NATIONAL_MAP_HOSTS[host]}/${name}/${type}`,
    host,
    category: extra?.category ?? HOST_CATEGORY[host],
    name,
    type,
    title,
    description,
    renderMode,
    attribution: USGS_ATTRIBUTION,
    ...extra,
  };
}

/** Shorthand factory for partner-hosted catalog entries (full URL given). */
function partnerService(
  id: string,
  serviceUrl: string,
  type: ServiceType,
  renderMode: ServiceRenderMode,
  category: NationalMapCategory,
  title: string,
  description: string,
  extra?: Partial<NationalMapService>,
): NationalMapService {
  return {
    id,
    serviceUrl,
    category,
    name: id.split('/').pop() ?? id,
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

  // --- Imagery (ImageServer) ---
  service(
    'imagery',
    'USGSNAIPPlus',
    'ImageServer',
    'exportImage',
    'NAIP Plus Imagery',
    'Natural-color orthoimagery from the National Agriculture Imagery Program plus supplemental sources.',
  ),
  service(
    'imagery',
    'USGSNAIPImagery',
    'ImageServer',
    'exportImage',
    'NAIP False Color Imagery',
    'False color composite (near-infrared, red, green) of NAIP orthoimagery; vegetation appears red.',
    { renderingRule: '{"rasterFunction":"FalseColorComposite"}' },
  ),
  partnerService(
    'imagery/USGSNAIPImagery-NDVI',
    'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer',
    'ImageServer',
    'exportImage',
    'Imagery',
    'NAIP NDVI',
    'Normalized difference vegetation index from NAIP imagery; dark green indicates dense vegetation.',
    {
      host: 'imagery',
      renderingRule: '{"rasterFunction":"NDVI_Color"}',
    },
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
    'partnerships',
    'USGSTrails',
    'MapServer',
    'export',
    'USGS Trails',
    'Recreational trails compiled through National Map partnerships.',
    { category: 'Cartography' },
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

  // --- Hazards (partner-hosted, dynamic MapServer) ---
  partnerService(
    'fema/NFHL',
    'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    'MapServer',
    'export',
    'Hazards',
    'FEMA National Flood Hazard Layer',
    'Effective flood hazard zones and regulatory floodways from FEMA flood insurance rate maps.',
    { attribution: 'FEMA' },
  ),

  // --- Other Data (partner-hosted) ---
  partnerService(
    'esri/USA_Topo_Maps',
    'https://services.arcgisonline.com/arcgis/rest/services/USA_Topo_Maps/MapServer',
    'MapServer',
    'tile',
    'Other Data',
    'Scanned USA Topo Maps',
    'Scanned legacy USGS topographic quadrangle maps as a cached tile service.',
    { attribution: 'USGS, Esri', maxzoom: 15 },
  ),
  partnerService(
    'blm/PLSS',
    'https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer',
    'MapServer',
    'export',
    'Other Data',
    'BLM Public Land Survey System (PLSS)',
    'Township, range, and section grid of the Public Land Survey System from BLM cadastral data.',
    { attribution: 'BLM' },
  ),
  partnerService(
    'fws/Wetlands',
    'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer',
    'MapServer',
    'export',
    'Other Data',
    'FWS National Wetlands Inventory',
    'Wetland and deepwater habitat extent and type from the US Fish and Wildlife Service.',
    { attribution: 'USFWS' },
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
  service(
    'index',
    'USGS_250K_Special_Edition_Maps',
    'MapServer',
    'export',
    'Special Edition 250K Maps',
    'Special edition 1:250,000-scale topographic map products.',
  ),
  service(
    'partnerships',
    '3DEPDataAcquisition_1KMGrid',
    'MapServer',
    'export',
    '3DEP Acquisition Grid (1 km)',
    'One-kilometer grid showing 3DEP lidar data acquisition status.',
    { category: 'Indexes' },
  ),
];
