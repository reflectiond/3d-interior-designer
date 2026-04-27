import React, { useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Path, Text, Group } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { PALETTE } from '../theme/palette';
import { findObjectAt, type EditorAction, type EditorState, type EditorTool } from './state';
import type { TileCoord } from '../domain/geometry/types';

const SCALE = 24;

interface EditorCanvasProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

interface Anchor {
  tile: TileCoord;
}

function tileFromStage(stage: Konva.Stage): TileCoord | null {
  const p = stage.getPointerPosition();
  if (!p) return null;
  return {
    x: Math.max(0, Math.floor(p.x / SCALE)),
    y: Math.max(0, Math.floor(p.y / SCALE)),
  };
}

function snapAxisAligned(start: TileCoord, end: TileCoord): TileCoord {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx >= dy ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
}

export function EditorCanvas({ state, dispatch }: EditorCanvasProps) {
  const widthPx = state.gridWidth * SCALE;
  const heightPx = state.gridHeight * SCALE;

  const [roomAnchor, setRoomAnchor] = useState<Anchor | null>(null);
  const [pointerTile, setPointerTile] = useState<TileCoord | null>(null);
  const [openingFirst, setOpeningFirst] = useState<TileCoord | null>(null);

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      const tile = tileFromStage(stage);
      if (!tile) return;

      // Shift+click is always "delete topmost at this tile" — works in any tool.
      if (e.evt.shiftKey) {
        dispatch({ type: 'delete_at', tile });
        return;
      }

      switch (state.tool) {
        case 'select': {
          const hit = findObjectAt(state, tile);
          dispatch({ type: 'select', selection: hit });
          return;
        }
        case 'room':
          setRoomAnchor({ tile });
          setPointerTile(tile);
          return;
        case 'panel':
          dispatch({ type: 'set_panel', coord: tile });
          return;
        case 'window':
        case 'door':
          // First click sets anchor, second click commits.
          if (openingFirst === null) {
            setOpeningFirst(tile);
            setPointerTile(tile);
          } else {
            const snapped = snapAxisAligned(openingFirst, tile);
            if (snapped.x === openingFirst.x && snapped.y === openingFirst.y) {
              setOpeningFirst(null);
              return;
            }
            const segment = { start: openingFirst, end: snapped };
            if (state.tool === 'window') {
              dispatch({ type: 'add_window', segment });
            } else {
              dispatch({ type: 'add_door', segment });
            }
            setOpeningFirst(null);
          }
          return;
      }
    },
    [dispatch, state, openingFirst],
  );

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const tile = tileFromStage(stage);
    if (tile) setPointerTile(tile);
  }, []);

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (state.tool !== 'room' || roomAnchor === null) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const tile = tileFromStage(stage);
      if (!tile) {
        setRoomAnchor(null);
        return;
      }
      const x = Math.min(roomAnchor.tile.x, tile.x);
      const y = Math.min(roomAnchor.tile.y, tile.y);
      const width = Math.abs(tile.x - roomAnchor.tile.x) + 1;
      const height = Math.abs(tile.y - roomAnchor.tile.y) + 1;
      if (width >= 4 && height >= 4) {
        dispatch({
          type: 'add_room',
          rect: { x, y, width, height },
          roomType: 'bedroom',
        });
      }
      setRoomAnchor(null);
    },
    [state.tool, roomAnchor, dispatch],
  );

  const handleMouseLeave = useCallback(() => {
    setPointerTile(null);
    if (roomAnchor !== null) setRoomAnchor(null);
  }, [roomAnchor]);

  // Cursor styling depends on the active tool.
  const stageStyle = useMemo<React.CSSProperties>(() => {
    const map: Record<EditorTool, string> = {
      select: 'default',
      room: 'crosshair',
      panel: 'crosshair',
      window: 'crosshair',
      door: 'crosshair',
    };
    return { cursor: map[state.tool], background: PALETTE.walls.paint };
  }, [state.tool]);

  return (
    <div
      data-testid="layout-editor-canvas"
      style={{
        ...stageStyle,
        border: `1px solid ${PALETTE.editor.grid}`,
        display: 'inline-block',
      }}
    >
      <Stage
        width={widthPx}
        height={heightPx}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <Layer listening={false}>
          {/* Grid */}
          {Array.from({ length: state.gridWidth + 1 }, (_, i) => (
            <Line
              key={`gv-${i}`}
              points={[i * SCALE, 0, i * SCALE, heightPx]}
              stroke={PALETTE.editor.grid}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: state.gridHeight + 1 }, (_, j) => (
            <Line
              key={`gh-${j}`}
              points={[0, j * SCALE, widthPx, j * SCALE]}
              stroke={PALETTE.editor.grid}
              strokeWidth={1}
            />
          ))}
        </Layer>

        <Layer>
          {/* Rooms */}
          {state.rooms.map((room) => {
            const isSelected = state.selection?.kind === 'room' && state.selection.id === room.id;
            return (
              <Group key={room.id}>
                <Rect
                  x={room.x * SCALE}
                  y={room.y * SCALE}
                  width={room.width * SCALE}
                  height={room.height * SCALE}
                  fill={PALETTE.rooms[room.type] ?? PALETTE.rooms.corridor}
                  stroke={isSelected ? PALETTE.editor.selection : PALETTE.text.primary}
                  strokeWidth={isSelected ? 2.5 : 1}
                  listening={true}
                />
                <Text
                  x={room.x * SCALE + 4}
                  y={room.y * SCALE + 4}
                  text={`${room.name}\n${room.id}`}
                  fontSize={11}
                  fill={PALETTE.text.primary}
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Windows */}
          {state.windows.map((win) => {
            const x1 = win.start.x * SCALE;
            const y1 = win.start.y * SCALE;
            const x2 = win.end.x * SCALE;
            const y2 = win.end.y * SCALE;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const offset = 3;
            const nx = (-dy / len) * offset;
            const ny = (dx / len) * offset;
            const isSelected = state.selection?.kind === 'window' && state.selection.id === win.id;
            return (
              <React.Fragment key={`win-${win.id}`}>
                <Line
                  points={[x1 + nx, y1 + ny, x2 + nx, y2 + ny]}
                  stroke={isSelected ? PALETTE.editor.selection : PALETTE.openings.window_frame}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <Line
                  points={[x1 - nx, y1 - ny, x2 - nx, y2 - ny]}
                  stroke={isSelected ? PALETTE.editor.selection : PALETTE.openings.window_frame}
                  strokeWidth={isSelected ? 3 : 2}
                />
              </React.Fragment>
            );
          })}

          {/* Doors */}
          {state.doors.map((door) => {
            const hinge = door.hinge === 'start' ? door.start : door.end;
            const other = door.hinge === 'start' ? door.end : door.start;
            const dx = other.x - hinge.x;
            const dy = other.y - hinge.y;
            // perpendicular CCW; swing_side='right' flips
            const sign = door.swing_side === 'left' ? 1 : -1;
            const px = -dy * sign;
            const py = dx * sign;
            const leafTip = { x: hinge.x + px, y: hinge.y + py };
            const hingeS = { x: hinge.x * SCALE, y: hinge.y * SCALE };
            const otherS = { x: other.x * SCALE, y: other.y * SCALE };
            const tipS = { x: leafTip.x * SCALE, y: leafTip.y * SCALE };
            const r = Math.hypot(otherS.x - hingeS.x, otherS.y - hingeS.y);
            const sweepFlag = door.swing_side === 'left' ? 1 : 0;
            const isSelected = state.selection?.kind === 'door' && state.selection.id === door.id;
            return (
              <React.Fragment key={`door-${door.id}`}>
                <Line
                  points={[hingeS.x, hingeS.y, tipS.x, tipS.y]}
                  stroke={isSelected ? PALETTE.editor.selection : PALETTE.openings.door_frame}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <Path
                  data={`M ${tipS.x} ${tipS.y} A ${r} ${r} 0 0 ${sweepFlag} ${otherS.x} ${otherS.y}`}
                  stroke={isSelected ? PALETTE.editor.selection : PALETTE.openings.door_arc}
                  strokeWidth={1.5}
                  dash={[4, 3]}
                />
              </React.Fragment>
            );
          })}

          {/* Electrical panel */}
          {state.electricalPanel && (
            <Rect
              x={state.electricalPanel.x * SCALE + SCALE * 0.15}
              y={state.electricalPanel.y * SCALE + SCALE * 0.15}
              width={SCALE * 0.7}
              height={SCALE * 0.7}
              fill={PALETTE.electrical.panel}
              stroke={
                state.selection?.kind === 'panel' ? PALETTE.editor.selection : PALETTE.text.primary
              }
              strokeWidth={state.selection?.kind === 'panel' ? 2.5 : 1}
            />
          )}
        </Layer>

        {/* Hover preview */}
        <Layer listening={false}>
          {state.tool === 'room' && roomAnchor && pointerTile && (
            <Rect
              x={Math.min(roomAnchor.tile.x, pointerTile.x) * SCALE}
              y={Math.min(roomAnchor.tile.y, pointerTile.y) * SCALE}
              width={(Math.abs(pointerTile.x - roomAnchor.tile.x) + 1) * SCALE}
              height={(Math.abs(pointerTile.y - roomAnchor.tile.y) + 1) * SCALE}
              fill={PALETTE.editor.preview}
              opacity={0.3}
              stroke={PALETTE.editor.selection}
              strokeWidth={1.5}
              dash={[4, 4]}
            />
          )}

          {(state.tool === 'window' || state.tool === 'door') && openingFirst && pointerTile && (
            <Line
              points={(() => {
                const snapped = snapAxisAligned(openingFirst, pointerTile);
                return [
                  openingFirst.x * SCALE,
                  openingFirst.y * SCALE,
                  snapped.x * SCALE,
                  snapped.y * SCALE,
                ];
              })()}
              stroke={PALETTE.editor.selection}
              strokeWidth={2}
              dash={[4, 4]}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
