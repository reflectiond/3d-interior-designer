import { z } from 'zod/v4';

// --- Base types ---

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

// Veranda is display-only, not part of planning
export const VerandaType = z.literal('veranda');

// --- Layout JSON schema (as stored in layout files) ---

export const LayoutRoomSchema = z.object({
  id: z.string(),
  type: RoomType,
  name: z.string(),
  x: z.int().min(0),
  y: z.int().min(0),
  width: z.int().min(4),
  height: z.int().min(4),
});
export type LayoutRoom = z.infer<typeof LayoutRoomSchema>;

export const LayoutVerandaSchema = z.object({
  name: z.string(),
  x: z.int(),
  y: z.int(),
  width: z.int().min(1),
  height: z.int().min(1),
});

// --- Openings (windows / doors) — v1.5.0 ---
//
// Spec §3.2 originally encoded an opening as `wallId + position 0..1`, but
// our layouts don't enumerate wall segments — walls are derived from room
// rectangles. We instead encode the opening as an axis-aligned tile segment
// (start, end). This is unambiguous and backward-compatible for old layouts
// (default to empty arrays).
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

// --- Runtime types (after loading layout into project) ---

export type Room = {
  id: string;
  type: RoomType;
  name: string;
  tiles: TileCoord[];
  area: number; // m², computed from tiles
  rect: { x: number; y: number; width: number; height: number };
};

export type WallSegment = {
  id: string;
  type: 'external' | 'internal';
  start: TileCoord;
  end: TileCoord;
  adjacentRooms: string[]; // room IDs
};

export type ElectricalPoint = {
  id: string;
  wallId: string;
  position: number; // 0..1 along wall
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

// v1.9.0 — split material from covering choice. The pattern utilities and
// pricing keys only know about real materials; the user-facing covering can
// additionally be `'none'` (F3.1.3 — «Без покрытия»), in which case nothing
// is rendered or priced for that room.
export type FloorMaterial = 'linoleum' | 'laminate' | 'tile' | 'quartz_vinyl';
export type FloorCovering = FloorMaterial | 'none';

export type WallMaterial = 'wallpaper' | 'paint';
export type WallCovering = WallMaterial | 'none';
