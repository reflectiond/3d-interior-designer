/**
 * Real-time validation for the layout editor (F11.2.4).
 *
 * Pure logic: takes editor state, returns a list of human-readable issues
 * with references to the offending objects. Used both to render the issues
 * panel and to gate the JSON export button.
 */

import { validateNoOverlaps } from '../domain/geometry/openings';
import type { EditorRoom, EditorState } from './state';
import type { TileCoord } from '../domain/geometry/types';

export type IssueRef =
  | { kind: 'room'; id: string }
  | { kind: 'window'; id: string }
  | { kind: 'door'; id: string }
  | { kind: 'panel' };

export interface EditorIssue {
  /** Stable id so React lists do not jitter as the user edits. */
  id: string;
  message: string;
  refs: IssueRef[];
}

function roomAt(rooms: readonly EditorRoom[], x: number, y: number): EditorRoom | null {
  for (const r of rooms) {
    if (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height) return r;
  }
  return null;
}

function rectsOverlap(a: EditorRoom, b: EditorRoom): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * An axis-aligned tile segment is "on a wall" iff every unit-edge it covers
 * separates either (a) one room from outside, or (b) two distinct rooms.
 * Free-floating segments (both sides outside any room) and segments fully
 * inside a single room are invalid.
 */
function isOpeningOnWall(rooms: readonly EditorRoom[], start: TileCoord, end: TileCoord): boolean {
  if (start.x === end.x && start.y === end.y) return false;

  if (start.y === end.y) {
    const y = start.y;
    const lo = Math.min(start.x, end.x);
    const hi = Math.max(start.x, end.x);
    for (let x = lo; x < hi; x++) {
      const above = roomAt(rooms, x, y - 1);
      const below = roomAt(rooms, x, y);
      if (above === null && below === null) return false;
      if (above && below && above.id === below.id) return false;
    }
    return true;
  }

  if (start.x === end.x) {
    const x = start.x;
    const lo = Math.min(start.y, end.y);
    const hi = Math.max(start.y, end.y);
    for (let y = lo; y < hi; y++) {
      const left = roomAt(rooms, x - 1, y);
      const right = roomAt(rooms, x, y);
      if (left === null && right === null) return false;
      if (left && right && left.id === right.id) return false;
    }
    return true;
  }

  return false;
}

export function validateEditor(state: EditorState): EditorIssue[] {
  const issues: EditorIssue[] = [];

  if (state.rooms.length === 0) {
    issues.push({
      id: 'no-rooms',
      message: 'Должна быть хотя бы одна комната.',
      refs: [],
    });
  }

  for (const room of state.rooms) {
    if (room.width < 4 || room.height < 4) {
      issues.push({
        id: `room-too-small-${room.id}`,
        message: `Комната ${room.id} меньше 4×4 тайлов.`,
        refs: [{ kind: 'room', id: room.id }],
      });
    }
    if (
      room.x < 0 ||
      room.y < 0 ||
      room.x + room.width > state.gridWidth ||
      room.y + room.height > state.gridHeight
    ) {
      issues.push({
        id: `room-out-of-grid-${room.id}`,
        message: `Комната ${room.id} выходит за пределы сетки ${state.gridWidth}×${state.gridHeight}.`,
        refs: [{ kind: 'room', id: room.id }],
      });
    }
  }

  for (let i = 0; i < state.rooms.length; i++) {
    for (let j = i + 1; j < state.rooms.length; j++) {
      if (rectsOverlap(state.rooms[i], state.rooms[j])) {
        issues.push({
          id: `rooms-overlap-${state.rooms[i].id}-${state.rooms[j].id}`,
          message: `Комнаты ${state.rooms[i].id} и ${state.rooms[j].id} пересекаются.`,
          refs: [
            { kind: 'room', id: state.rooms[i].id },
            { kind: 'room', id: state.rooms[j].id },
          ],
        });
      }
    }
  }

  if (state.electricalPanel === null) {
    issues.push({
      id: 'no-panel',
      message: 'Электрощиток не размещён.',
      refs: [{ kind: 'panel' }],
    });
  } else {
    const inRoom = roomAt(state.rooms, state.electricalPanel.x, state.electricalPanel.y);
    if (inRoom === null) {
      issues.push({
        id: 'panel-not-in-room',
        message: 'Электрощиток должен находиться внутри одной из комнат.',
        refs: [{ kind: 'panel' }],
      });
    }
  }

  for (const win of state.windows) {
    if (!isOpeningOnWall(state.rooms, win.start, win.end)) {
      issues.push({
        id: `window-off-wall-${win.id}`,
        message: `Окно ${win.id} не лежит на стене.`,
        refs: [{ kind: 'window', id: win.id }],
      });
    }
  }

  for (const door of state.doors) {
    if (!isOpeningOnWall(state.rooms, door.start, door.end)) {
      issues.push({
        id: `door-off-wall-${door.id}`,
        message: `Дверь ${door.id} не лежит на стене.`,
        refs: [{ kind: 'door', id: door.id }],
      });
    }
  }

  // Mutual overlap of openings — reuse the v1.5 helper. It returns plain
  // strings; we wrap each as a separate issue without typed refs because the
  // helper does not expose the participant ids.
  for (const overlapMessage of validateNoOverlaps(state.windows, state.doors)) {
    issues.push({
      id: `overlap-${overlapMessage}`,
      message: overlapMessage,
      refs: [],
    });
  }

  return issues;
}

/** Set of object refs flagged by at least one issue — used for canvas highlighting. */
export function invalidObjectKeys(issues: readonly EditorIssue[]): Set<string> {
  const set = new Set<string>();
  for (const issue of issues) {
    for (const ref of issue.refs) {
      set.add(ref.kind === 'panel' ? 'panel' : `${ref.kind}:${ref.id}`);
    }
  }
  return set;
}
