import { describe, it, expect } from 'vitest';
import {
  editorReducer,
  findObjectAt,
  initialEditorState,
  type EditorState,
} from '../../src/editor/state';

function fresh(): EditorState {
  return initialEditorState();
}

describe('editorReducer — meta + tool + grid', () => {
  it('initial state has empty rooms / openings and select tool', () => {
    const s = fresh();
    expect(s.tool).toBe('select');
    expect(s.rooms).toEqual([]);
    expect(s.windows).toEqual([]);
    expect(s.doors).toEqual([]);
    expect(s.electricalPanel).toBeNull();
    expect(s.gridWidth).toBe(32);
    expect(s.gridHeight).toBe(32);
  });

  it('clamps grid size to [8, 200]', () => {
    const s1 = editorReducer(fresh(), { type: 'set_grid_size', width: 4, height: 9 });
    expect(s1.gridWidth).toBe(8);
    expect(s1.gridHeight).toBe(9);

    const s2 = editorReducer(fresh(), { type: 'set_grid_size', width: 1000, height: 50 });
    expect(s2.gridWidth).toBe(200);
    expect(s2.gridHeight).toBe(50);
  });

  it('switching tool clears selection', () => {
    let s = editorReducer(fresh(), { type: 'set_panel', coord: { x: 5, y: 5 } });
    expect(s.selection).toEqual({ kind: 'panel' });
    s = editorReducer(s, { type: 'set_tool', tool: 'room' });
    expect(s.tool).toBe('room');
    expect(s.selection).toBeNull();
  });

  it('updates layout id and name without touching the rest', () => {
    const s = editorReducer(fresh(), { type: 'set_meta', id: 7, name: 'Test L7' });
    expect(s.layoutId).toBe(7);
    expect(s.layoutName).toBe('Test L7');
  });
});

describe('editorReducer — F11.2.9 single-shot tool (v1.10.0)', () => {
  function pickTool(tool: 'room' | 'panel' | 'window' | 'door') {
    return editorReducer(fresh(), { type: 'set_tool', tool });
  }

  it('add_room resets the tool back to select', () => {
    const placing = pickTool('room');
    const s = editorReducer(placing, {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 8, height: 6 },
      roomType: 'bedroom',
    });
    expect(s.tool).toBe('select');
  });

  it('set_panel resets the tool back to select', () => {
    const placing = pickTool('panel');
    const s = editorReducer(placing, { type: 'set_panel', coord: { x: 3, y: 3 } });
    expect(s.tool).toBe('select');
  });

  it('add_window resets the tool back to select', () => {
    const placing = pickTool('window');
    const s = editorReducer(placing, {
      type: 'add_window',
      segment: { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
    });
    expect(s.tool).toBe('select');
  });

  it('add_door resets the tool back to select', () => {
    const placing = pickTool('door');
    const s = editorReducer(placing, {
      type: 'add_door',
      segment: { start: { x: 0, y: 0 }, end: { x: 3, y: 0 } },
    });
    expect(s.tool).toBe('select');
  });

  it('update_room does NOT touch the tool (only placements reset)', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 6, height: 6 },
      roomType: 'bedroom',
    });
    // После add_room инструмент уже `select` (single-shot). Представим, что
    // пользователь снова выбрал `room` — обновление поля комнаты не должно
    // переключать инструмент.
    s = editorReducer(s, { type: 'set_tool', tool: 'room' });
    s = editorReducer(s, { type: 'update_room', id: s.rooms[0].id, patch: { name: 'X' } });
    expect(s.tool).toBe('room');
  });
});

describe('editorReducer — rooms', () => {
  it('add_room generates a stable id, default name, selects it', () => {
    const s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    expect(s.rooms).toHaveLength(1);
    expect(s.rooms[0]).toMatchObject({
      id: 'bedroom_1',
      type: 'bedroom',
      name: 'Спальня 1',
      x: 0,
      y: 0,
      width: 10,
      height: 8,
    });
    expect(s.selection).toEqual({ kind: 'room', id: 'bedroom_1' });
    expect(s.counters.room).toBe(1);
  });

  it('counters increment regardless of changing room type', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 10, y: 0, width: 6, height: 4 },
      roomType: 'kitchen',
    });
    expect(s.rooms[1]).toMatchObject({ id: 'kitchen_2', name: 'Кухня 2' });
    expect(s.counters.room).toBe(2);
  });

  it('update_room patches type and rebuilds id (F11.2.7 v1.10.0)', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'update_room', id: 'bedroom_1', patch: { type: 'kitchen' } });
    expect(s.rooms[0].type).toBe('kitchen');
    // F11.2.7: id следует за новым типом, инвариант `<type>_<n>` сохраняется.
    expect(s.rooms[0].id).toBe('kitchen_1');
    // Имя по умолчанию авто-переименовывается, если пользователь не менял его вручную.
    expect(s.rooms[0].name).toBe('Кухня 1');
  });

  it('update_room — id pickup deduplicates against existing rooms (F11.2.7)', () => {
    // Две существующие кухни оставляют _3 первым свободным индексом.
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 6, height: 6 },
      roomType: 'kitchen',
    });
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 6, y: 0, width: 6, height: 6 },
      roomType: 'kitchen',
    });
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 0, y: 6, width: 6, height: 6 },
      roomType: 'bedroom',
    });
    // Счётчики общие для всех типов, поэтому третья комната — `bedroom_3`.
    const bedroomId = s.rooms[2].id;
    expect(bedroomId).toBe('bedroom_3');
    s = editorReducer(s, { type: 'update_room', id: bedroomId, patch: { type: 'kitchen' } });
    // Три кухни, все с уникальными id — _3 — следующий свободный слот.
    const kitchens = s.rooms.filter((r) => r.type === 'kitchen');
    expect(kitchens.map((r) => r.id).sort()).toEqual(['kitchen_1', 'kitchen_2', 'kitchen_3']);
  });

  it('update_room — keeps a custom name across type change (F11.2.7)', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 6, height: 6 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, {
      type: 'update_room',
      id: 'bedroom_1',
      patch: { name: 'Уютная комната' },
    });
    s = editorReducer(s, { type: 'update_room', id: 'bedroom_1', patch: { type: 'kitchen' } });
    expect(s.rooms[0].id).toBe('kitchen_1');
    expect(s.rooms[0].name).toBe('Уютная комната');
  });

  it('update_room — selection follows the renamed id (F11.2.7)', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 6, height: 6 },
      roomType: 'bedroom',
    });
    expect(s.selection).toEqual({ kind: 'room', id: 'bedroom_1' });
    s = editorReducer(s, { type: 'update_room', id: 'bedroom_1', patch: { type: 'kitchen' } });
    expect(s.selection).toEqual({ kind: 'room', id: 'kitchen_1' });
  });
});

describe('editorReducer — panel', () => {
  it('set_panel places the panel and selects it', () => {
    const s = editorReducer(fresh(), { type: 'set_panel', coord: { x: 3, y: 4 } });
    expect(s.electricalPanel).toEqual({ x: 3, y: 4 });
    expect(s.selection).toEqual({ kind: 'panel' });
  });

  it('set_panel overwrites the previous panel', () => {
    let s = editorReducer(fresh(), { type: 'set_panel', coord: { x: 1, y: 1 } });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 9, y: 9 } });
    expect(s.electricalPanel).toEqual({ x: 9, y: 9 });
  });
});

describe('editorReducer — windows', () => {
  it('add_window assigns id, default heights, selects', () => {
    const s = editorReducer(fresh(), {
      type: 'add_window',
      segment: { start: { x: 5, y: 0 }, end: { x: 9, y: 0 } },
    });
    expect(s.windows).toHaveLength(1);
    expect(s.windows[0]).toMatchObject({
      id: 'win_1',
      sill_height_m: 0.9,
      height_m: 1.5,
    });
    expect(s.selection).toEqual({ kind: 'window', id: 'win_1' });
  });

  it('update_window can change sill_height_m', () => {
    let s = editorReducer(fresh(), {
      type: 'add_window',
      segment: { start: { x: 5, y: 0 }, end: { x: 9, y: 0 } },
    });
    s = editorReducer(s, { type: 'update_window', id: 'win_1', patch: { sill_height_m: 0.6 } });
    expect(s.windows[0].sill_height_m).toBe(0.6);
  });
});

describe('editorReducer — doors', () => {
  it('add_door defaults height/hinge/swing_side', () => {
    const s = editorReducer(fresh(), {
      type: 'add_door',
      segment: { start: { x: 12, y: 5 }, end: { x: 12, y: 8 } },
    });
    expect(s.doors[0]).toMatchObject({
      id: 'door_1',
      height_m: 2.1,
      hinge: 'start',
      swing_side: 'left',
    });
  });

  it('update_door changes hinge and swing_side', () => {
    let s = editorReducer(fresh(), {
      type: 'add_door',
      segment: { start: { x: 12, y: 5 }, end: { x: 12, y: 8 } },
    });
    s = editorReducer(s, {
      type: 'update_door',
      id: 'door_1',
      patch: { hinge: 'end', swing_side: 'right' },
    });
    expect(s.doors[0]).toMatchObject({ hinge: 'end', swing_side: 'right' });
  });
});

describe('editorReducer — selection + delete', () => {
  it('delete_selected removes a room and clears selection', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'delete_selected' });
    expect(s.rooms).toEqual([]);
    expect(s.selection).toBeNull();
  });

  it('delete_selected removes a window', () => {
    let s = editorReducer(fresh(), {
      type: 'add_window',
      segment: { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
    });
    s = editorReducer(s, { type: 'delete_selected' });
    expect(s.windows).toEqual([]);
  });

  it('delete_selected with no selection is a no-op', () => {
    const s = editorReducer(fresh(), { type: 'delete_selected' });
    expect(s).toEqual(fresh());
  });

  it('delete_at removes the topmost object regardless of current selection', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 10 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 4, y: 4 } });
    // После set_panel selection стоит на щите, но delete_at по тайлу, не
    // принадлежащему щиту, должен удалить комнату, не трогая щит.
    s = editorReducer(s, { type: 'delete_at', tile: { x: 6, y: 6 } });
    expect(s.rooms).toEqual([]);
    expect(s.electricalPanel).toEqual({ x: 4, y: 4 });
  });

  it('delete_at on empty tile is a no-op', () => {
    const s = editorReducer(fresh(), { type: 'delete_at', tile: { x: 0, y: 0 } });
    expect(s).toEqual(fresh());
  });

  it('select can clear with null', () => {
    let s = editorReducer(fresh(), { type: 'set_panel', coord: { x: 1, y: 1 } });
    s = editorReducer(s, { type: 'select', selection: null });
    expect(s.selection).toBeNull();
  });
});

describe('findObjectAt — picking priority', () => {
  it('returns null on empty state', () => {
    expect(findObjectAt(fresh(), { x: 5, y: 5 })).toBeNull();
  });

  it('finds a room at an inside tile', () => {
    const s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    expect(findObjectAt(s, { x: 5, y: 5 })).toEqual({ kind: 'room', id: 'bedroom_1' });
  });

  it('does not match a tile on the room exclusive boundary', () => {
    const s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    // x в [0,10), y в [0,8) — поэтому (10,5) уже снаружи.
    expect(findObjectAt(s, { x: 10, y: 5 })).toBeNull();
  });

  it('door wins over a room sharing the same tile (drawn on top)', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 10 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, {
      type: 'add_door',
      segment: { start: { x: 4, y: 5 }, end: { x: 7, y: 5 } },
    });
    expect(findObjectAt(s, { x: 5, y: 5 })).toEqual({ kind: 'door', id: 'door_1' });
  });

  it('panel wins over the underlying room', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 10 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 4, y: 4 } });
    expect(findObjectAt(s, { x: 4, y: 4 })).toEqual({ kind: 'panel' });
  });
});

describe('editorReducer — reset', () => {
  it('reset returns to initial state', () => {
    let s = editorReducer(fresh(), {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 10, height: 8 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 1, y: 1 } });
    s = editorReducer(s, { type: 'reset' });
    expect(s).toEqual(fresh());
  });
});
