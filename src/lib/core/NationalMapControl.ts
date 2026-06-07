import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  NationalMapControlOptions,
  NationalMapState,
  NationalMapControlEvent,
  NationalMapControlEventHandler,
  NationalMapTheme,
} from './types';
import {
  STATIC_CATALOG,
  type NationalMapCategory,
  type NationalMapService,
} from '../data/catalog';
import { fetchCatalog } from '../data/catalogClient';
import { CATEGORY_ORDER, filterServices, groupByCategory } from '../data/filter';
import { LayerManager, type ActiveLayer } from './LayerManager';
import { clamp, debounce } from '../utils';

/**
 * Default options for the NationalMapControl
 */
const DEFAULT_OPTIONS: Required<NationalMapControlOptions> = {
  collapsed: true,
  position: 'top-right',
  title: 'USGS National Map',
  panelWidth: 320,
  className: '',
  theme: 'auto',
  beforeId: '',
};

/** Width bounds for the user-resizable panel. */
const MIN_PANEL_WIDTH = 240;

/**
 * Event handlers map type
 */
type EventHandlersMap = globalThis.Map<
  NationalMapControlEvent,
  Set<NationalMapControlEventHandler>
>;

/**
 * A MapLibre GL control for searching and adding USGS National Map web
 * services (https://apps.nationalmap.gov/services/) to the map.
 *
 * The control renders as a collapsible 29x29 button. The expanded panel
 * offers a search box over the service catalog (basemaps, hydrography,
 * elevation, cartography, and index services) plus an active-layers section
 * with visibility, opacity, and remove controls.
 *
 * @example
 * ```typescript
 * const control = new NationalMapControl({
 *   title: 'USGS National Map',
 *   collapsed: false,
 *   theme: 'auto',
 * });
 * map.addControl(control, 'top-right');
 * ```
 */
export class NationalMapControl implements IControl {
  private _map?: MapLibreMap;
  private _mapContainer?: HTMLElement;
  private _container?: HTMLElement;
  private _panel?: HTMLElement;
  private _options: Required<NationalMapControlOptions>;
  private _state: NationalMapState;
  private _eventHandlers: EventHandlersMap = new globalThis.Map();

  // National Map data
  private _catalog: NationalMapService[] = STATIC_CATALOG;
  private _query = '';
  private _layerManager?: LayerManager;
  private _fetchController?: AbortController;

  // Categories collapsed in the catalog list (Basemaps starts expanded)
  private _collapsedCategories: Set<NationalMapCategory> = new Set(
    CATEGORY_ORDER.filter((category) => category !== 'Basemaps'),
  );

  // Panel sections (rebuilt on data changes)
  private _catalogList?: HTMLElement;
  private _activeSection?: HTMLElement;
  private _resizeHandle?: HTMLElement;
  private _beforeSelect?: HTMLSelectElement;

  // Panel positioning handlers
  private _resizeHandler: (() => void) | null = null;
  private _mapResizeHandler: (() => void) | null = null;
  private _clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Creates a new NationalMapControl instance.
   *
   * @param options - Configuration options for the control
   */
  constructor(options?: Partial<NationalMapControlOptions>) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      collapsed: this._options.collapsed,
      panelWidth: this._options.panelWidth,
      activeLayerIds: [],
      data: {},
    };
  }

  /**
   * Called when the control is added to the map.
   * Implements the IControl interface.
   *
   * @param map - The MapLibre GL map instance
   * @returns The control's container element
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._mapContainer = map.getContainer();
    this._layerManager = new LayerManager(map, {
      beforeId: this._options.beforeId || undefined,
    });

    // Restore layers persisted in state (e.g. project state applied via
    // setState before the control was added to a map).
    for (const id of this._state.activeLayerIds ?? []) {
      const service = this._catalog.find((s) => s.id === id);
      if (service) this._layerManager.add(service);
    }

    this._container = this._createContainer();
    this._panel = this._createPanel();

    // Append panel to map container for independent positioning (avoids overlap with other controls)
    this._mapContainer.appendChild(this._panel);

    // Setup event listeners for panel positioning and click-outside
    this._setupEventListeners();

    // Populate the insert-before selector once the style is available.
    if (map.loaded()) {
      this._refreshBeforeIdOptions();
    } else {
      map.once('load', () => this._refreshBeforeIdOptions());
    }

    // Set initial panel state
    if (!this._state.collapsed) {
      this._panel.classList.add('expanded');
      // Update position after control is added to DOM
      requestAnimationFrame(() => {
        this._updatePanelPosition();
      });
    }

    // Refresh the catalog from the live service listings (the static catalog
    // renders immediately; this swaps in any newly published services).
    this._fetchController = new AbortController();
    fetchCatalog(this._fetchController.signal)
      .then((catalog) => {
        if (!this._panel) return; // control was removed mid-fetch
        this._catalog = catalog;
        this._renderCatalogList();
      })
      .catch(() => {
        // Defensive: fetchCatalog never rejects (failures and aborts resolve
        // to the static catalog), so this only guards unexpected errors.
      });

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   * Implements the IControl interface.
   */
  onRemove(): void {
    // Cancel any in-flight catalog fetch
    this._fetchController?.abort();
    this._fetchController = undefined;

    // Remove all layers added through this control
    this._layerManager?.removeAll();
    this._layerManager = undefined;

    // Remove event listeners
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._mapResizeHandler && this._map) {
      this._map.off('resize', this._mapResizeHandler);
      this._mapResizeHandler = null;
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }

    // Remove panel from map container
    this._panel?.parentNode?.removeChild(this._panel);

    // Remove button container from control stack
    this._container?.parentNode?.removeChild(this._container);

    this._map = undefined;
    this._mapContainer = undefined;
    this._container = undefined;
    this._panel = undefined;
    this._catalogList = undefined;
    this._activeSection = undefined;
    this._resizeHandle = undefined;
    this._beforeSelect = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Default position used when map.addControl() is called without one.
   * Implements the IControl interface.
   *
   * @returns The position from the control options
   */
  getDefaultPosition(): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
    return this._options.position;
  }

  /**
   * Gets the current state of the control.
   *
   * @returns The current control state
   */
  getState(): NationalMapState {
    return {
      ...this._state,
      activeLayerIds: this._layerManager?.list().map((l) => l.service.id) ?? [],
    };
  }

  /**
   * Updates the control state and applies it to the live control: the panel
   * reflects `collapsed` and `panelWidth`, and `activeLayerIds` are
   * reconciled with the map (missing layers added, extras removed). When the
   * control is not yet on a map, the state is stored and applied in onAdd.
   *
   * @param newState - Partial state to merge with current state
   */
  setState(newState: Partial<NationalMapState>): void {
    this._state = { ...this._state, ...newState };

    // Reflect collapsed state in the live panel
    if (newState.collapsed !== undefined && this._panel) {
      if (newState.collapsed) {
        this._panel.classList.remove('expanded');
      } else {
        this._panel.classList.add('expanded');
        this._updatePanelPosition();
      }
    }

    // Apply panel width
    if (newState.panelWidth !== undefined && this._panel) {
      this._panel.style.width = `${newState.panelWidth}px`;
    }

    // Reconcile restored layers with the map
    if (newState.activeLayerIds && this._layerManager) {
      const wanted = new Set(newState.activeLayerIds);
      for (const layer of this._layerManager.list()) {
        if (!wanted.has(layer.service.id)) {
          this._layerManager.remove(layer.service.id);
        }
      }
      for (const id of wanted) {
        if (!this._layerManager.has(id)) {
          const service = this._catalog.find((s) => s.id === id);
          if (service) this._layerManager.add(service);
        }
      }
      this._renderCatalogList();
      this._renderActiveSection();
    }

    this._emit('statechange');
  }

  /**
   * Toggles the collapsed state of the control panel.
   */
  toggle(): void {
    this._state.collapsed = !this._state.collapsed;

    if (this._panel) {
      if (this._state.collapsed) {
        this._panel.classList.remove('expanded');
        this._emit('collapse');
      } else {
        this._panel.classList.add('expanded');
        this._updatePanelPosition();
        // Style layers may have changed since the panel was last open.
        this._refreshBeforeIdOptions();
        this._emit('expand');
      }
    }

    this._emit('statechange');
  }

  /**
   * Expands the control panel.
   */
  expand(): void {
    if (this._state.collapsed) {
      this.toggle();
    }
  }

  /**
   * Collapses the control panel.
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this.toggle();
    }
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for
   * @param handler - The callback function
   */
  on(event: NationalMapControlEvent, handler: NationalMapControlEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes an event handler.
   *
   * @param event - The event type
   * @param handler - The callback function to remove
   */
  off(event: NationalMapControlEvent, handler: NationalMapControlEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Gets the map instance.
   *
   * @returns The MapLibre GL map instance or undefined if not added to a map
   */
  getMap(): MapLibreMap | undefined {
    return this._map;
  }

  /**
   * Gets the control container element.
   *
   * @returns The container element or undefined if not added to a map
   */
  getContainer(): HTMLElement | undefined {
    return this._container;
  }

  /**
   * Gets the services currently added to the map through this control.
   *
   * @returns Active layers in the order they were added
   */
  getActiveLayers(): ActiveLayer[] {
    return this._layerManager?.list() ?? [];
  }

  /**
   * Programmatically adds a catalog service to the map.
   *
   * @param serviceId - The service id, e.g. "basemap/USGSTopo"
   */
  addService(serviceId: string): void {
    const service = this._catalog.find((s) => s.id === serviceId);
    if (service) {
      this._addService(service);
    }
  }

  /**
   * Programmatically removes a previously added service from the map.
   *
   * @param serviceId - The service id, e.g. "basemap/USGSTopo"
   */
  removeService(serviceId: string): void {
    const active = this._layerManager?.list().find((l) => l.service.id === serviceId);
    if (active) {
      this._removeService(active.service);
    }
  }

  /**
   * Sets the opacity of a service currently added to the map.
   *
   * No-op when the service is not active. When the opacity is applied the
   * active-layers panel is re-rendered and a `statechange` event is emitted.
   *
   * @param serviceId - The service id, e.g. "basemap/USGSTopo"
   * @param opacity - Opacity in the range [0, 1] (clamped)
   */
  setServiceOpacity(serviceId: string, opacity: number): void {
    if (!this._layerManager?.has(serviceId)) return;
    this._layerManager.setOpacity(serviceId, opacity);
    this._renderActiveSection();
    this._emit('statechange');
  }

  /**
   * Sets the visibility of a service currently added to the map.
   *
   * No-op when the service is not active. When the visibility is applied the
   * active-layers panel is re-rendered and a `statechange` event is emitted.
   *
   * @param serviceId - The service id, e.g. "basemap/USGSTopo"
   * @param visible - Whether the layer should be visible
   */
  setServiceVisibility(serviceId: string, visible: boolean): void {
    if (!this._layerManager?.has(serviceId)) return;
    this._layerManager.setVisibility(serviceId, visible);
    this._renderActiveSection();
    this._emit('statechange');
  }

  /**
   * Sets the control theme at runtime.
   *
   * @param theme - 'light', 'dark', or 'auto'
   */
  setTheme(theme: NationalMapTheme): void {
    this._options.theme = theme;
    if (this._container) this._applyTheme(this._container);
    if (this._panel) this._applyTheme(this._panel);
  }

  /**
   * Emits an event to all registered handlers.
   *
   * @param event - The event type to emit
   * @param service - Optional service associated with the event
   */
  private _emit(event: NationalMapControlEvent, service?: NationalMapService): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState(), service };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /** Adds a service to the map and refreshes the panel sections. */
  private _addService(service: NationalMapService): void {
    if (!this._layerManager?.add(service)) return;
    this._renderCatalogList();
    this._renderActiveSection();
    this._emit('layeradd', service);
    this._emit('statechange');
  }

  /** Removes a service from the map and refreshes the panel sections. */
  private _removeService(service: NationalMapService): void {
    if (!this._layerManager?.has(service.id)) return;
    this._layerManager.remove(service.id);
    this._renderCatalogList();
    this._renderActiveSection();
    this._emit('layerremove', service);
    this._emit('statechange');
  }

  /**
   * Creates the main container element for the control.
   * Contains a toggle button (29x29) matching navigation control size.
   *
   * @returns The container element
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibregl-ctrl-group national-map${
      this._options.className ? ` ${this._options.className}` : ''
    }`;
    this._applyTheme(container);

    // Create toggle button (29x29 to match navigation control)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'national-map-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', this._options.title);
    toggleBtn.innerHTML = `
      <span class="national-map-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/>
          <line x1="8" y1="3" x2="8" y2="18"/>
          <line x1="16" y1="6" x2="16" y2="21"/>
        </svg>
      </span>
    `;
    toggleBtn.addEventListener('click', () => this.toggle());

    container.appendChild(toggleBtn);

    return container;
  }

  /** Applies the configured theme class to an element ('auto' uses none). */
  private _applyTheme(element: HTMLElement): void {
    element.classList.remove('national-map-theme-light', 'national-map-theme-dark');
    if (this._options.theme === 'light') {
      element.classList.add('national-map-theme-light');
    } else if (this._options.theme === 'dark') {
      element.classList.add('national-map-theme-dark');
    }
  }

  /**
   * Creates the panel element with header, search box, catalog list, and
   * active layers section.
   *
   * @returns The panel element
   */
  private _createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'national-map-panel';
    panel.style.width = `${this._options.panelWidth}px`;
    this._applyTheme(panel);

    // Create header with title and close button
    const header = document.createElement('div');
    header.className = 'national-map-header';

    const title = document.createElement('span');
    title.className = 'national-map-title';
    title.textContent = this._options.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'national-map-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.collapse());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create content area
    const content = document.createElement('div');
    content.className = 'national-map-content';

    // Search box
    const search = document.createElement('input');
    search.className = 'national-map-search';
    search.type = 'search';
    search.placeholder = 'Search services…';
    search.setAttribute('aria-label', 'Search National Map services');
    const onSearch = debounce(() => {
      this._query = search.value;
      this._renderCatalogList();
    }, 150);
    search.addEventListener('input', onSearch);

    // Insert-before selector: pick the style layer that added services are
    // inserted beneath (e.g. labels). Changing it re-anchors existing layers.
    const beforeRow = document.createElement('div');
    beforeRow.className = 'national-map-beforeid-row';

    const beforeLabel = document.createElement('label');
    beforeLabel.className = 'national-map-beforeid-label';
    beforeLabel.textContent = 'Insert before';

    this._beforeSelect = document.createElement('select');
    this._beforeSelect.className = 'national-map-beforeid-select';
    this._beforeSelect.setAttribute('aria-label', 'Layer to insert added services before');
    beforeLabel.htmlFor = this._beforeSelect.id = 'national-map-beforeid';
    this._beforeSelect.addEventListener('change', () => {
      this._layerManager?.setBeforeId(this._beforeSelect?.value || undefined);
    });
    this._refreshBeforeIdOptions();

    beforeRow.appendChild(beforeLabel);
    beforeRow.appendChild(this._beforeSelect);

    // Active layers section (above the catalog so it stays in view)
    this._activeSection = document.createElement('div');
    this._activeSection.className = 'national-map-active';

    // Catalog list
    this._catalogList = document.createElement('div');
    this._catalogList.className = 'national-map-catalog';

    content.appendChild(search);
    content.appendChild(beforeRow);
    content.appendChild(this._activeSection);
    content.appendChild(this._catalogList);

    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(this._createResizeHandle(panel));

    this._renderCatalogList();
    this._renderActiveSection();

    return panel;
  }

  /**
   * Creates the drag handle used to resize the panel width. The handle sits
   * on the panel edge facing away from its anchored side (left edge when the
   * control is in a right corner, right edge in a left corner) - the side is
   * applied in _updatePanelPosition().
   *
   * @param panel - The panel element being resized
   * @returns The resize handle element
   */
  private _createResizeHandle(panel: HTMLElement): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'national-map-resize-handle';
    handle.setAttribute('aria-hidden', 'true');
    this._resizeHandle = handle;

    let startX = 0;
    let startWidth = 0;

    const onPointerMove = (e: PointerEvent) => {
      // Panels anchored right grow leftwards (drag left = wider); panels
      // anchored left grow rightwards (drag right = wider).
      const anchoredRight = this._getControlPosition().endsWith('right');
      const delta = anchoredRight ? startX - e.clientX : e.clientX - startX;
      const maxWidth = this._mapContainer
        ? this._mapContainer.getBoundingClientRect().width - 20
        : Number.MAX_SAFE_INTEGER;
      const width = Math.round(clamp(startWidth + delta, MIN_PANEL_WIDTH, maxWidth));
      panel.style.width = `${width}px`;
    };

    const onPointerUp = (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      panel.classList.remove('resizing');
      this.setState({ panelWidth: panel.getBoundingClientRect().width });
    };

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = panel.getBoundingClientRect().width;
      panel.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
    });

    return handle;
  }

  /**
   * Repopulates the insert-before selector with the map's current style
   * layers (excluding layers managed by this control). Keeps the current
   * selection when its layer still exists.
   */
  private _refreshBeforeIdOptions(): void {
    if (!this._beforeSelect) return;

    const current = this._layerManager?.getBeforeId() ?? this._options.beforeId ?? '';
    this._beforeSelect.innerHTML = '';

    const top = document.createElement('option');
    top.value = '';
    top.textContent = 'Top (above all layers)';
    this._beforeSelect.appendChild(top);

    let layers: { id: string }[] = [];
    try {
      layers = this._map?.getStyle()?.layers ?? [];
    } catch {
      // Style not loaded yet; leave only the default option.
    }
    for (const layer of layers) {
      if (layer.id.startsWith('nm-')) continue; // skip our own layers
      const option = document.createElement('option');
      option.value = layer.id;
      option.textContent = layer.id;
      this._beforeSelect.appendChild(option);
    }

    // Restore the selection if the layer still exists; otherwise fall to top.
    this._beforeSelect.value =
      current && layers.some((l) => l.id === current) ? current : '';
  }

  /** Rebuilds the searchable, grouped catalog list. */
  private _renderCatalogList(): void {
    if (!this._catalogList) return;
    this._catalogList.innerHTML = '';

    const groups = groupByCategory(filterServices(this._catalog, this._query));

    if (groups.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'national-map-empty';
      empty.textContent = 'No services match your search.';
      this._catalogList.appendChild(empty);
      return;
    }

    // Active searches show every matching group expanded; otherwise honor
    // the per-category collapsed state.
    const searching = this._query.trim().length > 0;

    for (const group of groups) {
      const expanded = searching || !this._collapsedCategories.has(group.category);

      const groupEl = document.createElement('div');
      groupEl.className = 'national-map-group';

      const groupToggle = document.createElement('button');
      groupToggle.className = 'national-map-group-toggle';
      groupToggle.type = 'button';
      groupToggle.setAttribute('aria-expanded', String(expanded));
      groupToggle.innerHTML = `
        <span class="national-map-chevron${expanded ? ' expanded' : ''}">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        </span>
        <span class="national-map-group-title">${group.category}</span>
        <span class="national-map-group-count">${group.services.length}</span>
      `;
      groupToggle.addEventListener('click', () => {
        if (this._collapsedCategories.has(group.category)) {
          this._collapsedCategories.delete(group.category);
        } else {
          this._collapsedCategories.add(group.category);
        }
        this._renderCatalogList();
      });
      groupEl.appendChild(groupToggle);

      if (expanded) {
        for (const service of group.services) {
          groupEl.appendChild(this._createServiceRow(service));
        }
      }

      this._catalogList.appendChild(groupEl);
    }
  }

  /** Builds one catalog row with title, description, and an Add button. */
  private _createServiceRow(service: NationalMapService): HTMLElement {
    const row = document.createElement('div');
    row.className = 'national-map-service-row';

    const info = document.createElement('div');
    info.className = 'national-map-service-info';

    const name = document.createElement('div');
    name.className = 'national-map-service-title';
    name.textContent = service.title;
    name.title = service.description || service.title;
    info.appendChild(name);

    if (service.description) {
      const desc = document.createElement('div');
      desc.className = 'national-map-service-desc';
      desc.textContent = service.description;
      info.appendChild(desc);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'national-map-add-btn';
    addBtn.type = 'button';
    const added = this._layerManager?.has(service.id) ?? false;
    addBtn.textContent = added ? 'Added' : 'Add';
    addBtn.disabled = added;
    addBtn.setAttribute('aria-label', `Add ${service.title} to the map`);
    addBtn.addEventListener('click', () => this._addService(service));

    row.appendChild(info);
    row.appendChild(addBtn);
    return row;
  }

  /** Rebuilds the active layers section (visibility, opacity, remove). */
  private _renderActiveSection(): void {
    if (!this._activeSection || !this._layerManager) return;
    this._activeSection.innerHTML = '';

    const layers = this._layerManager.list();
    if (layers.length === 0) {
      this._activeSection.classList.remove('has-layers');
      return;
    }
    this._activeSection.classList.add('has-layers');

    const heading = document.createElement('div');
    heading.className = 'national-map-group-title';
    heading.textContent = 'Active layers';
    this._activeSection.appendChild(heading);

    for (const layer of layers) {
      this._activeSection.appendChild(this._createActiveRow(layer));
    }
  }

  /** Builds one active-layer row with visibility, opacity, and remove controls. */
  private _createActiveRow(layer: ActiveLayer): HTMLElement {
    const row = document.createElement('div');
    row.className = 'national-map-active-row';

    const visibility = document.createElement('input');
    visibility.className = 'national-map-visibility';
    visibility.type = 'checkbox';
    visibility.checked = layer.visible;
    visibility.setAttribute('aria-label', `Toggle ${layer.service.title} visibility`);
    visibility.addEventListener('change', () => {
      this._layerManager?.setVisibility(layer.service.id, visibility.checked);
    });

    const name = document.createElement('span');
    name.className = 'national-map-active-name';
    name.textContent = layer.service.title;
    name.title = layer.service.title;

    const opacity = document.createElement('input');
    opacity.className = 'national-map-opacity';
    opacity.type = 'range';
    opacity.min = '0';
    opacity.max = '1';
    opacity.step = '0.05';
    opacity.value = String(layer.opacity);
    opacity.setAttribute('aria-label', `${layer.service.title} opacity`);
    opacity.addEventListener('input', () => {
      this._layerManager?.setOpacity(layer.service.id, Number(opacity.value));
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'national-map-remove-btn';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.setAttribute('aria-label', `Remove ${layer.service.title} from the map`);
    removeBtn.addEventListener('click', () => this._removeService(layer.service));

    row.appendChild(visibility);
    row.appendChild(name);
    row.appendChild(opacity);
    row.appendChild(removeBtn);
    return row;
  }

  /**
   * Setup event listeners for panel positioning and click-outside behavior.
   */
  private _setupEventListeners(): void {
    // Click outside to close (check both container and panel since they're now separate)
    this._clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ignore clicks on elements detached mid-event (e.g. a panel button
      // whose row was re-rendered by its own click handler).
      if (!target.isConnected) return;
      if (
        this._container &&
        this._panel &&
        !this._container.contains(target) &&
        !this._panel.contains(target)
      ) {
        this.collapse();
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    // Update panel position on window resize
    this._resizeHandler = () => {
      if (!this._state.collapsed) {
        this._updatePanelPosition();
      }
    };
    window.addEventListener('resize', this._resizeHandler);

    // Update panel position on map resize (e.g., sidebar toggle)
    this._mapResizeHandler = () => {
      if (!this._state.collapsed) {
        this._updatePanelPosition();
      }
    };
    this._map?.on('resize', this._mapResizeHandler);
  }

  /**
   * Detect which corner the control is positioned in.
   *
   * @returns The position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   */
  private _getControlPosition(): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
    const parent = this._container?.parentElement;
    if (!parent) return 'top-right'; // Default

    if (parent.classList.contains('maplibregl-ctrl-top-left')) return 'top-left';
    if (parent.classList.contains('maplibregl-ctrl-top-right')) return 'top-right';
    if (parent.classList.contains('maplibregl-ctrl-bottom-left')) return 'bottom-left';
    if (parent.classList.contains('maplibregl-ctrl-bottom-right')) return 'bottom-right';

    return 'top-right'; // Default
  }

  /**
   * Update the panel position based on button location and control corner.
   * Positions the panel next to the button, expanding in the appropriate
   * direction, and constrains its height so it always fits inside the map
   * (small screens get a vertical scrollbar instead of overflow).
   */
  private _updatePanelPosition(): void {
    if (!this._container || !this._panel || !this._mapContainer) return;

    // Get the toggle button (first child of container)
    const button = this._container.querySelector('.national-map-toggle');
    if (!button) return;

    const buttonRect = button.getBoundingClientRect();
    const mapRect = this._mapContainer.getBoundingClientRect();
    const position = this._getControlPosition();

    // Calculate button position relative to map container
    const buttonTop = buttonRect.top - mapRect.top;
    const buttonBottom = mapRect.bottom - buttonRect.bottom;
    const buttonLeft = buttonRect.left - mapRect.left;
    const buttonRight = mapRect.right - buttonRect.right;

    const panelGap = 5; // Gap between button and panel
    const edgeMargin = 10; // Breathing room between panel and map edge

    // Reset all positioning
    this._panel.style.top = '';
    this._panel.style.bottom = '';
    this._panel.style.left = '';
    this._panel.style.right = '';

    // Offset from the panel's anchored edge (top or bottom) to the map edge
    let anchorOffset = 0;

    switch (position) {
      case 'top-left':
        // Panel expands down and to the right
        anchorOffset = buttonTop + buttonRect.height + panelGap;
        this._panel.style.top = `${anchorOffset}px`;
        this._panel.style.left = `${buttonLeft}px`;
        break;

      case 'top-right':
        // Panel expands down and to the left
        anchorOffset = buttonTop + buttonRect.height + panelGap;
        this._panel.style.top = `${anchorOffset}px`;
        this._panel.style.right = `${buttonRight}px`;
        break;

      case 'bottom-left':
        // Panel expands up and to the right
        anchorOffset = buttonBottom + buttonRect.height + panelGap;
        this._panel.style.bottom = `${anchorOffset}px`;
        this._panel.style.left = `${buttonLeft}px`;
        break;

      case 'bottom-right':
        // Panel expands up and to the left
        anchorOffset = buttonBottom + buttonRect.height + panelGap;
        this._panel.style.bottom = `${anchorOffset}px`;
        this._panel.style.right = `${buttonRight}px`;
        break;
    }

    // Constrain panel height to the space remaining inside the map so small
    // screens show a vertical scrollbar instead of clipping.
    const available = Math.max(120, mapRect.height - anchorOffset - edgeMargin);
    this._panel.style.maxHeight = `${available}px`;

    // Place the resize handle on the edge the panel grows toward: the left
    // edge when anchored to a right corner, the right edge otherwise.
    if (this._resizeHandle) {
      const anchoredRight = position.endsWith('right');
      this._resizeHandle.classList.toggle('handle-left', anchoredRight);
      this._resizeHandle.classList.toggle('handle-right', !anchoredRight);
    }
  }
}
