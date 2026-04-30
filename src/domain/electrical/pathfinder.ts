import type { TileCoord, ElectricalRoute } from '../geometry/types';

interface PathfinderInput {
  /** Все потолочные тайлы, доступные для прокладки (каждый тайл комнаты — потолочный). */
  ceilingTiles: Set<string>;
  /** Положение электрощита. */
  panelPos: TileCoord;
  /** Точки, к которым нужно проложить маршруты — каждая с id и координатой тайла. */
  points: { id: string; tile: TileCoord }[];
}

/** Преобразовать координату тайла в ключ для Set. */
function key(t: TileCoord): string {
  return `${t.x},${t.y}`;
}

/** Распарсить ключ обратно в координату тайла. */
function parseKey(k: string): TileCoord {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

/** Соседи по 4 направлениям. */
function neighbors(t: TileCoord): TileCoord[] {
  return [
    { x: t.x - 1, y: t.y },
    { x: t.x + 1, y: t.y },
    { x: t.x, y: t.y - 1 },
    { x: t.x, y: t.y + 1 },
  ];
}

/**
 * BFS из исходного тайла до целевого, перемещаемся только по разрешённым потолочным тайлам.
 * Возвращает путь (список тайлов от source до target включительно) или null, если цель недостижима.
 */
export function bfsPath(
  source: TileCoord,
  target: TileCoord,
  allowed: Set<string>,
): TileCoord[] | null {
  const sourceKey = key(source);
  const targetKey = key(target);

  if (sourceKey === targetKey) return [source];
  if (!allowed.has(sourceKey) || !allowed.has(targetKey)) return null;

  const visited = new Set<string>([sourceKey]);
  const parent = new Map<string, string>();
  const queue: TileCoord[] = [source];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of neighbors(current)) {
      const nk = key(n);
      if (!visited.has(nk) && allowed.has(nk)) {
        visited.add(nk);
        parent.set(nk, key(current));
        if (nk === targetKey) {
          // Восстанавливаем путь
          const path: TileCoord[] = [];
          let cur = targetKey;
          while (cur !== sourceKey) {
            path.push(parseKey(cur));
            cur = parent.get(cur)!;
          }
          path.push(source);
          path.reverse();
          return path;
        }
        queue.push(n);
      }
    }
  }
  return null;
}

/**
 * Построить дерево маршрутизации: вычислить маршруты от электрощита к каждой точке.
 *
 * Стратегия: жадно прокладываем каждую точку до ближайшего узла существующего дерева.
 * Дерево стартует с одного щита. Для каждой новой точки BFS находит кратчайший путь
 * от точки до любого тайла, уже входящего в дерево, и затем этот путь добавляется
 * в дерево.
 *
 * Результат — разумное (необязательно оптимальное) дерево разводки.
 */
export function computeRoutes(input: PathfinderInput): ElectricalRoute[] {
  const { ceilingTiles, panelPos, points } = input;

  if (points.length === 0) return [];

  // «Дерево» — это множество тайлов, уже включённых в разводку
  const treeTiles = new Set<string>([key(panelPos)]);
  const routes: ElectricalRoute[] = [];

  // Сортируем точки по манхэттенскому расстоянию до щита (ближайшие первыми — лучше форма дерева)
  const sorted = [...points].sort((a, b) => {
    const da = Math.abs(a.tile.x - panelPos.x) + Math.abs(a.tile.y - panelPos.y);
    const db = Math.abs(b.tile.x - panelPos.x) + Math.abs(b.tile.y - panelPos.y);
    return da - db;
  });

  for (const point of sorted) {
    // BFS от точки до любого тайла, уже входящего в дерево
    const path = bfsToTree(point.tile, treeTiles, ceilingTiles);
    if (path) {
      // Добавляем все тайлы пути в дерево
      for (const t of path) {
        treeTiles.add(key(t));
      }
      routes.push({ pointId: point.id, path });
    } else {
      // Недостижимо — всё равно записываем пустой маршрут
      routes.push({ pointId: point.id, path: [] });
    }
  }

  return routes;
}

/**
 * BFS из исходного тайла до ближайшего тайла существующего дерева.
 * Возвращает путь от source до узла дерева включительно.
 */
function bfsToTree(
  source: TileCoord,
  treeTiles: Set<string>,
  allowed: Set<string>,
): TileCoord[] | null {
  const sourceKey = key(source);

  // Если source уже в дереве
  if (treeTiles.has(sourceKey)) return [source];
  if (!allowed.has(sourceKey)) return null;

  const visited = new Set<string>([sourceKey]);
  const parent = new Map<string, string>();
  const queue: TileCoord[] = [source];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of neighbors(current)) {
      const nk = key(n);
      if (!visited.has(nk) && allowed.has(nk)) {
        visited.add(nk);
        parent.set(nk, key(current));
        if (treeTiles.has(nk)) {
          // Дерево найдено — восстанавливаем путь
          const path: TileCoord[] = [];
          let cur = nk;
          while (cur !== sourceKey) {
            path.push(parseKey(cur));
            cur = parent.get(cur)!;
          }
          path.push(source);
          path.reverse();
          return path;
        }
        queue.push(n);
      }
    }
  }
  return null;
}
