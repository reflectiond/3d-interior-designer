/**
 * Валидация в реальном времени для редактора планировок (F11.2.4).
 *
 * Чистая логика: на вход — состояние редактора, на выход — список читаемых
 * issue с ссылками на проблемные объекты. Используется и для рендера панели
 * проблем, и для блокировки кнопки JSON-экспорта.
 */

import { validateNoOverlaps } from '../domain/geometry/openings';
import { TILE_SIZE } from '../domain/geometry/tiles';
import type { EditorRoom, EditorState } from './state';
import type { TileCoord } from '../domain/geometry/types';

// F11.3 (v1.14.0) — минимум 4 м². При TILE_SIZE = 0.25 м это 64 тайла².
// Геометрия сторон не ограничивается.
export const MIN_ROOM_AREA_M2 = 4;
const MIN_ROOM_AREA_TILES = Math.round(MIN_ROOM_AREA_M2 / (TILE_SIZE * TILE_SIZE));

export type IssueRef =
  | { kind: 'room'; id: string }
  | { kind: 'window'; id: string }
  | { kind: 'door'; id: string }
  | { kind: 'panel' };

export interface EditorIssue {
  /** Стабильный id, чтобы React-списки не дёргались при редактировании. */
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
 * Осесимметричный сегмент тайлов лежит «на стене» тогда и только тогда, когда
 * каждое единичное ребро, которое он покрывает, разделяет либо (а) одну комнату
 * и внешнее пространство, либо (б) две разные комнаты. Сегменты, висящие в воздухе
 * (обе стороны вне комнат), и сегменты целиком внутри одной комнаты — невалидны.
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
    if (room.width * room.height < MIN_ROOM_AREA_TILES) {
      issues.push({
        id: `room-too-small-${room.id}`,
        message: `Комната ${room.id} меньше ${MIN_ROOM_AREA_M2} м².`,
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

  // Взаимное перекрытие проёмов — переиспользуем хелпер из v1.5. Он возвращает
  // обычные строки; оборачиваем каждую как отдельный issue без типизированных refs,
  // потому что хелпер не отдаёт id участников.
  for (const overlapMessage of validateNoOverlaps(state.windows, state.doors)) {
    issues.push({
      id: `overlap-${overlapMessage}`,
      message: overlapMessage,
      refs: [],
    });
  }

  return issues;
}

/** Множество refs объектов, помеченных хотя бы одним issue — для подсветки на канве. */
export function invalidObjectKeys(issues: readonly EditorIssue[]): Set<string> {
  const set = new Set<string>();
  for (const issue of issues) {
    for (const ref of issue.refs) {
      set.add(ref.kind === 'panel' ? 'panel' : `${ref.kind}:${ref.id}`);
    }
  }
  return set;
}
