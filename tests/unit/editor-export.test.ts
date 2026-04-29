import { describe, it, expect } from 'vitest';
import { buildLayoutCandidate, exportLayout } from '../../src/editor/exportLayout';
import { editorReducer, initialEditorState, type EditorState } from '../../src/editor/state';
import { LayoutSchema } from '../../src/domain/geometry/types';

function buildMinimalValidState(): EditorState {
  let s = initialEditorState();
  s = editorReducer(s, { type: 'set_meta', id: 42, name: 'Editor Layout' });
  s = editorReducer(s, {
    type: 'add_room',
    rect: { x: 0, y: 0, width: 10, height: 10 },
    roomType: 'bedroom',
  });
  s = editorReducer(s, { type: 'set_panel', coord: { x: 2, y: 2 } });
  return s;
}

describe('buildLayoutCandidate', () => {
  it('serializes a state into the LayoutSchema shape', () => {
    const candidate = buildLayoutCandidate(buildMinimalValidState());
    expect(candidate.id).toBe(42);
    expect(candidate.name).toBe('Editor Layout');
    expect(candidate.rooms).toHaveLength(1);
    expect(candidate.electricalPanel).toEqual({ x: 2, y: 2 });
    expect(candidate.windows).toEqual([]);
    expect(candidate.doors).toEqual([]);
  });

  it('falls back to (0,0) when panel is missing — schema validation will then reject the panel placement separately', () => {
    const s = initialEditorState();
    const candidate = buildLayoutCandidate(s);
    expect(candidate.electricalPanel).toEqual({ x: 0, y: 0 });
  });
});

describe('exportLayout', () => {
  it('returns ok=true with valid JSON for a minimal layout', () => {
    const result = exportLayout(buildMinimalValidState());
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The same JSON parses back through LayoutSchema unchanged
      const reparsed = LayoutSchema.parse(JSON.parse(result.json));
      expect(reparsed.id).toBe(42);
      expect(reparsed.rooms).toHaveLength(1);
      expect(reparsed.electricalPanel).toEqual({ x: 2, y: 2 });
      expect(result.filename).toMatch(/^layout_42_.*\.json$/);
    }
  });

  it('returns ok=false with messages when the room is too small for LayoutRoomSchema', () => {
    let s = initialEditorState();
    // Bypass the editor's UI gate by injecting a 3×3 room directly through reducer.
    // The reducer itself doesn't enforce min size — only the schema does.
    s = editorReducer(s, {
      type: 'add_room',
      rect: { x: 0, y: 0, width: 3, height: 3 },
      roomType: 'bedroom',
    });
    s = editorReducer(s, { type: 'set_panel', coord: { x: 1, y: 1 } });
    const result = exportLayout(s);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('schema');
      expect(result.messages.some((m) => /width|height/.test(m))).toBe(true);
    }
  });

  it('serializes openings with all required fields', () => {
    let s = buildMinimalValidState();
    s = editorReducer(s, {
      type: 'add_window',
      segment: { start: { x: 2, y: 0 }, end: { x: 5, y: 0 } },
    });
    s = editorReducer(s, {
      type: 'add_door',
      segment: { start: { x: 4, y: 10 }, end: { x: 7, y: 10 } },
    });
    const result = exportLayout(s);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.layout.windows).toHaveLength(1);
      expect(result.layout.doors).toHaveLength(1);
      expect(result.layout.doors[0].hinge).toBe('start');
      // F11.2.8 (v1.10.0): swing auto-picks 'right' here — door is on the
      // south wall y=10 of the (0,0,10,10) room, so the leaf opens INTO the
      // room (which sits at y < 10).
      expect(result.layout.doors[0].swing_side).toBe('right');
      expect(result.layout.doors[0].height_m).toBe(2.1);
    }
  });
});
