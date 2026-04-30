// Design-токены: размеры, отступы, константы
export const TOKENS = {
  /** Размер тайла в метрах. */
  tileSize: 0.25,
  /** Высота комнаты по умолчанию в метрах. */
  roomHeight: 2.7,
  /** Диаметр провода в метрах (3D). */
  wireDiameter: 0.02,
  /** Debounce автосохранения в localStorage, мс. */
  autosaveDebounce: 500,
} as const;
