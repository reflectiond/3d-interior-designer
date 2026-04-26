import { Stage as KonvaStage, Layer, Rect, Text, Circle } from 'react-konva';
import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import type { Room } from '../../domain/geometry/types';
import styles from './View2D.module.css';

const SCALE = 30; // pixels per tile

function roomColor(type: Room['type']): string {
  return PALETTE.rooms[type] ?? PALETTE.rooms.corridor;
}

export function View2D() {
  const { layout, rooms, electricalPanel } = useProjectStore();

  if (!layout) return null;

  const { gridWidth, gridHeight } = layout;
  const canvasWidth = gridWidth * SCALE;
  const canvasHeight = gridHeight * SCALE;

  return (
    <div className={styles.container}>
      <KonvaStage width={canvasWidth} height={canvasHeight}>
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

          {/* Electrical panel icon */}
          {electricalPanel && (
            <>
              <Circle
                x={(electricalPanel.x + 0.5) * SCALE}
                y={(gridHeight - electricalPanel.y - 0.5) * SCALE}
                radius={SCALE * 0.6}
                fill={PALETTE.electrical.panel}
                opacity={0.8}
              />
              <Text
                x={(electricalPanel.x + 0.5) * SCALE - 6}
                y={(gridHeight - electricalPanel.y - 0.5) * SCALE - 5}
                text="⚡"
                fontSize={12}
              />
            </>
          )}

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
      <p className={styles.legend}>Масштаб: 1 тайл = {TILE_SIZE * 100} см</p>
    </div>
  );
}
