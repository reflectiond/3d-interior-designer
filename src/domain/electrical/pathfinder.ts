import type { TileCoord, ElectricalRoute } from '../geometry/types';

interface PathfinderInput {
  /** All ceiling tiles available for routing (every room tile is a ceiling tile) */
  ceilingTiles: Set<string>;
  /** Electrical panel position */
  panelPos: TileCoord;
  /** Points to route to, each with an id and tile position */
  points: { id: string; tile: TileCoord }[];
}

/** Convert tile coord to set key */
function key(t: TileCoord): string {
  return `${t.x},${t.y}`;
}

/** Parse key back to tile coord */
function parseKey(k: string): TileCoord {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

/** 4-directional neighbors */
function neighbors(t: TileCoord): TileCoord[] {
  return [
    { x: t.x - 1, y: t.y },
    { x: t.x + 1, y: t.y },
    { x: t.x, y: t.y - 1 },
    { x: t.x, y: t.y + 1 },
  ];
}

/**
 * BFS from a source tile to a target tile, moving only through allowed ceiling tiles.
 * Returns the path (list of tiles from source to target, inclusive), or null if unreachable.
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
          // Reconstruct path
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
 * Build routing tree: compute routes from the electrical panel to each point.
 *
 * Strategy: greedily route each point to the nearest node on the existing tree.
 * The tree starts with just the panel. For each new point, BFS finds the shortest
 * path from the point to any tile already in the tree, then that path is added
 * to the tree.
 *
 * This produces a reasonable (not necessarily optimal) wiring tree.
 */
export function computeRoutes(input: PathfinderInput): ElectricalRoute[] {
  const { ceilingTiles, panelPos, points } = input;

  if (points.length === 0) return [];

  // The "tree" is the set of tiles that already have wiring
  const treeTiles = new Set<string>([key(panelPos)]);
  const routes: ElectricalRoute[] = [];

  // Sort points by Manhattan distance to panel (closest first for better tree shape)
  const sorted = [...points].sort((a, b) => {
    const da = Math.abs(a.tile.x - panelPos.x) + Math.abs(a.tile.y - panelPos.y);
    const db = Math.abs(b.tile.x - panelPos.x) + Math.abs(b.tile.y - panelPos.y);
    return da - db;
  });

  for (const point of sorted) {
    // BFS from the point to any tile in the tree
    const path = bfsToTree(point.tile, treeTiles, ceilingTiles);
    if (path) {
      // Add all path tiles to the tree
      for (const t of path) {
        treeTiles.add(key(t));
      }
      routes.push({ pointId: point.id, path });
    } else {
      // Unreachable — still record empty route
      routes.push({ pointId: point.id, path: [] });
    }
  }

  return routes;
}

/**
 * BFS from a source to the nearest tile in the existing tree.
 * Returns path from source to the tree node (inclusive).
 */
function bfsToTree(
  source: TileCoord,
  treeTiles: Set<string>,
  allowed: Set<string>,
): TileCoord[] | null {
  const sourceKey = key(source);

  // If source is already on the tree
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
          // Found the tree — reconstruct path
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
