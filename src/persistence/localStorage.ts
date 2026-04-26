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

interface SavedState {
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

export function saveToLocalStorage(state: ProjectState) {
  try {
    const data: SavedState = {
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
    // Silently fail if localStorage is unavailable
  }
}

export function restoreFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw) as SavedState;
    if (data.version !== '1.0' || !data.layoutId) return false;

    const store = useProjectStore.getState();
    const layout = layoutsById.get(data.layoutId);
    if (layout) {
      store.selectLayout(layout);
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

    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}
