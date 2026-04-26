import { useProjectStore } from '../store/projectStore';
import type { ProjectState } from '../store/projectStore';
import type { FloorType, CeilingType, FloorCovering, WallCovering } from '../domain/geometry/types';
import { LayoutSchema } from '../domain/geometry/types';
import layout1Data from '../data/layouts/layout1.json';
import layout2Data from '../data/layouts/layout2.json';
import layout3Data from '../data/layouts/layout3.json';

const layoutsById = new Map([
  [1, LayoutSchema.parse(layout1Data)],
  [2, LayoutSchema.parse(layout2Data)],
  [3, LayoutSchema.parse(layout3Data)],
]);

interface ProjectJSON {
  version: '1.0';
  layoutId: 1 | 2 | 3 | null;
  currentStage: 1 | 2 | 3 | 4;
  flooring: Record<string, string>;
  ceiling: Record<string, string>;
  electricalPoints: ProjectState['electricalPoints'];
  floorCovering: Record<string, string>;
  wallCovering: Record<string, string>;
  furniture: ProjectState['furniture'];
}

export function exportProjectJSON(state: ProjectState) {
  const data: ProjectJSON = {
    version: '1.0',
    layoutId: state.layoutId,
    currentStage: state.currentStage,
    flooring: { ...state.flooring },
    ceiling: { ...state.ceiling },
    electricalPoints: [...state.electricalPoints],
    floorCovering: { ...state.floorCovering },
    wallCovering: { ...state.wallCovering },
    furniture: [...state.furniture],
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'interior-project.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectJSON(jsonText: string) {
  try {
    const data = JSON.parse(jsonText) as ProjectJSON;
    if (data.version !== '1.0') {
      alert('Неподдерживаемая версия проекта');
      return;
    }

    const store = useProjectStore.getState();

    if (data.layoutId) {
      const layout = layoutsById.get(data.layoutId);
      if (layout) {
        store.selectLayout(layout);
      }
    }

    useProjectStore.setState({
      currentStage: data.currentStage,
      flooring: (data.flooring ?? {}) as Record<string, FloorType>,
      ceiling: (data.ceiling ?? {}) as Record<string, CeilingType>,
      electricalPoints: data.electricalPoints ?? [],
      floorCovering: (data.floorCovering ?? {}) as Record<string, FloorCovering>,
      wallCovering: (data.wallCovering ?? {}) as Record<string, WallCovering>,
      furniture: data.furniture ?? [],
    });
  } catch {
    alert('Ошибка при загрузке проекта. Файл повреждён или имеет неверный формат.');
  }
}
