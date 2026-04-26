// Design tokens: sizes, spacing, constants
export const TOKENS = {
  /** Tile size in meters */
  tileSize: 0.25,
  /** Default room height in meters */
  roomHeight: 2.7,
  /** Wire diameter in meters (3D) */
  wireDiameter: 0.02,
  /** localStorage autosave debounce in ms */
  autosaveDebounce: 500,
} as const;
