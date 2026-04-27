import type { TileCoord, RoomType } from '../domain/geometry/types';

/**
 * Layout editor state machine (F11.2.x).
 *
 * Pure logic, no React, no Konva — so it can be unit-tested. The editor
 * keeps its own state isolated from the project store and never touches
 * the main app's localStorage (F11.2.6).
 *
 * v1.6.0 deviation from F11.2.2: we drop the explicit "wall" tool because
 * `LayoutSchema` doesn't store walls — they are derived from room rectangles.
 * Tools are: select, room (drag rectangle), panel (click), window (click-click),
 * door (click-click). See docs/DECISIONS.md.
 */

export type EditorTool = 'select' | 'room' | 'panel' | 'window' | 'door';

export interface EditorRoom {
  id: string;
  type: RoomType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorWindow {
  id: string;
  start: TileCoord;
  end: TileCoord;
  sill_height_m: number;
  height_m: number;
}

export interface EditorDoor {
  id: string;
  start: TileCoord;
  end: TileCoord;
  height_m: number;
  hinge: 'start' | 'end';
  swing_side: 'left' | 'right';
}

export type EditorSelection =
  | { kind: 'room'; id: string }
  | { kind: 'panel' }
  | { kind: 'window'; id: string }
  | { kind: 'door'; id: string }
  | null;

export interface EditorState {
  layoutId: number;
  layoutName: string;
  gridWidth: number;
  gridHeight: number;
  rooms: EditorRoom[];
  electricalPanel: TileCoord | null;
  windows: EditorWindow[];
  doors: EditorDoor[];
  tool: EditorTool;
  selection: EditorSelection;
  /** Per-type auto-increment counters used for stable ids. */
  counters: { room: number; window: number; door: number };
}

const ROOM_NAMES: Record<RoomType, string> = {
  bedroom: 'Спальня',
  bathroom: 'Ванная',
  kitchen: 'Кухня',
  boiler: 'Котельная',
  living: 'Гостиная',
  corridor: 'Коридор',
  wardrobe: 'Гардероб',
};

export function initialEditorState(): EditorState {
  return {
    layoutId: 99,
    layoutName: 'Новая планировка',
    gridWidth: 32,
    gridHeight: 32,
    rooms: [],
    electricalPanel: null,
    windows: [],
    doors: [],
    tool: 'select',
    selection: null,
    counters: { room: 0, window: 0, door: 0 },
  };
}

export type EditorAction =
  | { type: 'set_grid_size'; width: number; height: number }
  | { type: 'set_tool'; tool: EditorTool }
  | { type: 'set_meta'; id?: number; name?: string }
  | {
      type: 'add_room';
      rect: { x: number; y: number; width: number; height: number };
      roomType: RoomType;
    }
  | { type: 'update_room'; id: string; patch: Partial<Pick<EditorRoom, 'type' | 'name'>> }
  | { type: 'set_panel'; coord: TileCoord }
  | { type: 'add_window'; segment: { start: TileCoord; end: TileCoord } }
  | {
      type: 'update_window';
      id: string;
      patch: Partial<Pick<EditorWindow, 'sill_height_m' | 'height_m'>>;
    }
  | { type: 'add_door'; segment: { start: TileCoord; end: TileCoord } }
  | {
      type: 'update_door';
      id: string;
      patch: Partial<Pick<EditorDoor, 'hinge' | 'swing_side' | 'height_m'>>;
    }
  | { type: 'select'; selection: EditorSelection }
  | { type: 'delete_selected' }
  | { type: 'delete_at'; tile: TileCoord }
  | { type: 'reset' };

function nextRoomFromType(state: EditorState, roomType: RoomType): { id: string; name: string } {
  const n = state.counters.room + 1;
  return { id: `${roomType}_${n}`, name: `${ROOM_NAMES[roomType]} ${n}` };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'reset':
      return initialEditorState();

    case 'set_grid_size': {
      const w = Math.max(8, Math.min(200, Math.floor(action.width)));
      const h = Math.max(8, Math.min(200, Math.floor(action.height)));
      return { ...state, gridWidth: w, gridHeight: h };
    }

    case 'set_tool':
      return { ...state, tool: action.tool, selection: null };

    case 'set_meta':
      return {
        ...state,
        layoutId: action.id ?? state.layoutId,
        layoutName: action.name ?? state.layoutName,
      };

    case 'add_room': {
      const { rect, roomType } = action;
      const { id, name } = nextRoomFromType(state, roomType);
      const room: EditorRoom = { id, name, type: roomType, ...rect };
      return {
        ...state,
        rooms: [...state.rooms, room],
        counters: { ...state.counters, room: state.counters.room + 1 },
        selection: { kind: 'room', id },
      };
    }

    case 'update_room':
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };

    case 'set_panel':
      return {
        ...state,
        electricalPanel: action.coord,
        selection: { kind: 'panel' },
      };

    case 'add_window': {
      const n = state.counters.window + 1;
      const id = `win_${n}`;
      const win: EditorWindow = {
        id,
        start: action.segment.start,
        end: action.segment.end,
        sill_height_m: 0.9,
        height_m: 1.5,
      };
      return {
        ...state,
        windows: [...state.windows, win],
        counters: { ...state.counters, window: n },
        selection: { kind: 'window', id },
      };
    }

    case 'update_window':
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)),
      };

    case 'add_door': {
      const n = state.counters.door + 1;
      const id = `door_${n}`;
      const door: EditorDoor = {
        id,
        start: action.segment.start,
        end: action.segment.end,
        height_m: 2.1,
        hinge: 'start',
        swing_side: 'left',
      };
      return {
        ...state,
        doors: [...state.doors, door],
        counters: { ...state.counters, door: n },
        selection: { kind: 'door', id },
      };
    }

    case 'update_door':
      return {
        ...state,
        doors: state.doors.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      };

    case 'select':
      return { ...state, selection: action.selection };

    case 'delete_selected':
      return deleteSelection(state, state.selection);

    case 'delete_at':
      return deleteSelection(state, findObjectAt(state, action.tile));
  }
}

function deleteSelection(state: EditorState, sel: EditorSelection): EditorState {
  if (sel === null) return state;
  switch (sel.kind) {
    case 'room':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== sel.id),
        selection: null,
      };
    case 'panel':
      return { ...state, electricalPanel: null, selection: null };
    case 'window':
      return {
        ...state,
        windows: state.windows.filter((w) => w.id !== sel.id),
        selection: null,
      };
    case 'door':
      return {
        ...state,
        doors: state.doors.filter((d) => d.id !== sel.id),
        selection: null,
      };
  }
}

/**
 * Locate the topmost object under a tile coord. Used by Shift+click delete and
 * by select-tool clicks. Lookup priority: doors > windows > panel > rooms,
 * because openings sit on top of room rectangles visually.
 */
export function findObjectAt(state: EditorState, tile: TileCoord): EditorSelection {
  for (const door of state.doors) {
    if (segmentContains(door.start, door.end, tile)) {
      return { kind: 'door', id: door.id };
    }
  }
  for (const win of state.windows) {
    if (segmentContains(win.start, win.end, tile)) {
      return { kind: 'window', id: win.id };
    }
  }
  if (
    state.electricalPanel &&
    state.electricalPanel.x === tile.x &&
    state.electricalPanel.y === tile.y
  ) {
    return { kind: 'panel' };
  }
  for (let i = state.rooms.length - 1; i >= 0; i--) {
    const r = state.rooms[i];
    if (tile.x >= r.x && tile.x < r.x + r.width && tile.y >= r.y && tile.y < r.y + r.height) {
      return { kind: 'room', id: r.id };
    }
  }
  return null;
}

function segmentContains(start: TileCoord, end: TileCoord, tile: TileCoord): boolean {
  if (start.x === end.x) {
    if (tile.x !== start.x) return false;
    const lo = Math.min(start.y, end.y);
    const hi = Math.max(start.y, end.y);
    return tile.y >= lo && tile.y < hi;
  }
  if (tile.y !== start.y) return false;
  const lo = Math.min(start.x, end.x);
  const hi = Math.max(start.x, end.x);
  return tile.x >= lo && tile.x < hi;
}

export const _internal = { segmentContains };
