import type { TileCoord, Room } from '../geometry/types';

interface WallEdge {
  /** Tile that is inside a room, adjacent to a wall */
  tile: TileCoord;
  /** Which side of the tile touches the wall */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Is this an external wall of the house? */
  isExternal: boolean;
  /** Room this tile belongs to */
  roomId: string;
}

/**
 * Given a click position in tile coordinates, find the nearest wall edge.
 * Returns null if the click is not close enough to any wall.
 */
export function findNearestWallEdge(
  tileX: number,
  tileY: number,
  rooms: Room[],
  gridWidth: number,
  gridHeight: number,
): WallEdge | null {
  // Convert to tile integers
  const tx = Math.floor(tileX);
  const ty = Math.floor(tileY);

  // Find which room this tile belongs to
  const room = rooms.find(
    (r) =>
      tx >= r.rect.x &&
      tx < r.rect.x + r.rect.width &&
      ty >= r.rect.y &&
      ty < r.rect.y + r.rect.height,
  );
  if (!room) return null;

  // Fractional position within the tile (0..1)
  const fx = tileX - tx;
  const fy = tileY - ty;

  // Check each edge of the tile — is it a room boundary?
  const edges: WallEdge[] = [];

  // Left edge (x = room.rect.x)
  if (tx === room.rect.x) {
    edges.push({
      tile: { x: tx, y: ty },
      side: 'left',
      isExternal: tx === 0,
      roomId: room.id,
    });
  }
  // Right edge (x = room.rect.x + room.rect.width - 1)
  if (tx === room.rect.x + room.rect.width - 1) {
    edges.push({
      tile: { x: tx, y: ty },
      side: 'right',
      isExternal: tx + 1 >= gridWidth,
      roomId: room.id,
    });
  }
  // Bottom edge (y = room.rect.y)
  if (ty === room.rect.y) {
    edges.push({
      tile: { x: tx, y: ty },
      side: 'bottom',
      isExternal: ty === 0,
      roomId: room.id,
    });
  }
  // Top edge (y = room.rect.y + room.rect.height - 1)
  if (ty === room.rect.y + room.rect.height - 1) {
    edges.push({
      tile: { x: tx, y: ty },
      side: 'top',
      isExternal: ty + 1 >= gridHeight,
      roomId: room.id,
    });
  }

  if (edges.length === 0) return null;

  // Pick the edge closest to the click position
  let best = edges[0];
  let bestDist = Infinity;
  for (const edge of edges) {
    let dist: number;
    switch (edge.side) {
      case 'left':
        dist = fx;
        break;
      case 'right':
        dist = 1 - fx;
        break;
      case 'bottom':
        dist = fy;
        break;
      case 'top':
        dist = 1 - fy;
        break;
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = edge;
    }
  }

  return best;
}
