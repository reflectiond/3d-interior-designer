import { useProjectStore } from '../store/projectStore';
import type { ProjectState } from '../store/projectStore';
import type { FloorType, CeilingType, FloorCovering, WallCovering } from '../domain/geometry/types';
import { LayoutSchema } from '../domain/geometry/types';
import layout1Data from '../data/layouts/layout1.json';
import layout2Data from '../data/layouts/layout2.json';
import layout3Data from '../data/layouts/layout3.json';

const STORAGE_KEY = '3d-interior-designer-project';

const layoutsById = new Map([
  [1, LayoutSchema.parse(layout1Data)],
  [2, LayoutSchema.parse(layout2Data)],
  [3, LayoutSchema.parse(layout3Data)],
]);

export function saveToLocalStorage(state: ProjectState) {
  try {
    const data = {
      version: '1.0',
      layoutId: state.layoutId,
      currentStage: state.currentStage,
      flooring: state.flooring,
      ceiling: state.ceiling,
      electricalPoints: state.electricalPoints,
      floorCovering: state.floorCovering,
      wallCovering: state.wallCovering,
      furniture: state.furniture,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Молча игнорируем — SEC-4: localStorage может быть недоступен или переполнен
  }
}

export function restoreFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    // SEC-4: проверяем структуру JSON до использования
    const data = JSON.parse(raw);
    if (
      typeof data !== 'object' ||
      data === null ||
      data.version !== '1.0' ||
      typeof data.layoutId !== 'number' ||
      ![1, 2, 3].includes(data.layoutId)
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    const store = useProjectStore.getState();
    const layout = layoutsById.get(data.layoutId);
    if (!layout) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    store.selectLayout(layout);

    useProjectStore.setState({
      currentStage: [1, 2, 3, 4].includes(data.currentStage) ? data.currentStage : 1,
      flooring: (data.flooring && typeof data.flooring === 'object' ? data.flooring : {}) as Record<
        string,
        FloorType
      >,
      ceiling: (data.ceiling && typeof data.ceiling === 'object' ? data.ceiling : {}) as Record<
        string,
        CeilingType
      >,
      electricalPoints: Array.isArray(data.electricalPoints) ? data.electricalPoints : [],
      floorCovering: (data.floorCovering && typeof data.floorCovering === 'object'
        ? data.floorCovering
        : {}) as Record<string, FloorCovering>,
      wallCovering: (data.wallCovering && typeof data.wallCovering === 'object'
        ? data.wallCovering
        : {}) as Record<string, WallCovering>,
      furniture: Array.isArray(data.furniture) ? data.furniture : [],
    });

    return true;
  } catch {
    // SEC-4: данные повреждены — начинаем с чистого состояния, не падаем
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage окончательно сломан — игнорируем
    }
    return false;
  }
}
