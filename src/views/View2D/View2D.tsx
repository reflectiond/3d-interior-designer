import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Stage as KonvaStage,
  Layer,
  Rect,
  Text,
  Circle,
  Line,
  Path,
  Group,
  Image as KonvaImage,
  RegularPolygon,
} from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { findNearestWallEdge } from '../../domain/electrical/wallDetection';
import { getEffectiveSize } from '../../domain/furniture/placement';
import type { CatalogItem } from '../../domain/furniture/placement';
import type { Room } from '../../domain/geometry/types';
import { registerKonvaStage } from '../../export/snapshots';
import { getFloorPatternCanvas } from '../floorPatterns';
import { MeasuredCanvas } from '../MeasuredCanvas';
import { useLazyImage } from '../useLazyImage';
import {
  pickCeilingIconAnchor,
  CEILING_ICON_SIZE_TILES,
  CEILING_ICON_LABEL_WIDTH_FACTOR,
} from '../ceilingIcon';
import catalogData from '../../data/furniture-catalog.json';
import styles from './View2D.module.css';

const SCALE = 30; // пикселей на тайл

// Канвы узоров создаются с разрешением 240 px / м, т.е. 60 px / тайл (один тайл = 0.25 м).
// Konva pattern-fill по умолчанию рендерится в нативном пиксельном размере — масштабируем
// его так, чтобы совпадать с экранным размером тайла.
const PATTERN_SCALE = SCALE / 60;

const catalogMap = new Map<string, CatalogItem>();
for (const item of catalogData as CatalogItem[]) {
  catalogMap.set(item.id, item);
}

/**
 * F15.2 (v1.16.0) — рендер мебели на 2D-канве. Если у предмета каталога
 * есть `sprite2d` URL, грузим PNG через `useLazyImage` и рендерим Konva
 * `<Image>`. Пока спрайт грузится или если ошибка — fallback `<Rect>`
 * с цветом по `color_key`. Этот fallback гарантирует, что отсутствие
 * ассета или неудачная загрузка не ломают сцену.
 */
function FurnitureSpriteOrRect({
  spriteUrl,
  width,
  height,
  color,
  stroke,
  strokeWidth,
}: {
  spriteUrl: string | undefined;
  width: number;
  height: number;
  color: string;
  stroke: string;
  strokeWidth: number;
}) {
  const image = useLazyImage(spriteUrl);
  if (image) {
    return (
      <KonvaImage
        image={image}
        width={width}
        height={height}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  return (
    <Rect
      width={width}
      height={height}
      fill={color}
      stroke={stroke}
      strokeWidth={strokeWidth}
      cornerRadius={2}
    />
  );
}

function roomColor(type: Room['type']): string {
  return PALETTE.rooms[type] ?? PALETTE.rooms.corridor;
}

export interface PlacingPreview {
  /** Эффективная ширина размещаемого предмета в тайлах (после поворота). */
  width: number;
  /** Эффективная высота в тайлах (после поворота). */
  height: number;
  /** Возвращает true, если размещение в (tx, ty) (левый нижний угол в tile-up) допустимо. */
  isValid: (tx: number, ty: number) => boolean;
}

export interface FurnitureDragHandlers {
  /** True, если drop мебели id в (tx, ty) (левый нижний угол в tile-up) допустим. */
  isValid: (id: string, tx: number, ty: number) => boolean;
  /** Вызывается один раз после валидного drop'а. Caller обновляет store. */
  onCommit: (id: string, tx: number, ty: number) => void;
}

export interface View2DProps {
  interactionMode?: 'none' | 'electrical' | 'furniture';
  electricalPointType?: 'socket' | 'switch';
  onFurniturePlace?: (tileX: number, tileY: number) => void;
  /** F8.3 — когда задан, View2D рисует подсветку валидности под курсором. */
  placingPreview?: PlacingPreview | null;
  /** F8.1 — когда задан, размещённую мебель можно перетаскивать; ghost следует за курсором, drop валидируется. */
  furnitureDrag?: FurnitureDragHandlers | null;
  /** F8.5 (v1.13.0) — id мебели, выбранной в данный момент на канве. */
  selectedFurnitureId?: string | null;
  /** F8.5 (v1.13.0) — срабатывает при клике пользователя по мебели (id) или по пустой канве (null). */
  onSelectFurniture?: (id: string | null) => void;
}

interface DragState {
  id: string;
  tx: number;
  ty: number;
}

export function View2D({
  interactionMode = 'none',
  electricalPointType = 'socket',
  onFurniturePlace,
  placingPreview,
  furnitureDrag,
  selectedFurnitureId,
  onSelectFurniture,
}: View2DProps) {
  const {
    layout,
    rooms,
    electricalPanel,
    flooring,
    floorCovering,
    ceiling,
    electricalRoutes,
    electricalPoints,
    furniture,
    addElectricalPoint,
  } = useProjectStore();

  const stageRef = useRef<Konva.Stage | null>(null);

  // F8.3 — текущий тайл курсора при размещении мебели, для подсветки валидности
  const [hoverTile, setHoverTile] = useState<{ tx: number; ty: number } | null>(null);
  // F8.1 — состояние drag-to-move и короткая «вспышка» при невалидном drop'е
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [invalidFlash, setInvalidFlash] = useState<{
    tx: number;
    ty: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    registerKonvaStage(stageRef.current);
    return () => registerKonvaStage(null);
  }, [layout]);

  const handleCanvasClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!layout) return;

      // F8.5.4 (v1.13.0): в режиме 'none' клик по пустой канве снимает
      // выделение мебели. Furniture Group ставит cancelBubble в собственном
      // onClick, поэтому эта ветка не срабатывает после клика по предмету.
      if (interactionMode === 'none') {
        onSelectFurniture?.(null);
        return;
      }

      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const tileX = pos.x / SCALE;
      const tileY = layout.gridHeight - pos.y / SCALE;

      if (interactionMode === 'electrical') {
        const edge = findNearestWallEdge(tileX, tileY, rooms, layout.gridWidth, layout.gridHeight);
        if (!edge) return;

        addElectricalPoint({
          id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          wallId: `wall_${edge.tile.x}_${edge.tile.y}`,
          position: 0.5,
          type: electricalPointType,
        });
      } else if (interactionMode === 'furniture' && onFurniturePlace) {
        onFurniturePlace(tileX, tileY);
      }
    },
    [
      interactionMode,
      electricalPointType,
      layout,
      rooms,
      addElectricalPoint,
      onFurniturePlace,
      onSelectFurniture,
    ],
  );

  // F8.3.2 — отслеживаем курсор только во время размещения; точности до тайла достаточно, debounce не нужен
  const handleStageMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!placingPreview || !layout) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const tx = Math.floor(pos.x / SCALE);
      const ty = Math.floor(layout.gridHeight - pos.y / SCALE);
      setHoverTile((prev) => (prev && prev.tx === tx && prev.ty === ty ? prev : { tx, ty }));
    },
    [placingPreview, layout],
  );

  const handleStageLeave = useCallback(() => setHoverTile(null), []);

  if (!layout) return null;

  const { gridWidth, gridHeight } = layout;
  const canvasWidth = gridWidth * SCALE;
  const canvasHeight = gridHeight * SCALE;

  return (
    <div className={styles.container}>
      <MeasuredCanvas
        widthPx={canvasWidth}
        heightPx={canvasHeight}
        pxPerTile={SCALE}
        testIdPrefix="view2d"
      >
        <KonvaStage
          ref={stageRef}
          width={canvasWidth}
          height={canvasHeight}
          onClick={handleCanvasClick}
          onMouseMove={handleStageMove}
          onMouseLeave={handleStageLeave}
        >
          <Layer>
            {/* Канонический z-порядок (F6.4.1):
              1. Заливка комнаты   — базовый цвет по room.type
              2. Напольное покрытие — Konva pattern (F6.2)
              3. Подписи           — название и площадь комнаты
              4. Стены             — внутренние и внешние контуры
              5. Электрощит        — щиток
              6. Тёплый пол        — коралловый оверлей и иконки тепловолн (F6.1)
              7. Маршруты электрики — провода
              8. Электроточки      — розетки и выключатели
              9. Мебель
              10. Веранда
              11. Иконки потолка   — должны оставаться сверху (F6.3) */}

            {/* Заливка комнат */}
            {rooms.map((room) => (
              <Rect
                key={room.id}
                x={room.rect.x * SCALE}
                y={(gridHeight - room.rect.y - room.rect.height) * SCALE}
                width={room.rect.width * SCALE}
                height={room.rect.height * SCALE}
                fill={roomColor(room.type)}
                stroke={PALETTE.walls.external}
                strokeWidth={1}
              />
            ))}

            {/* Напольные покрытия (F6.2) — Konva-pattern fill, по комнатам */}
            {rooms.map((room) => {
              const cov = floorCovering[room.id];
              // F3.1.3 (v1.9.0): `none` оставляет ячейку комнаты «голой» — узор не рисуется.
              if (!cov || cov === 'none') return null;
              return (
                <Rect
                  key={`floor-cov-${room.id}`}
                  x={room.rect.x * SCALE}
                  y={(gridHeight - room.rect.y - room.rect.height) * SCALE}
                  width={room.rect.width * SCALE}
                  height={room.rect.height * SCALE}
                  fillPatternImage={
                    // Konva принимает HTMLCanvasElement в рантайме; TS-тип слишком узкий.
                    getFloorPatternCanvas(cov) as unknown as HTMLImageElement
                  }
                  fillPatternRepeat="repeat"
                  fillPatternScaleX={PATTERN_SCALE}
                  fillPatternScaleY={PATTERN_SCALE}
                  listening={false}
                />
              );
            })}

            {/* Подписи комнат */}
            {rooms.map((room) => {
              const cx = (room.rect.x + room.rect.width / 2) * SCALE;
              const cy = (gridHeight - room.rect.y - room.rect.height / 2) * SCALE;
              return (
                <Text
                  key={`label-${room.id}`}
                  x={cx - 50}
                  y={cy - 14}
                  width={100}
                  align="center"
                  text={`${room.name}\n${room.area.toFixed(1)} м²`}
                  fontSize={11}
                  fill={PALETTE.text.primary}
                  lineHeight={1.3}
                />
              );
            })}

            {/* Внешние стены (контур дома) */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              stroke={PALETTE.walls.external}
              strokeWidth={3}
              listening={false}
            />

            {/* Внутренние стены между комнатами */}
            {rooms.map((room) => (
              <Rect
                key={`wall-${room.id}`}
                x={room.rect.x * SCALE}
                y={(gridHeight - room.rect.y - room.rect.height) * SCALE}
                width={room.rect.width * SCALE}
                height={room.rect.height * SCALE}
                stroke={PALETTE.walls.plaster}
                strokeWidth={1.5}
                listening={false}
              />
            ))}

            {/* Окна (F7.2.1) — две параллельные линии по обе стороны от линии стены */}
            {layout.windows.map((win) => {
              const sx1 = win.start.x * SCALE;
              const sy1 = (gridHeight - win.start.y) * SCALE;
              const sx2 = win.end.x * SCALE;
              const sy2 = (gridHeight - win.end.y) * SCALE;
              const dx = sx2 - sx1;
              const dy = sy2 - sy1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const offset = 3;
              const nx = (-dy / len) * offset;
              const ny = (dx / len) * offset;
              return (
                <React.Fragment key={`win-${win.id}`}>
                  <Line
                    points={[sx1 + nx, sy1 + ny, sx2 + nx, sy2 + ny]}
                    stroke={PALETTE.openings.window_frame}
                    strokeWidth={1}
                    listening={false}
                  />
                  <Line
                    points={[sx1 - nx, sy1 - ny, sx2 - nx, sy2 - ny]}
                    stroke={PALETTE.openings.window_frame}
                    strokeWidth={1}
                    listening={false}
                  />
                </React.Fragment>
              );
            })}

            {/* Дверные проёмы (F7.3.1, F7.3.2) — линия створки + дуга распахивания.
              Геометрия считается в domain (y-up), затем переводится в экранные координаты. */}
            {layout.doors.map((door) => {
              const hingeD = door.hinge === 'start' ? door.start : door.end;
              const otherD = door.hinge === 'start' ? door.end : door.start;
              const dxD = otherD.x - hingeD.x;
              const dyD = otherD.y - hingeD.y;
              // перпендикуляр в domain: 90° CCW = (-dyD, dxD); swing_side='right' переворачивает.
              const sign = door.swing_side === 'left' ? 1 : -1;
              const pxD = -dyD * sign;
              const pyD = dxD * sign;
              const leafTipD = { x: hingeD.x + pxD, y: hingeD.y + pyD };

              const toScreenX = (tx: number) => tx * SCALE;
              const toScreenY = (ty: number) => (gridHeight - ty) * SCALE;
              const hingeS = { x: toScreenX(hingeD.x), y: toScreenY(hingeD.y) };
              const otherS = { x: toScreenX(otherD.x), y: toScreenY(otherD.y) };
              const leafTipS = { x: toScreenX(leafTipD.x), y: toScreenY(leafTipD.y) };

              const r = Math.hypot(otherS.x - hingeS.x, otherS.y - hingeS.y);
              // SVG arc sweep-flag: y-flip между domain и экраном превращает CCW
              // в domain в CW на экране. swing_side='left' даёт sweep=0,
              // 'right' даёт sweep=1.
              const sweepFlag = door.swing_side === 'left' ? 0 : 1;

              return (
                <React.Fragment key={`door-${door.id}`}>
                  {/* Створка двери */}
                  <Line
                    points={[hingeS.x, hingeS.y, leafTipS.x, leafTipS.y]}
                    stroke={PALETTE.openings.door_frame}
                    strokeWidth={1.5}
                    listening={false}
                  />
                  {/* Дуга распахивания (пунктир) */}
                  <Path
                    data={`M ${leafTipS.x} ${leafTipS.y} A ${r} ${r} 0 0 ${sweepFlag} ${otherS.x} ${otherS.y}`}
                    stroke={PALETTE.openings.door_arc}
                    strokeWidth={1}
                    dash={[4, 3]}
                    listening={false}
                  />
                </React.Fragment>
              );
            })}

            {/* Электрощит — рендерится как квадрат на стене */}
            {electricalPanel && (
              <>
                <Rect
                  x={(electricalPanel.x + 0.1) * SCALE}
                  y={(gridHeight - electricalPanel.y - 0.9) * SCALE}
                  width={SCALE * 0.8}
                  height={SCALE * 0.8}
                  fill={PALETTE.electrical.panel}
                  cornerRadius={3}
                />
                <Text
                  x={(electricalPanel.x + 0.5) * SCALE - 5}
                  y={(gridHeight - electricalPanel.y - 0.5) * SCALE - 5}
                  text="⚡"
                  fontSize={11}
                  listening={false}
                />
              </>
            )}

            {/* Тёплый пол (F6.1) — заливка-оверлей + иконки тепловолн каждые 4 тайла */}
            {rooms
              .filter((r) => flooring[r.id] === 'screed_heated')
              .map((room) => {
                const x = room.rect.x * SCALE;
                const y = (gridHeight - room.rect.y - room.rect.height) * SCALE;
                const w = room.rect.width * SCALE;
                const h = room.rect.height * SCALE;
                const icons: { ix: number; iy: number }[] = [];
                // шаг 4 тайла в tile-space, центрировано на +2 тайла по каждой оси
                for (let dx = 2; dx < room.rect.width; dx += 4) {
                  for (let dy = 2; dy < room.rect.height; dy += 4) {
                    icons.push({
                      ix: x + dx * SCALE,
                      iy: (gridHeight - room.rect.y - dy) * SCALE,
                    });
                  }
                }
                return (
                  <React.Fragment key={`heated-${room.id}`}>
                    <Rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={PALETTE.heated_floor.background}
                      opacity={0.15}
                      listening={false}
                    />
                    {icons.map(({ ix, iy }, j) => (
                      <React.Fragment key={`heat-icon-${room.id}-${j}`}>
                        {[-6, 0, 6].map((dy) => (
                          <Path
                            key={dy}
                            x={ix - 12}
                            y={iy + dy}
                            data="M 0 0 q 4 -3 8 0 t 8 0 t 8 0"
                            stroke={PALETTE.heated_floor.icon}
                            strokeWidth={1.4}
                            opacity={0.4}
                            listening={false}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}

            {/* Маршруты электрики */}
            {electricalRoutes.map((route) => {
              if (route.path.length < 2) return null;
              const points = route.path.flatMap((t) => [
                (t.x + 0.5) * SCALE,
                (gridHeight - t.y - 0.5) * SCALE,
              ]);
              return (
                <Line
                  key={`route-${route.pointId}`}
                  points={points}
                  stroke={PALETTE.electrical.wire}
                  strokeWidth={2}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              );
            })}

            {/* Электроточки с номерами */}
            {electricalPoints.map((point, index) => {
              const px = (Number(point.wallId.split('_')[1]) + 0.5) * SCALE;
              const py = (gridHeight - Number(point.wallId.split('_')[2]) - 0.5) * SCALE;
              const color =
                point.type === 'socket' ? PALETTE.electrical.socket : PALETTE.electrical.switch;
              const num = index + 1;
              return (
                <React.Fragment key={`epoint-${point.id}`}>
                  <Circle
                    x={px}
                    y={py}
                    radius={SCALE * 0.4}
                    fill={color}
                    stroke={PALETTE.walls.external}
                    strokeWidth={1}
                  />
                  <Text
                    x={px - SCALE * 0.25}
                    y={py - SCALE * 0.2}
                    width={SCALE * 0.5}
                    align="center"
                    text={String(num)}
                    fontSize={10}
                    fontStyle="bold"
                    fill="white"
                    listening={false}
                  />
                </React.Fragment>
              );
            })}

            {/* Размещённая мебель (F8.1 — draggable, когда задан furnitureDrag) */}
            {furniture.map((f, i) => {
              const item = catalogMap.get(f.catalogId);
              if (!item) return null;
              const { w, h } = getEffectiveSize(item, f.rotation);
              const colorKey = item.color_key as keyof typeof PALETTE.furniture;
              const color = PALETTE.furniture[colorKey] ?? PALETTE.furniture.chair;
              const screenX = f.position.x * SCALE;
              const screenY = (gridHeight - f.position.y - h) * SCALE;
              const draggable = !!furnitureDrag;
              // F8.2.3 — зеркалим вокруг правого края группы, чтобы прямоугольник
              // оставался на том же экранном следе, а содержимое флипалось.
              const widthPx = w * SCALE;
              const isSelected = selectedFurnitureId === f.id;
              return (
                <Group
                  key={`furn-${f.id}`}
                  x={screenX}
                  y={screenY}
                  scaleX={f.mirrored ? -1 : 1}
                  offsetX={f.mirrored ? widthPx : 0}
                  draggable={draggable}
                  // F8.1.2 — оригинал визуально остаётся на месте во время drag;
                  // ghost показывает кандидатную позицию отдельно.
                  dragBoundFunc={() => ({ x: screenX, y: screenY })}
                  // F8.5.1 (v1.13.0) — клик выбирает этот предмет на канве.
                  // cancelBubble блокирует Stage onClick, который иначе сразу же
                  // снял бы выделение через ветку «empty-canvas».
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectFurniture?.(f.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelectFurniture?.(f.id);
                  }}
                  onDragStart={() => {
                    onSelectFurniture?.(f.id);
                    setDragState({ id: f.id, tx: f.position.x, ty: f.position.y });
                  }}
                  onDragMove={(e) => {
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    if (!pos) return;
                    // Центрируем ghost под курсором — так размещение предсказуемо.
                    const tx = Math.round(pos.x / SCALE - w / 2);
                    const ty = Math.round(gridHeight - pos.y / SCALE - h / 2);
                    setDragState((prev) =>
                      prev && prev.tx === tx && prev.ty === ty ? prev : { id: f.id, tx, ty },
                    );
                  }}
                  onDragEnd={() => {
                    if (!dragState || !furnitureDrag) {
                      setDragState(null);
                      return;
                    }
                    const { id, tx, ty } = dragState;
                    if (furnitureDrag.isValid(id, tx, ty)) {
                      furnitureDrag.onCommit(id, tx, ty);
                    } else {
                      // F8.1.3 — мигаем красным на отклонённой позиции drop'а
                      setInvalidFlash({ tx, ty, w, h });
                      window.setTimeout(() => setInvalidFlash(null), 500);
                    }
                    setDragState(null);
                  }}
                >
                  <FurnitureSpriteOrRect
                    spriteUrl={item.sprite2d}
                    width={w * SCALE}
                    height={h * SCALE}
                    color={color}
                    stroke={isSelected ? PALETTE.editor.selection : PALETTE.walls.external}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* F8.5-fix2 (v1.17.0) — визуальный индикатор «передней»
                      стороны: треугольник, который вращается с f.rotation
                      (90° шаг) и зеркалится через scaleX группы.
                      Без индикатора rotation квадратной мебели был
                      незаметен в 2D, и пользователь думал, что R не
                      работает. */}
                  {(() => {
                    const fw = w * SCALE;
                    const fh = h * SCALE;
                    // Маппинг подобран эмпирически под направление лицевой
                    // стороны Kenney-моделей в 3D-сцене после Z-mirror.
                    const triPositions: Record<
                      0 | 90 | 180 | 270,
                      { x: number; y: number; rotation: number }
                    > = {
                      0: { x: fw / 2, y: 6, rotation: 0 },
                      90: { x: fw - 6, y: fh / 2, rotation: 90 },
                      180: { x: fw / 2, y: fh - 6, rotation: 180 },
                      270: { x: 6, y: fh / 2, rotation: 270 },
                    };
                    const tp = triPositions[f.rotation];
                    return (
                      <RegularPolygon
                        sides={3}
                        radius={5}
                        x={tp.x}
                        y={tp.y}
                        rotation={tp.rotation}
                        fill="rgba(255,255,255,0.9)"
                        stroke="rgba(0,0,0,0.6)"
                        strokeWidth={0.5}
                        listening={false}
                      />
                    );
                  })()}
                  <Text
                    x={2}
                    y={2}
                    text={`${i + 1}. ${item.name}`}
                    fontSize={8}
                    fill="white"
                    listening={false}
                  />
                </Group>
              );
            })}

            {/* Веранда (если есть, полупрозрачная) */}
            {layout.veranda && (
              <Rect
                x={layout.veranda.x * SCALE}
                y={(gridHeight - layout.veranda.y - layout.veranda.height) * SCALE}
                width={layout.veranda.width * SCALE}
                height={layout.veranda.height * SCALE}
                fill={PALETTE.rooms.veranda}
                opacity={0.5}
                stroke={PALETTE.walls.external}
                strokeWidth={2}
                dash={[8, 4]}
              />
            )}

            {/* Иконки типа потолка (F6.3) — верхний правый угол с избеганием коллизий.
              Рендерятся последними, чтобы лежать поверх мебели (см. z-порядок F6.4.1). */}
            {rooms.map((room) => {
              const cType = ceiling[room.id] ?? 'stretch';
              const anchor = pickCeilingIconAnchor(room, furniture, catalogMap);
              const sizeScreen = CEILING_ICON_SIZE_TILES * SCALE;
              // Anchor лежит в tile-y-up; переводим в экранные координаты Konva
              const left = anchor.tx * SCALE;
              const top = (gridHeight - anchor.ty - CEILING_ICON_SIZE_TILES) * SCALE;
              const cx = left + sizeScreen / 2;
              const cy = top + sizeScreen / 2;
              const labelText = cType === 'stretch' ? 'Натяжной' : 'Гипсокартон';
              const iconColor =
                cType === 'stretch' ? PALETTE.ceiling.stretch : PALETTE.ceiling.drywall;
              return (
                <React.Fragment key={`ceiling-icon-${room.id}`}>
                  {cType === 'stretch' ? (
                    <Circle
                      x={cx}
                      y={cy}
                      radius={sizeScreen / 2.4}
                      fill={iconColor}
                      stroke={PALETTE.text.secondary}
                      strokeWidth={1}
                      listening={false}
                    />
                  ) : (
                    <>
                      <Line
                        points={[
                          cx - sizeScreen / 2.4,
                          cy - sizeScreen / 2.4,
                          cx + sizeScreen / 2.4,
                          cy + sizeScreen / 2.4,
                        ]}
                        stroke={PALETTE.text.secondary}
                        strokeWidth={1.6}
                        listening={false}
                      />
                      <Line
                        points={[
                          cx + sizeScreen / 2.4,
                          cy - sizeScreen / 2.4,
                          cx - sizeScreen / 2.4,
                          cy + sizeScreen / 2.4,
                        ]}
                        stroke={PALETTE.text.secondary}
                        strokeWidth={1.6}
                        listening={false}
                      />
                    </>
                  )}
                  <Text
                    // Бокс подписи шириной `LABEL_WIDTH_FACTOR × iconSize`, центрирован
                    // на иконке. wrap="none" не даёт Konva ломать длинные подписи
                    // вроде «Гипсокартон» на две строки.
                    x={left - ((CEILING_ICON_LABEL_WIDTH_FACTOR - 1) * sizeScreen) / 2}
                    y={top + sizeScreen + 1}
                    width={sizeScreen * CEILING_ICON_LABEL_WIDTH_FACTOR}
                    align="center"
                    wrap="none"
                    text={labelText}
                    fontSize={10}
                    fill={PALETTE.text.secondary}
                    listening={false}
                  />
                </React.Fragment>
              );
            })}

            {/* Подсветка валидности размещения (F8.3) — рисуется последней, чтобы
              висеть поверх всех остальных элементов, пока пользователь позиционирует предмет. */}
            {placingPreview &&
              hoverTile &&
              (() => {
                const tx = hoverTile.tx;
                const ty = hoverTile.ty;
                const valid = placingPreview.isValid(tx, ty);
                const color = valid
                  ? PALETTE.placement_highlight.valid
                  : PALETTE.placement_highlight.invalid;
                return (
                  <Rect
                    x={tx * SCALE}
                    y={(gridHeight - ty - placingPreview.height) * SCALE}
                    width={placingPreview.width * SCALE}
                    height={placingPreview.height * SCALE}
                    fill={color}
                    opacity={0.35}
                    stroke={color}
                    strokeWidth={1.5}
                    listening={false}
                  />
                );
              })()}

            {/* Ghost для drag-to-move (F8.1.2) — полупрозрачный силуэт, следующий
              за курсором, пока пользователь тащит размещённый предмет. Цвет рамки
              отражает валидность, чтобы пользователь видел обратную связь до drop'а. */}
            {dragState &&
              furnitureDrag &&
              (() => {
                const f = furniture.find((x) => x.id === dragState.id);
                if (!f) return null;
                const item = catalogMap.get(f.catalogId);
                if (!item) return null;
                const { w: gw, h: gh } = getEffectiveSize(item, f.rotation);
                const valid = furnitureDrag.isValid(dragState.id, dragState.tx, dragState.ty);
                const border = valid
                  ? PALETTE.placement_highlight.valid
                  : PALETTE.placement_highlight.invalid;
                return (
                  <Rect
                    x={dragState.tx * SCALE}
                    y={(gridHeight - dragState.ty - gh) * SCALE}
                    width={gw * SCALE}
                    height={gh * SCALE}
                    fill={PALETTE.placement_highlight.ghost}
                    opacity={0.4}
                    stroke={border}
                    strokeWidth={2}
                    listening={false}
                  />
                );
              })()}

            {/* Вспышка при невалидном drop'е (F8.1.3) — короткий красный блик в отклонённой позиции. */}
            {invalidFlash && (
              <Rect
                x={invalidFlash.tx * SCALE}
                y={(gridHeight - invalidFlash.ty - invalidFlash.h) * SCALE}
                width={invalidFlash.w * SCALE}
                height={invalidFlash.h * SCALE}
                fill={PALETTE.placement_highlight.invalid}
                opacity={0.5}
                listening={false}
              />
            )}
          </Layer>
        </KonvaStage>
      </MeasuredCanvas>
      {interactionMode === 'electrical' && (
        <p className={styles.hint}>
          Кликните по внутренней стене комнаты для добавления{' '}
          {electricalPointType === 'socket' ? 'розетки' : 'выключателя'}
        </p>
      )}
      <p className={styles.legend}>Масштаб: 1 тайл = {TILE_SIZE * 100} см</p>
    </div>
  );
}
