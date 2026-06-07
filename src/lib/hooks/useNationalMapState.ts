import { useState, useCallback } from 'react';
import type { NationalMapState } from '../core/types';

/**
 * Default initial state for the control
 */
const DEFAULT_STATE: NationalMapState = {
  collapsed: true,
  panelWidth: 320,
  activeLayerIds: [],
  data: {},
};

/**
 * Custom hook for managing National Map control state in React applications.
 *
 * This hook provides a simple way to track and update the state
 * of a NationalMapControl from React components.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, setCollapsed, setData, reset } = useNationalMapState();
 *
 *   return (
 *     <div>
 *       <button onClick={() => setCollapsed(!state.collapsed)}>
 *         {state.collapsed ? 'Expand' : 'Collapse'}
 *       </button>
 *       <NationalMapControlReact
 *         map={map}
 *         collapsed={state.collapsed}
 *         onStateChange={(newState) => setState(newState)}
 *       />
 *     </div>
 *   );
 * }
 * ```
 *
 * @param initialState - Optional initial state values
 * @returns Object containing state and update functions
 */
export function useNationalMapState(initialState?: Partial<NationalMapState>) {
  const [state, setState] = useState<NationalMapState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  /**
   * Sets the collapsed state
   */
  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  /**
   * Sets the panel width
   */
  const setPanelWidth = useCallback((panelWidth: number) => {
    setState((prev) => ({ ...prev, panelWidth }));
  }, []);

  /**
   * Sets custom data in the state
   */
  const setData = useCallback((data: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, data: { ...prev.data, ...data } }));
  }, []);

  /**
   * Resets the state to default values
   */
  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  /**
   * Toggles the collapsed state
   */
  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  return {
    state,
    setState,
    setCollapsed,
    setPanelWidth,
    setData,
    reset,
    toggle,
  };
}
