import { NationalMapControl } from "./lib/core/NationalMapControl";
import type { NationalMapState } from "./lib/core/types";
import "./lib/styles/national-map.css";

type GeoLibreMapControlPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface GeoLibreAppAPI {
  addMapControl: (
    control: NationalMapControl,
    position?: GeoLibreMapControlPosition,
  ) => boolean;
  removeMapControl: (control: NationalMapControl) => void;
}

interface GeoLibrePlugin {
  id: string;
  name: string;
  version: string;
  activate: (app: GeoLibreAppAPI) => boolean | void;
  deactivate: (app: GeoLibreAppAPI) => void;
  getMapControlPosition?: () => GeoLibreMapControlPosition;
  setMapControlPosition?: (
    app: GeoLibreAppAPI,
    position: GeoLibreMapControlPosition,
  ) => boolean | void;
  getProjectState?: () => unknown;
  applyProjectState?: (app: GeoLibreAppAPI, state: unknown) => boolean | void;
}

let control: NationalMapControl | null = null;
let position: GeoLibreMapControlPosition = "top-right";
let pendingState: Partial<NationalMapState> | null = null;

function createControl(): NationalMapControl {
  const nextControl = new NationalMapControl({
    collapsed: pendingState?.collapsed ?? true,
    panelWidth: pendingState?.panelWidth ?? 320,
    title: "USGS National Map",
  });

  if (pendingState) {
    nextControl.setState(pendingState);
  }

  return nextControl;
}

function isNationalMapState(
  value: unknown,
): value is Partial<NationalMapState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if ("collapsed" in candidate && typeof candidate.collapsed !== "boolean") {
    return false;
  }
  if ("panelWidth" in candidate && typeof candidate.panelWidth !== "number") {
    return false;
  }
  if (
    "activeLayerIds" in candidate &&
    candidate.activeLayerIds !== undefined &&
    !Array.isArray(candidate.activeLayerIds)
  ) {
    return false;
  }
  if (
    "data" in candidate &&
    (typeof candidate.data !== "object" ||
      candidate.data === null ||
      Array.isArray(candidate.data))
  ) {
    return false;
  }

  return true;
}

export const plugin: GeoLibrePlugin = {
  id: "maplibre-gl-national-map",
  name: "National Map",
  version: "0.1.0",
  activate(app) {
    control = control ?? createControl();
    const added = app.addMapControl(control, position);
    if (!added) {
      control = null;
      return false;
    }
  },
  deactivate(app) {
    if (!control) return;
    pendingState = control.getState();
    app.removeMapControl(control);
    control = null;
  },
  getMapControlPosition() {
    return position;
  },
  setMapControlPosition(app, nextPosition) {
    position = nextPosition;
    if (!control) return;

    app.removeMapControl(control);
    const added = app.addMapControl(control, position);
    if (!added) {
      pendingState = control.getState();
      control = null;
      return false;
    }
  },
  getProjectState() {
    return control?.getState() ?? pendingState ?? undefined;
  },
  applyProjectState(_app, state) {
    if (!isNationalMapState(state)) return false;
    pendingState = state;
    control?.setState(state);
  },
};

export default plugin;
