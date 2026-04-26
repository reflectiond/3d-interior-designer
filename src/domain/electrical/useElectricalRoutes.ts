import { useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { computeRoutes } from './pathfinder';

/**
 * Hook that recomputes electrical routes whenever points change.
 * Call this in a component that renders during Stage 2.
 */
export function useElectricalRoutes() {
  const { rooms, electricalPanel, electricalPoints, setElectricalRoutes } = useProjectStore();

  useEffect(() => {
    if (!electricalPanel || rooms.length === 0) {
      setElectricalRoutes([]);
      return;
    }

    // Build ceiling tile set from all room tiles
    const ceilingTiles = new Set<string>();
    for (const room of rooms) {
      for (let y = room.rect.y; y < room.rect.y + room.rect.height; y++) {
        for (let x = room.rect.x; x < room.rect.x + room.rect.width; x++) {
          ceilingTiles.add(`${x},${y}`);
        }
      }
    }

    // Map electrical points to tile positions
    const points = electricalPoints.map((p) => ({
      id: p.id,
      tile: { x: Number(p.wallId.split('_')[1]), y: Number(p.wallId.split('_')[2]) },
    }));

    const routes = computeRoutes({
      ceilingTiles,
      panelPos: electricalPanel,
      points,
    });

    setElectricalRoutes(routes);
  }, [rooms, electricalPanel, electricalPoints, setElectricalRoutes]);
}
