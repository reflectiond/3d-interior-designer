import { describe, it, expect } from 'vitest';
import { validateEditor, invalidObjectKeys } from '../../src/editor/validation';
import { editorReducer, initialEditorState, type EditorState } from '../../src/editor/state';

function build(): EditorState {
  // A minimum-valid layout: 1 bedroom 8×8 covering [0..8, 0..8] with a panel
  // inside, no openings, on a 32×32 grid.
  let s = initialEditorState();
  s = editorReducer(s, {
    type: 'add_room',
    rect: { x: 0, y: 0, width: 8, height: 8 },
    roomType: 'bedroom',
  });
  s = editorReducer(s, { type: 'set_panel', coord: { x: 2, y: 2 } });
  return s;
}

describe('validateEditor — happy path', () => {
  it('a single-room layout with a panel inside is fully valid', () => {
    expect(validateEditor(build())).toEqual([]);
  });
});

describe('validateEditor — rooms', () => {
  it('flags an empty layout as having no rooms and no panel', () => {
    const issues = validateEditor(initialEditorState());
    expect(issues.find((i) => i.id === 'no-rooms')).toBeTruthy();
    expect(issues.find((i) => i.id === 'no-panel')).toBeTruthy();
  });

  it('flags overlapping rooms', () => {
    let s = build();
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 4, y: 4, width: 8, height: 8 },
      roomType: 'kitchen',
    });
    const issues = validateEditor(s);
    expect(issues.some((i) => i.id.startsWith('rooms-overlap-'))).toBe(true);
  });

  it('flags a room that exceeds grid bounds', () => {
    let s = initialEditorState();
    // gridWidth=32 by default; 30+8 = 38 → out of grid
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 30, y: 0, width: 8, height: 8 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 30, y: 0 } });
    const issues = validateEditor(s);
    expect(issues.some((i) => i.id.startsWith('room-out-of-grid-'))).toBe(true);
  });
});

describe('validateEditor — panel', () => {
  it('flags a panel placed outside any room', () => {
    let s = build();
    s = editorReducer(s, { type: 'set_panel', coord: { x: 20, y: 20 } });
    const issues = validateEditor(s);
    expect(issues.find((i) => i.id === 'panel-not-in-room')).toBeTruthy();
  });
});

describe('validateEditor — openings on a wall', () => {
  it('accepts a window on the external north wall of a room', () => {
    let s = build();
    s = editorReducer(s, {
      type: 'add_window',
      segment: { start: { x: 2, y: 0 }, end: { x: 5, y: 0 } },
    });
    const issues = validateEditor(s);
    expect(issues.find((i) => i.id.startsWith('window-off-wall-'))).toBeUndefined();
  });

  it('flags a window that floats inside a room (not on a wall)', () => {
    let s = build();
    s = editorReducer(s, {
      type: 'add_window',
      segment: { start: { x: 2, y: 4 }, end: { x: 5, y: 4 } },
    });
    const issues = validateEditor(s);
    expect(issues.find((i) => i.id.startsWith('window-off-wall-'))).toBeTruthy();
  });

  it('flags a door floating outside any room', () => {
    let s = build();
    s = editorReducer(s, {
      type: 'add_door',
      segment: { start: { x: 20, y: 20 }, end: { x: 23, y: 20 } },
    });
    const issues = validateEditor(s);
    expect(issues.find((i) => i.id.startsWith('door-off-wall-'))).toBeTruthy();
  });

  it('accepts an internal door between two adjacent rooms', () => {
    let s = initialEditorState();
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 8, height: 12 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 8, y: 0, width: 8, height: 12 },
      roomType: 'kitchen',
    });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 2, y: 2 } });
    s = editorReducer(s, {
      type: 'add_door',
      segment: { start: { x: 8, y: 4 }, end: { x: 8, y: 7 } },
    });
    const issues = validateEditor(s);
    expect(issues).toEqual([]);
  });
});

describe('invalidObjectKeys', () => {
  it('returns a set covering every flagged ref', () => {
    let s = build();
    s = editorReducer(s, {
      type: 'add_window',
      segment: { start: { x: 2, y: 4 }, end: { x: 5, y: 4 } },
    });
    const keys = invalidObjectKeys(validateEditor(s));
    expect(keys.has('window:win_1')).toBe(true);
  });
});
