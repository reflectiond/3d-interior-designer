// src/theme/palette.ts
// Единый источник истины для всех цветов в 2D и 3D отображениях.
// Импорт hex-цветов откуда-либо ещё запрещён правилом ESLint.

export const PALETTE = {
  // Напольные покрытия
  floor: {
    linoleum: '#A89578',
    laminate: '#C9A678',
    tile: '#E8E8E8',
    quartz_vinyl: '#8B7355',
    screed: '#9E9E9E',
  },
  // Настенные покрытия
  walls: {
    wallpaper: '#D9C7A7',
    paint: '#FAFAFA',
    plaster: '#C4C4C4',
    external: '#5A5A5A',
  },
  // Типы потолков
  ceiling: {
    stretch: '#F5F5F5',
    drywall: '#E0E0E0',
  },
  // Категориальные цвета мебели (для упрощённого рендера в 2D и 3D)
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
    // F15.b2 (v1.16.0) — расширение каталога: ванна, душ, стеллаж, журнальный
    // столик, односпальная кровать, кресло. Цвета — для box-fallback'а;
    // glTF Kenney покажет свои натуральные тона.
    bathtub: '#F0F0F0',
    shower: '#E0E8EE',
    bookshelf: '#8B6F4D',
    coffee_table: '#7A6648',
    bed_single: '#A98A6B',
    armchair: '#7C4A4A',
  },
  // Электрика
  electrical: {
    wire: '#FFB800',
    socket: '#FF6B35',
    switch: '#FF9F40',
    panel: '#D32F2F',
  },
  // Фоновая заливка зон комнат (2D)
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
  // Текст UI
  text: {
    primary: '#333333',
    secondary: '#666666',
  },
  // v1.2.0 — оверлей тёплого пола (тёплый коралл). background рендерится с opacity 0.15,
  // иконка (волны тепла) — с opacity 0.4, чтобы накладываться на заливку пола, но оставаться мягкой.
  heated_floor: {
    background: '#FF8A65',
    icon: '#E64A19',
  },
  // v1.2.0 — цвета швов узоров чистового пола. Используются для линий, разделяющих
  // доски/плитку/ёлочку поверх базового цвета пола (PALETTE.floor.<type>).
  // v1.8.0 — добавлен `linoleum` (точки-крапинки), opacity поднят с 0.3–0.5 до 0.6–0.7,
  // чтобы overlay-узор оставался виден на пастельных заливках комнат (F6.2.10).
  floor_pattern_seam: {
    laminate: '#8C7355',
    tile: '#A0A0A0',
    quartz_vinyl: '#6B5C45',
    linoleum: '#5C4F3A',
  },
  // v1.4.0 — цвета подсветки при размещении мебели и drag-to-move.
  // valid/invalid рендерятся с opacity 0.35; ghost (превью при перетаскивании) — 0.4.
  placement_highlight: {
    valid: '#4CAF50',
    invalid: '#E53935',
    ghost: '#9E9E9E',
    // F11.3.3 (v1.14.0) — drag-preview окраска при недостаточной площади:
    // комната валидна по форме, но < 4 м² (≠ невалидная — overlap).
    warning: '#FFB300',
  },
  // v1.5.0 — окна и дверные проёмы. window_glass рендерится в 3D с opacity 0.5
  // как полупрозрачное стекло; door_arc рисует дугу распахивания в 2D.
  openings: {
    window_frame: '#3D5A6C',
    window_glass: '#B3D9E6',
    door_frame: '#6B5C45',
    door_arc: '#888888',
  },
  // v1.6.0 — скрытый редактор планировок (F11.x). Используется только для сетки редактора,
  // hover-превью и кольца выделения. Не виден в production-приложении.
  editor: {
    grid: '#D0D0D0',
    preview: '#90CAF9',
    selection: '#1565C0',
  },
} as const;
