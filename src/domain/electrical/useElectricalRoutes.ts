import { useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { computeRoutes } from './pathfinder';

/**
 * Hook, пересчитывающий маршруты электрики при каждом изменении точек.
 * Вызывайте в компоненте, который рендерится на Stage 2.
 */
export function useElectricalRoutes() {
  const { rooms, electricalPanel, electricalPoints, setElectricalRoutes } = useProjectStore();

  useEffect(() => {
    if (!electricalPanel || rooms.length === 0) {
      setElectricalRoutes([]);
      return;
    }

    // Собираем множество потолочных тайлов из всех тайлов комнат
    const ceilingTiles = new Set<string>();
    for (const room of rooms) {
      for (let y = room.rect.y; y < room.rect.y + room.rect.height; y++) {
        for (let x = room.rect.x; x < room.rect.x + room.rect.width; x++) {
          ceilingTiles.add(`${x},${y}`);
        }
      }
    }

    // Маппим электрические точки в координаты тайлов
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
