// src/theme/palette.ts
// Single source of truth for all colors used in 2D and 3D views.
// Importing hex colors from anywhere else is forbidden by ESLint.

export const PALETTE = {
  // Floor coverings
  floor: {
    linoleum: '#A89578',
    laminate: '#C9A678',
    tile: '#E8E8E8',
    quartz_vinyl: '#8B7355',
    screed: '#9E9E9E',
  },
  // Wall coverings
  walls: {
    wallpaper: '#D9C7A7',
    paint: '#FAFAFA',
    plaster: '#C4C4C4',
    external: '#5A5A5A',
  },
  // Ceiling types
  ceiling: {
    stretch: '#F5F5F5',
    drywall: '#E0E0E0',
  },
  // Furniture categorical colors (used for simplified rendering in 2D and 3D)
  furniture: {
    sofa: '#6B7C8C',
    bed: '#8B7355',
    table: '#A0826D',
    chair: '#3D3D3D',
    wardrobe: '#7A6240',
    chair_office: '#2C2C2C',
    desk: '#A0826D',
    kitchen_lower: '#D4C4A8',
    kitchen_upper: '#D4C4A8',
    kitchen_column: '#D4C4A8',
    toilet: '#FFFFFF',
    sink: '#FFFFFF',
  },
  // Electrical elements
  electrical: {
    wire: '#FFB800',
    socket: '#FF6B35',
    switch: '#FF9F40',
    panel: '#D32F2F',
  },
  // Room zone background fills (2D)
  rooms: {
    bathroom: '#E1F5FE',
    kitchen: '#FFF3E0',
    boiler: '#FFEBEE',
    living: '#F3E5F5',
    bedroom: '#E8F5E9',
    corridor: '#F5F5F5',
    wardrobe: '#FFF8E1',
    veranda: '#E0F2F1',
  },
  // UI text
  text: {
    primary: '#333333',
    secondary: '#666666',
  },
  // v1.2.0 — heated floor overlay (warm coral). background rendered at opacity 0.15,
  // icon (heat waves) at opacity 0.4 so they layer above the floor fill but stay subtle.
  heated_floor: {
    background: '#FF8A65',
    icon: '#E64A19',
  },
  // v1.2.0 — fine-finish floor pattern seam colors. Used for the lines that delineate
  // boards/tiles/chevrons on top of the base floor color (PALETTE.floor.<type>).
  // v1.8.0 — added `linoleum` (speckle dots), opacity bumped from 0.3–0.5 to 0.6–0.7
  // so the overlay-style pattern stays visible on pastel room fills (F6.2.10).
  floor_pattern_seam: {
    laminate: '#8C7355',
    tile: '#A0A0A0',
    quartz_vinyl: '#6B5C45',
    linoleum: '#5C4F3A',
  },
  // v1.4.0 — feedback colors during furniture placement and drag-to-move.
  // valid/invalid render with opacity 0.35; ghost (drag preview) at 0.4.
  placement_highlight: {
    valid: '#4CAF50',
    invalid: '#E53935',
    ghost: '#9E9E9E',
  },
  // v1.5.0 — windows and door openings. window_glass renders at opacity 0.5
  // in 3D as a translucent pane; door_arc draws the swing arc in 2D.
  openings: {
    window_frame: '#3D5A6C',
    window_glass: '#B3D9E6',
    door_frame: '#6B5C45',
    door_arc: '#888888',
  },
  // v1.6.0 — secret layout editor (F11.x). Used only for the editor's grid,
  // hover previews, and selection ring. Not visible in the production app.
  editor: {
    grid: '#D0D0D0',
    preview: '#90CAF9',
    selection: '#1565C0',
  },
} as const;
