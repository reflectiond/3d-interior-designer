import { z } from 'zod/v4';

// --- Базовые типы ---

export const TileCoordSchema = z.object({
  x: z.int().min(0),
  y: z.int().min(0),
});
export type TileCoord = z.infer<typeof TileCoordSchema>;

export const RoomType = z.enum([
  'bedroom',
  'bathroom',
  'kitchen',
  'boiler',
  'living',
  'corridor',
  'wardrobe',
]);
export type RoomType = z.infer<typeof RoomType>;

// Веранда отображается, но не участвует в планировании
export const VerandaType = z.literal('veranda');

// --- JSON-схема планировки (как хранится в файлах layout) ---

// F11.3 (v1.14.0): минимум комнаты — площадь ≥ 4 м² (64 тайла²),
// per-side минимум 2 тайла (= 0.5 м) — чтобы исключить вырожденные
// 1-tile-wide, но не блокировать узкие 2×32 / 4×16 формы.
// Семантическая проверка площади остаётся в `validateEditor`
// (issue-уровень, не блокирующий импорт).
export const LayoutRoomSchema = z.object({
  id: z.string(),
  type: RoomType,
  name: z.string(),
  x: z.int().min(0),
  y: z.int().min(0),
  width: z.int().min(2),
  height: z.int().min(2),
});
export type LayoutRoom = z.infer<typeof LayoutRoomSchema>;

export const LayoutVerandaSchema = z.object({
  name: z.string(),
  x: z.int(),
  y: z.int(),
  width: z.int().min(1),
  height: z.int().min(1),
});

// --- Проёмы (окна / двери) — v1.5.0 ---
//
// Изначально спецификация §3.2 кодировала проём как `wallId + position 0..1`, но
// в наших планировках сегменты стен не перечисляются — стены выводятся из
// прямоугольников комнат. Вместо этого мы кодируем проём как осесимметричный
// сегмент тайлов (start, end). Это однозначно и обратно совместимо со старыми
// layout'ами (по умолчанию — пустые массивы).
//
// Уточнено в v1.5.0.

const AxisAlignedSegment = z
  .object({ start: TileCoordSchema, end: TileCoordSchema })
  .refine((seg) => seg.start.x === seg.end.x || seg.start.y === seg.end.y, {
    message: 'Opening segment must be axis-aligned',
  })
  .refine((seg) => seg.start.x !== seg.end.x || seg.start.y !== seg.end.y, {
    message: 'Opening segment must have non-zero length',
  });

export const WindowSchema = AxisAlignedSegment.and(
  z.object({
    id: z.string().min(1),
    sill_height_m: z.number().min(0).max(3).default(0.9),
    height_m: z.number().min(0.1).max(3).default(1.5),
  }),
);
export type Window = z.infer<typeof WindowSchema>;

export const DoorSchema = AxisAlignedSegment.and(
  z.object({
    id: z.string().min(1),
    height_m: z.number().min(0.5).max(3).default(2.1),
    hinge: z.enum(['start', 'end']).default('start'),
    swing_side: z.enum(['left', 'right']).default('left'),
  }),
);
export type Door = z.infer<typeof DoorSchema>;

export const LayoutSchema = z.object({
  id: z.number(),
  name: z.string(),
  gridWidth: z.int().min(1),
  gridHeight: z.int().min(1),
  rooms: z.array(LayoutRoomSchema).min(1),
  veranda: LayoutVerandaSchema.optional(),
  electricalPanel: TileCoordSchema,
  windows: z.array(WindowSchema).default([]),
  doors: z.array(DoorSchema).default([]),
});
export type Layout = z.infer<typeof LayoutSchema>;

// --- Runtime-типы (после загрузки планировки в проект) ---

export type Room = {
  id: string;
  type: RoomType;
  name: string;
  tiles: TileCoord[];
  area: number; // м², вычисляется по тайлам
  rect: { x: number; y: number; width: number; height: number };
};

export type WallSegment = {
  id: string;
  type: 'external' | 'internal';
  start: TileCoord;
  end: TileCoord;
  adjacentRooms: string[]; // ID комнат
};

export type ElectricalPoint = {
  id: string;
  wallId: string;
  position: number; // 0..1 вдоль стены
  type: 'socket' | 'switch';
};

export type ElectricalRoute = {
  pointId: string;
  path: TileCoord[];
};

export type FurnitureInstance = {
  id: string;
  catalogId: string;
  position: TileCoord;
  rotation: 0 | 90 | 180 | 270;
  mirrored: boolean;
};

export type FloorType = 'screed' | 'screed_heated';
export type CeilingType = 'stretch' | 'drywall';

// v1.9.0 — разделили материал и выбор покрытия. Утилиты узоров и ключи
// прайсинга знают только о реальных материалах; пользовательский covering
// может дополнительно принимать значение `'none'` (F3.1.3 — «Без покрытия»),
// и тогда для этой комнаты ничего не рендерится и не учитывается в смете.
export type FloorMaterial = 'linoleum' | 'laminate' | 'tile' | 'quartz_vinyl';
export type FloorCovering = FloorMaterial | 'none';

export type WallMaterial = 'wallpaper' | 'paint';
export type WallCovering = WallMaterial | 'none';
