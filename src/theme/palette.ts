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
  },
} as const;
