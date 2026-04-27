import React, { useCallback, useEffect, useRef } from 'react';
import { Stage as KonvaStage, Layer, Rect, Text, Circle, Line, Path } from 'react-konva';
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
import catalogData from '../../data/furniture-catalog.json';
import styles from './View2D.module.css';

const SCALE = 30; // pixels per tile

const catalogMap = new Map<string, CatalogItem>();
for (const item of catalogData as CatalogItem[]) {
  catalogMap.set(item.id, item);
}

function roomColor(type: Room['type']): string {
  return PALETTE.rooms[type] ?? PALETTE.rooms.corridor;
}

export interface View2DProps {
  interactionMode?: 'none' | 'electrical' | 'furniture';
  electricalPointType?: 'socket' | 'switch';
  onFurniturePlace?: (tileX: number, tileY: number) => void;
}

export function View2D({
  interactionMode = 'none',
  electricalPointType = 'socket',
  onFurniturePlace,
}: View2DProps) {
  const {
    layout,
    rooms,
    electricalPanel,
    flooring,
    electricalRoutes,
    electricalPoints,
    furniture,
    addElectricalPoint,
  } = useProjectStore();

  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    registerKonvaStage(stageRef.current);
    return () => registerKonvaStage(null);
  }, [layout]);

  const handleCanvasClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (interactionMode === 'none' || !layout) return;

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
    [interactionMode, electricalPointType, layout, rooms, addElectricalPoint, onFurniturePlace],
  );

  if (!layout) return null;

  const { gridWidth, gridHeight } = layout;
  const canvasWidth = gridWidth * SCALE;
  const canvasHeight = gridHeight * SCALE;

  return (
    <div className={styles.container}>
      <KonvaStage
        ref={stageRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleCanvasClick}
      >
        <Layer>
          {/* Room fills */}
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

          {/* Room labels */}
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

          {/* External walls (house outline) */}
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            stroke={PALETTE.walls.external}
            strokeWidth={3}
            listening={false}
          />

          {/* Internal walls between rooms */}
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

          {/* Electrical panel (щиток) — rendered as a square on the wall */}
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

          {/* Heated floor (F6.1) — filled overlay + heat-wave icons every 4 tiles */}
          {rooms
            .filter((r) => flooring[r.id] === 'screed_heated')
            .map((room) => {
              const x = room.rect.x * SCALE;
              const y = (gridHeight - room.rect.y - room.rect.height) * SCALE;
              const w = room.rect.width * SCALE;
              const h = room.rect.height * SCALE;
              const icons: { ix: number; iy: number }[] = [];
              // 4-tile spacing in tile space, centered at +2 tiles in each axis
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

          {/* Electrical routes */}
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

          {/* Electrical points with numbers */}
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

          {/* Placed furniture */}
          {furniture.map((f, i) => {
            const item = catalogMap.get(f.catalogId);
            if (!item) return null;
            const { w, h } = getEffectiveSize(item, f.rotation);
            const colorKey = item.color_key as keyof typeof PALETTE.furniture;
            const color = PALETTE.furniture[colorKey] ?? PALETTE.furniture.chair;
            return (
              <React.Fragment key={`furn-${f.id}`}>
                <Rect
                  x={f.position.x * SCALE}
                  y={(gridHeight - f.position.y - h) * SCALE}
                  width={w * SCALE}
                  height={h * SCALE}
                  fill={color}
                  stroke={PALETTE.walls.external}
                  strokeWidth={1}
                  cornerRadius={2}
                />
                <Text
                  x={f.position.x * SCALE + 2}
                  y={(gridHeight - f.position.y - h) * SCALE + 2}
                  text={`${i + 1}. ${item.name}`}
                  fontSize={8}
                  fill="white"
                  listening={false}
                />
              </React.Fragment>
            );
          })}

          {/* Veranda (if present, semi-transparent) */}
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
        </Layer>
      </KonvaStage>
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
