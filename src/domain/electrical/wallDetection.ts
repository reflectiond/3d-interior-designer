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
 * Given a click position in tile coordinates, find the nearest wall edge of
 * the containing room. The returned edge's `tile` is the boundary tile on
 * the wall closest to the click (snapped along the wall axis).
 *
 * Возвращает null только если клик пришёлся вне любой комнаты. Если клик
 * внутри комнаты — гарантированно возвращает ближайшую стену; раньше
 * (до v1.17.1) функция требовала, чтобы клик пришёлся РОВНО на boundary
 * тайл, и для интерьерных кликов отдавала null → точка не ставилась.
 */
export function findNearestWallEdge(
  tileX: number,
  tileY: number,
  rooms: Room[],
  gridWidth: number,
  gridHeight: number,
): WallEdge | null {
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

  const { x: rx, y: ry, width: rw, height: rh } = room.rect;

  // Distance from click to each of 4 walls (in tile-units).
  // Walls — линии тайлов на границе rect'а.
  const distLeft = tileX - rx; // расстояние до западной стены
  const distRight = rx + rw - tileX; // до восточной (ширина rect'а в тайлах)
  const distBottom = tileY - ry; // до южной
  const distTop = ry + rh - tileY; // до северной

  const sides: { side: WallEdge['side']; dist: number }[] = [
    { side: 'left', dist: distLeft },
    { side: 'right', dist: distRight },
    { side: 'bottom', dist: distBottom },
    { side: 'top', dist: distTop },
  ];
  const bestSide = sides.reduce((a, b) => (b.dist < a.dist ? b : a)).side;

  // Snap click to the boundary tile of the chosen wall.
  // Для горизонтальных стен (top/bottom) фиксируем X на оси клика, Y
  // ставим на boundary; для вертикальных — наоборот.
  let snappedTile: TileCoord;
  let isExternal: boolean;
  switch (bestSide) {
    case 'left':
      snappedTile = { x: rx, y: ty };
      isExternal = rx === 0;
      break;
    case 'right':
      snappedTile = { x: rx + rw - 1, y: ty };
      isExternal = rx + rw >= gridWidth;
      break;
    case 'bottom':
      snappedTile = { x: tx, y: ry };
      isExternal = ry === 0;
      break;
    case 'top':
      snappedTile = { x: tx, y: ry + rh - 1 };
      isExternal = ry + rh >= gridHeight;
      break;
  }

  return { tile: snappedTile, side: bestSide, isExternal, roomId: room.id };
}
