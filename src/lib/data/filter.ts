/**
 * Pure search and grouping helpers for the service catalog.
 */

import type { NationalMapCategory, NationalMapService } from './catalog';

/**
 * Fixed display order for catalog categories.
 */
export const CATEGORY_ORDER: NationalMapCategory[] = [
  'Basemaps',
  'Hydrography',
  'Elevation',
  'Cartography',
  'Indexes',
];

/**
 * Services grouped under one category.
 */
export interface CategoryGroup {
  category: NationalMapCategory;
  services: NationalMapService[];
}

/**
 * Filters services by a case-insensitive substring match against the title,
 * name, description, and category. An empty or whitespace-only query returns
 * all services.
 *
 * @param services - Services to filter
 * @param query - Search text
 * @returns Matching services in their original order
 */
export function filterServices(
  services: NationalMapService[],
  query: string,
): NationalMapService[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return services;

  return services.filter((service) =>
    [service.title, service.name, service.description, service.category].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

/**
 * Groups services by category in the fixed CATEGORY_ORDER, omitting empty
 * groups.
 *
 * @param services - Services to group
 * @returns Non-empty category groups in display order
 */
export function groupByCategory(services: NationalMapService[]): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    services: services.filter((service) => service.category === category),
  })).filter((group) => group.services.length > 0);
}
