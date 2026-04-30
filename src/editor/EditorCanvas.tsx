import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Line, Path, Text, Group } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { PALETTE } from '../theme/palette';
import { findObjectAt, type EditorAction, type EditorState, type EditorTool } from './state';
import { invalidObjectKeys, validateEditor } from './validation';
import { findNearestWall, projectOntoWall, type WallSegment } from './wallSnap';
import { MeasuredCanvas } from '../views/MeasuredCanvas';
import { formatOpeningLength, formatRectDimensions } from './dimensionFormat';
import { TILE_SIZE } from '../domain/geometry/tiles';
import type { TileCoord } from '../domain/geometry/types';

const SCALE = 24;

// F11.3 (v1.14.0) — минимальная площадь комнаты 4 м² (= 64 тайла² при TILE_SIZE = 0.25).
// Геометрия сторон не ограничивается — допустимы 8×8, 4×16, 16×4 и др.
export const MIN_ROOM_AREA_M2 = 4;
const MIN_ROOM_AREA_TILES = Math.round(MIN_ROOM_AREA_M2 / (TILE_SIZE * TILE_SIZE));

interface RectXYWH {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: RectXYWH, b: RectXYWH): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

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
  const invalidKeys = invalidObjectKeys(validateEditor(state));

  const [roomAnchor, setRoomAnchor] = useState<Anchor | null>(null);
  const [pointerTile, setPointerTile] = useState<TileCoord | null>(null);
  // F11.2.9 (v1.10.0) — anchor связан с инструментом, который его создал. Если
  // пользователь в процессе размещения переключился window → door, anchor считается
  // устаревшим и не переиспользуется для нового инструмента.
  // F11.2.8 (v1.10.0) — anchor также помнит, к какой стене он привязался, чтобы
  // второй клик был ограничен той же осью/линией стены.
  const [openingAnchor, setOpeningAnchor] = useState<{
    tile: TileCoord;
    tool: 'window' | 'door';
    wall: WallSegment | null;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      const tile = tileFromStage(stage);
      if (!tile) return;

      // Shift+клик всегда «удалить верхний объект под тайлом» — работает в любом инструменте.
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
        case 'door': {
          // Первый клик ставит anchor, второй коммитит. Anchor привязан к
          // инструменту, чтобы переключение window → door в середине размещения
          // корректно сбрасывалось.
          const sameToolAnchor =
            openingAnchor && openingAnchor.tool === state.tool ? openingAnchor : null;
          if (sameToolAnchor === null) {
            // F11.2.8: если клик попал рядом со стеной комнаты — привязываемся к ней
            // и запоминаем стену, чтобы второй клик был ограничен той же осью.
            // Если комнат пока нет — откатываемся на сырой тайл.
            const snap = findNearestWall(tile, state.rooms);
            const anchorTile = snap ? snap.snapped : tile;
            setOpeningAnchor({
              tile: anchorTile,
              tool: state.tool,
              wall: snap?.wall ?? null,
            });
            setPointerTile(tile);
          } else {
            // Второй клик: проецируем на ту же стену, если она была захвачена;
            // иначе free-axis snap (легаси-поведение для пустых планировок).
            const snapped = sameToolAnchor.wall
              ? projectOntoWall(tile, sameToolAnchor.wall)
              : snapAxisAligned(sameToolAnchor.tile, tile);
            if (snapped.x === sameToolAnchor.tile.x && snapped.y === sameToolAnchor.tile.y) {
              setOpeningAnchor(null);
              return;
            }
            const segment = { start: sameToolAnchor.tile, end: snapped };
            if (state.tool === 'window') {
              dispatch({ type: 'add_window', segment });
            } else {
              dispatch({ type: 'add_door', segment });
            }
            setOpeningAnchor(null);
          }
          return;
        }
      }
    },
    [dispatch, state, openingAnchor],
  );

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const tile = tileFromStage(stage);
    if (tile) setPointerTile(tile);
  }, []);

  // F11.3.4 — финализация drag-create комнаты идёт через window-level mouseup
  // (Stage.onMouseUp нестабилен после mouseLeave). Сценарии:
  //   * release внутри канвы → commit с валидацией (площадь + overlap);
  //   * release снаружи канвы → cancel без commit;
  //   * drag-out-and-back → anchor сохраняется, commit при release внутри.
  // Для решения «inside vs outside» сравниваем clientX/Y mouseup с bounding
  // rect Stage-канвы — это надёжнее Konva mouseenter/leave (которые могут
  // не срабатывать при удержанной кнопке мыши). pointerTile НЕ сбрасывается
  // на mouseLeave: preview остаётся на последней позиции, возврат курсора
  // обновит его через mousemove.
  const pointerTileRef = useRef<TileCoord | null>(null);
  useEffect(() => {
    pointerTileRef.current = pointerTile;
  }, [pointerTile]);

  const handleMouseLeave = useCallback(() => {
    // Не сбрасываем pointerTile: preview остаётся видимым.
  }, []);

  useEffect(() => {
    if (state.tool !== 'room' || roomAnchor === null) return;
    const onUp = (e: MouseEvent) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="layout-editor-canvas"] canvas',
      );
      const tile = pointerTileRef.current;
      let inside = false;
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        inside =
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom;
      }
      if (inside && tile) {
        const x = Math.min(roomAnchor.tile.x, tile.x);
        const y = Math.min(roomAnchor.tile.y, tile.y);
        const width = Math.abs(tile.x - roomAnchor.tile.x) + 1;
        const height = Math.abs(tile.y - roomAnchor.tile.y) + 1;
        const rect = { x, y, width, height };
        const tooSmall = width * height < MIN_ROOM_AREA_TILES;
        const overlapsExisting = state.rooms.some((r2) => rectsOverlap(rect, r2));
        if (!tooSmall && !overlapsExisting) {
          dispatch({ type: 'add_room', rect, roomType: 'bedroom' });
        }
      }
      setRoomAnchor(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [state.tool, roomAnchor, state.rooms, dispatch]);

  // Стиль курсора зависит от активного инструмента.
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
      <MeasuredCanvas widthPx={widthPx} heightPx={heightPx} pxPerTile={SCALE} testIdPrefix="editor">
        <Stage
          width={widthPx}
          height={heightPx}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <Layer listening={false}>
            {/* Сетка */}
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
            {/* Комнаты */}
            {state.rooms.map((room) => {
              const isSelected = state.selection?.kind === 'room' && state.selection.id === room.id;
              const isInvalid = invalidKeys.has(`room:${room.id}`);
              const stroke = isInvalid
                ? PALETTE.placement_highlight.invalid
                : isSelected
                  ? PALETTE.editor.selection
                  : PALETTE.text.primary;
              return (
                <Group key={room.id}>
                  <Rect
                    x={room.x * SCALE}
                    y={room.y * SCALE}
                    width={room.width * SCALE}
                    height={room.height * SCALE}
                    fill={PALETTE.rooms[room.type] ?? PALETTE.rooms.corridor}
                    stroke={stroke}
                    strokeWidth={isInvalid || isSelected ? 2.5 : 1}
                    dash={isInvalid ? [6, 4] : undefined}
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

            {/* Окна */}
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
              const isSelected =
                state.selection?.kind === 'window' && state.selection.id === win.id;
              const isInvalid = invalidKeys.has(`window:${win.id}`);
              const stroke = isInvalid
                ? PALETTE.placement_highlight.invalid
                : isSelected
                  ? PALETTE.editor.selection
                  : PALETTE.openings.window_frame;
              return (
                <React.Fragment key={`win-${win.id}`}>
                  <Line
                    points={[x1 + nx, y1 + ny, x2 + nx, y2 + ny]}
                    stroke={stroke}
                    strokeWidth={isSelected || isInvalid ? 3 : 2}
                  />
                  <Line
                    points={[x1 - nx, y1 - ny, x2 - nx, y2 - ny]}
                    stroke={stroke}
                    strokeWidth={isSelected || isInvalid ? 3 : 2}
                  />
                </React.Fragment>
              );
            })}

            {/* Двери */}
            {state.doors.map((door) => {
              const hinge = door.hinge === 'start' ? door.start : door.end;
              const other = door.hinge === 'start' ? door.end : door.start;
              const dx = other.x - hinge.x;
              const dy = other.y - hinge.y;
              // перпендикуляр CCW; swing_side='right' переворачивает направление
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
              const isInvalid = invalidKeys.has(`door:${door.id}`);
              const leafStroke = isInvalid
                ? PALETTE.placement_highlight.invalid
                : isSelected
                  ? PALETTE.editor.selection
                  : PALETTE.openings.door_frame;
              const arcStroke = isInvalid
                ? PALETTE.placement_highlight.invalid
                : isSelected
                  ? PALETTE.editor.selection
                  : PALETTE.openings.door_arc;
              return (
                <React.Fragment key={`door-${door.id}`}>
                  <Line
                    points={[hingeS.x, hingeS.y, tipS.x, tipS.y]}
                    stroke={leafStroke}
                    strokeWidth={isSelected || isInvalid ? 3 : 2}
                  />
                  <Path
                    data={`M ${tipS.x} ${tipS.y} A ${r} ${r} 0 0 ${sweepFlag} ${otherS.x} ${otherS.y}`}
                    stroke={arcStroke}
                    strokeWidth={1.5}
                    dash={[4, 3]}
                  />
                </React.Fragment>
              );
            })}

            {/* Электрощит */}
            {state.electricalPanel && (
              <Rect
                x={state.electricalPanel.x * SCALE + SCALE * 0.15}
                y={state.electricalPanel.y * SCALE + SCALE * 0.15}
                width={SCALE * 0.7}
                height={SCALE * 0.7}
                fill={PALETTE.electrical.panel}
                stroke={
                  invalidKeys.has('panel')
                    ? PALETTE.placement_highlight.invalid
                    : state.selection?.kind === 'panel'
                      ? PALETTE.editor.selection
                      : PALETTE.text.primary
                }
                strokeWidth={state.selection?.kind === 'panel' ? 2.5 : 1}
              />
            )}
          </Layer>

          {/* Hover-превью */}
          <Layer listening={false}>
            {state.tool === 'room' &&
              roomAnchor &&
              pointerTile &&
              (() => {
                const px = Math.min(roomAnchor.tile.x, pointerTile.x);
                const py = Math.min(roomAnchor.tile.y, pointerTile.y);
                const pw = Math.abs(pointerTile.x - roomAnchor.tile.x) + 1;
                const ph = Math.abs(pointerTile.y - roomAnchor.tile.y) + 1;
                const rect = { x: px, y: py, width: pw, height: ph };
                const overlapsExisting = state.rooms.some((r) => rectsOverlap(rect, r));
                const tooSmall = pw * ph < MIN_ROOM_AREA_TILES;
                // Overlap → красный (приоритет, нельзя вообще создать).
                // Слишком мала → жёлтый. Иначе → стандартная синяя обводка.
                const stroke = overlapsExisting
                  ? PALETTE.placement_highlight.invalid
                  : tooSmall
                    ? PALETTE.placement_highlight.warning
                    : PALETTE.editor.selection;
                const fill = overlapsExisting
                  ? PALETTE.placement_highlight.invalid
                  : tooSmall
                    ? PALETTE.placement_highlight.warning
                    : PALETTE.editor.preview;
                return (
                  <Rect
                    x={px * SCALE}
                    y={py * SCALE}
                    width={pw * SCALE}
                    height={ph * SCALE}
                    fill={fill}
                    opacity={0.3}
                    stroke={stroke}
                    strokeWidth={1.5}
                    dash={[4, 4]}
                  />
                );
              })()}

            {(state.tool === 'window' || state.tool === 'door') &&
              openingAnchor &&
              openingAnchor.tool === state.tool &&
              pointerTile && (
                <Line
                  points={(() => {
                    // Превью использует то же правило snap'а, что и commit (F11.2.8),
                    // чтобы пунктирная линия шла по стене, к которой привязан anchor.
                    const snapped = openingAnchor.wall
                      ? projectOntoWall(pointerTile, openingAnchor.wall)
                      : snapAxisAligned(openingAnchor.tile, pointerTile);
                    return [
                      openingAnchor.tile.x * SCALE,
                      openingAnchor.tile.y * SCALE,
                      snapped.x * SCALE,
                      snapped.y * SCALE,
                    ];
                  })()}
                  stroke={PALETTE.editor.selection}
                  strokeWidth={2}
                  dash={[4, 4]}
                />
              )}

            {/* F13.2 (v1.11.0) — live-HUD with metric dimensions next to cursor.
                F11.3.3 (v1.14.0) — при площади <4 м² или overlap добавляется
                строка-предупреждение красным цветом. */}
            {state.tool === 'room' &&
              roomAnchor &&
              pointerTile &&
              (() => {
                const pw = Math.abs(pointerTile.x - roomAnchor.tile.x) + 1;
                const ph = Math.abs(pointerTile.y - roomAnchor.tile.y) + 1;
                const px = Math.min(roomAnchor.tile.x, pointerTile.x);
                const py = Math.min(roomAnchor.tile.y, pointerTile.y);
                const overlapsExisting = state.rooms.some((r) =>
                  rectsOverlap({ x: px, y: py, width: pw, height: ph }, r),
                );
                const tooSmall = pw * ph < MIN_ROOM_AREA_TILES;
                const warning = overlapsExisting
                  ? 'Перекрывает комнату'
                  : tooSmall
                    ? `Мин. ${MIN_ROOM_AREA_M2} м²`
                    : null;
                return (
                  <DimensionHud
                    tx={pointerTile.x}
                    ty={pointerTile.y}
                    text={formatRectDimensions(pw, ph)}
                    warning={warning}
                  />
                );
              })()}
            {(state.tool === 'window' || state.tool === 'door') &&
              openingAnchor &&
              openingAnchor.tool === state.tool &&
              pointerTile &&
              (() => {
                const snapped = openingAnchor.wall
                  ? projectOntoWall(pointerTile, openingAnchor.wall)
                  : snapAxisAligned(openingAnchor.tile, pointerTile);
                const tiles =
                  Math.abs(snapped.x - openingAnchor.tile.x) +
                  Math.abs(snapped.y - openingAnchor.tile.y);
                if (tiles === 0) return null;
                return (
                  <DimensionHud
                    tx={pointerTile.x}
                    ty={pointerTile.y}
                    text={formatOpeningLength(tiles)}
                  />
                );
              })()}
          </Layer>
        </Stage>
      </MeasuredCanvas>
    </div>
  );
}

/**
 * F13.2.3 (v1.11.0) — плавающая подпись с размерами рядом с курсором.
 * Ширина фиксирована (140 px), чтобы layout был стабилен; Konva Text внутри
 * автоматически переносит длинные строки. Anchor сдвинут на 16 px вправо и
 * 12 px вниз от тайла указателя, чтобы не лежать под курсором.
 *
 * F11.3.3 (v1.14.0) — опциональная вторая строка `warning` рисуется
 * красным под основной (rationale: drag-create комнаты при <4 м² или
 * overlap должен быть тихим, но визуально объяснимым).
 */
function DimensionHud({
  tx,
  ty,
  text,
  warning,
}: {
  tx: number;
  ty: number;
  text: string;
  warning?: string | null;
}) {
  const HUD_WIDTH = 140;
  const ROW_HEIGHT = 18;
  const HUD_HEIGHT = warning ? ROW_HEIGHT * 2 : ROW_HEIGHT;
  const x = tx * SCALE + 16;
  const y = ty * SCALE + 12;
  return (
    <Group listening={false} data-testid="dimension-hud">
      <Rect
        x={x}
        y={y}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        fill={PALETTE.walls.paint}
        opacity={0.9}
        stroke={warning ? PALETTE.placement_highlight.invalid : PALETTE.editor.selection}
        strokeWidth={1}
        cornerRadius={3}
      />
      <Text
        x={x + 6}
        y={y + 3}
        text={text}
        fontSize={11}
        fill={PALETTE.text.primary}
        listening={false}
      />
      {warning && (
        <Text
          x={x + 6}
          y={y + 3 + ROW_HEIGHT}
          text={warning}
          fontSize={11}
          fill={PALETTE.placement_highlight.invalid}
          listening={false}
          data-testid="dimension-hud-warning"
        />
      )}
    </Group>
  );
}
