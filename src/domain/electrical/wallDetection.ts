import type { TileCoord, Room } from '../geometry/types';

interface WallEdge {
  /** Тайл внутри комнаты, примыкающий к стене. */
  tile: TileCoord;
  /** Какой стороной тайла он касается стены. */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Является ли эта стена внешней стеной дома. */
  isExternal: boolean;
  /** Комната, которой принадлежит тайл. */
  roomId: string;
}

/**
 * По координате клика в тайлах находит ближайшую стену комнаты, в которой клик произошёл.
 * Поле `tile` возвращаемого ребра — граничный тайл стены, ближайший к клику
 * (с привязкой по оси стены).
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

  // Находим, какой комнате принадлежит этот тайл
  const room = rooms.find(
    (r) =>
      tx >= r.rect.x &&
      tx < r.rect.x + r.rect.width &&
      ty >= r.rect.y &&
      ty < r.rect.y + r.rect.height,
  );
  if (!room) return null;

  const { x: rx, y: ry, width: rw, height: rh } = room.rect;

  // Расстояние от клика до каждой из 4 стен (в тайлах).
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

  // Привязываем клик к граничному тайлу выбранной стены.
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
