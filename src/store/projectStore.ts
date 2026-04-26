import { create } from 'zustand';
import type {
  Layout,
  Room,
  WallSegment,
  ElectricalPoint,
  ElectricalRoute,
  FurnitureInstance,
  FloorType,
  CeilingType,
  FloorCovering,
  WallCovering,
  TileCoord,
} from '../domain/geometry/types';
import { layoutToRooms } from '../domain/geometry/tiles';

export type Stage = 1 | 2 | 3 | 4;

export interface ProjectState {
  // Meta
  layoutId: 1 | 2 | 3 | null;
  currentStage: Stage;

  // From layout
  layout: Layout | null;
  rooms: Room[];
  walls: WallSegment[];
  electricalPanel: TileCoord | null;

  // Stage 2: rough finish
  flooring: Record<string, FloorType>;
  ceiling: Record<string, CeilingType>;
  electricalPoints: ElectricalPoint[];
  electricalRoutes: ElectricalRoute[];

  // Stage 3: fine finish
  floorCovering: Record<string, FloorCovering>;
  wallCovering: Record<string, WallCovering>;
  furniture: FurnitureInstance[];

  // Actions
  selectLayout: (layout: Layout) => void;
  resetProject: () => void;
  setStage: (stage: Stage) => void;
}

const initialState = {
  layoutId: null as 1 | 2 | 3 | null,
  currentStage: 1 as Stage,
  layout: null as Layout | null,
  rooms: [] as Room[],
  walls: [] as WallSegment[],
  electricalPanel: null as TileCoord | null,
  flooring: {} as Record<string, FloorType>,
  ceiling: {} as Record<string, CeilingType>,
  electricalPoints: [] as ElectricalPoint[],
  electricalRoutes: [] as ElectricalRoute[],
  floorCovering: {} as Record<string, FloorCovering>,
  wallCovering: {} as Record<string, WallCovering>,
  furniture: [] as FurnitureInstance[],
};

export const useProjectStore = create<ProjectState>()((set) => ({
  ...initialState,

  selectLayout: (layout: Layout) => {
    const rooms = layoutToRooms(layout);
    const flooring: Record<string, FloorType> = {};
    const ceiling: Record<string, CeilingType> = {};
    for (const room of rooms) {
      flooring[room.id] = 'screed';
      ceiling[room.id] = 'stretch';
    }
    set({
      layoutId: layout.id as 1 | 2 | 3,
      layout,
      rooms,
      electricalPanel: layout.electricalPanel,
      flooring,
      ceiling,
      // Reset dependent stages
      electricalPoints: [],
      electricalRoutes: [],
      floorCovering: {},
      wallCovering: {},
      furniture: [],
      walls: [],
    });
  },

  resetProject: () => set(initialState),

  setStage: (stage: Stage) => set({ currentStage: stage }),
}));
