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

export const LayoutSchema = z.object({
  id: z.number(),
  name: z.string(),
  gridWidth: z.int().min(1),
  gridHeight: z.int().min(1),
  rooms: z.array(LayoutRoomSchema).min(1),
  veranda: LayoutVerandaSchema.optional(),
  electricalPanel: TileCoordSchema,
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
export type FloorCovering = 'linoleum' | 'laminate' | 'tile' | 'quartz_vinyl';
export type WallCovering = 'wallpaper' | 'paint';
