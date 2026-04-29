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

/**
 * F11.2.7 (v1.10.0) — when a room's type changes the id is rebuilt to keep the
 * `<type>_<n>` invariant that the rest of the codebase relies on (e.g.
 * `rooms.filter(r => r.type === 'bathroom')` is sometimes paired with
 * "id starts with `bathroom_`" assumptions). The new index is the smallest
 * positive integer that produces a unique id within the existing rooms.
 */
function nextIdForType(rooms: EditorRoom[], roomType: RoomType, excludeId: string): string {
  const used = new Set(rooms.filter((r) => r.id !== excludeId).map((r) => r.id));
  for (let n = 1; n < 10_000; n++) {
    const candidate = `${roomType}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
  // Practically unreachable — 10k rooms is far beyond any layout.
  return `${roomType}_${Date.now()}`;
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
      // F11.2.9 (v1.10.0) — single-shot tool: drop back to `select` so
      // accidental further canvas clicks don't spawn another room.
      return {
        ...state,
        rooms: [...state.rooms, room],
        counters: { ...state.counters, room: state.counters.room + 1 },
        selection: { kind: 'room', id },
        tool: 'select',
      };
    }

    case 'update_room': {
      // F11.2.7: type change → regenerate id so the prefix matches the new type.
      const target = state.rooms.find((r) => r.id === action.id);
      if (!target) return state;
      const typeChanged = action.patch.type !== undefined && action.patch.type !== target.type;
      const newType = action.patch.type ?? target.type;
      const newId = typeChanged ? nextIdForType(state.rooms, newType, target.id) : target.id;
      // Default-rename when the user hasn't customised the name yet (matches the
      // auto-generated name from the previous type).
      const oldDefaultName = `${ROOM_NAMES[target.type]} ${target.id.split('_').pop()}`;
      const renaming =
        action.patch.name === undefined && typeChanged && target.name === oldDefaultName;
      const nextName = renaming
        ? `${ROOM_NAMES[newType]} ${newId.split('_').pop()}`
        : (action.patch.name ?? target.name);
      const updatedRooms = state.rooms.map((r) =>
        r.id === target.id ? { ...r, ...action.patch, id: newId, name: nextName } : r,
      );
      // Keep selection pointing at the renamed room.
      const nextSelection: EditorSelection =
        state.selection?.kind === 'room' && state.selection.id === target.id
          ? { kind: 'room', id: newId }
          : state.selection;
      return { ...state, rooms: updatedRooms, selection: nextSelection };
    }

    case 'set_panel':
      // F11.2.9 — single-shot tool.
      return {
        ...state,
        electricalPanel: action.coord,
        selection: { kind: 'panel' },
        tool: 'select',
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
      // F11.2.9 — single-shot tool.
      return {
        ...state,
        windows: [...state.windows, win],
        counters: { ...state.counters, window: n },
        selection: { kind: 'window', id },
        tool: 'select',
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
      // F11.2.9 — single-shot tool.
      return {
        ...state,
        doors: [...state.doors, door],
        counters: { ...state.counters, door: n },
        selection: { kind: 'door', id },
        tool: 'select',
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
