import React, { useCallback } from 'react';
import { Stage as KonvaStage, Layer, Rect, Text, Circle, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { findNearestWallEdge } from '../../domain/electrical/wallDetection';
import type { Room } from '../../domain/geometry/types';
import styles from './View2D.module.css';

const SCALE = 30; // pixels per tile

function roomColor(type: Room['type']): string {
  return PALETTE.rooms[type] ?? PALETTE.rooms.corridor;
}

export interface View2DProps {
  /** When 'electrical', clicks on internal walls create electrical points */
  interactionMode?: 'none' | 'electrical';
  /** Type of point to create when clicking */
  electricalPointType?: 'socket' | 'switch';
}

export function View2D({ interactionMode = 'none', electricalPointType = 'socket' }: View2DProps) {
  const {
    layout,
    rooms,
    electricalPanel,
    flooring,
    electricalRoutes,
    electricalPoints,
    addElectricalPoint,
  } = useProjectStore();

  const handleCanvasClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (interactionMode !== 'electrical' || !layout) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Convert pixel coords to tile coords (Y is flipped)
      const tileX = pos.x / SCALE;
      const tileY = layout.gridHeight - pos.y / SCALE;

      const edge = findNearestWallEdge(tileX, tileY, rooms, layout.gridWidth, layout.gridHeight);

      if (!edge) return;

      const pointId = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      addElectricalPoint({
        id: pointId,
        wallId: `wall_${edge.tile.x}_${edge.tile.y}`,
        position: 0.5,
        type: electricalPointType,
      });
    },
    [interactionMode, electricalPointType, layout, rooms, addElectricalPoint],
  );

  if (!layout) return null;

  const { gridWidth, gridHeight } = layout;
  const canvasWidth = gridWidth * SCALE;
  const canvasHeight = gridHeight * SCALE;

  return (
    <div className={styles.container}>
      <KonvaStage width={canvasWidth} height={canvasHeight} onClick={handleCanvasClick}>
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

          {/* Heated floor highlight */}
          {rooms
            .filter((r) => flooring[r.id] === 'screed_heated')
            .map((room) => (
              <Rect
                key={`heated-${room.id}`}
                x={room.rect.x * SCALE + 2}
                y={(gridHeight - room.rect.y - room.rect.height) * SCALE + 2}
                width={room.rect.width * SCALE - 4}
                height={room.rect.height * SCALE - 4}
                stroke={PALETTE.electrical.wire}
                strokeWidth={2}
                dash={[6, 3]}
                listening={false}
              />
            ))}

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
