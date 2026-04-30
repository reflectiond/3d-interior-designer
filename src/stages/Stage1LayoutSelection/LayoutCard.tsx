import type { Layout } from '../../domain/geometry/types';
import { TILE_AREA } from '../../domain/geometry/tiles';
import styles from './LayoutCard.module.css';

interface LayoutCardProps {
  layout: Layout;
  isSelected: boolean;
  onSelect: (layout: Layout) => void;
  /** F14.3 — маркер импортированной карточки + кнопка удаления. */
  isCustom?: boolean;
  /** F14.4 — обработчик кнопки «×». Вызывается после confirm-диалога. */
  onDelete?: () => void;
}

export function LayoutCard({ layout, isSelected, onSelect, isCustom, onDelete }: LayoutCardProps) {
  const totalTiles = layout.rooms.reduce((sum, r) => sum + r.width * r.height, 0);
  const totalArea = (totalTiles * TILE_AREA).toFixed(1);
  const roomNames = layout.rooms.map((r) => r.name).join(', ');

  const handleDelete = () => {
    if (!onDelete) return;
    if (window.confirm(`Удалить «${layout.name}»? Это действие нельзя отменить.`)) {
      onDelete();
    }
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      style={{ position: 'relative' }}
    >
      {isCustom && (
        <>
          <span className={styles.customBadge} aria-label="Своя планировка">
            Своя
          </span>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={handleDelete}
            aria-label={`Удалить ${layout.name}`}
            data-testid="layout-card-delete"
          >
            ×
          </button>
        </>
      )}
      <div className={styles.preview}>
        <MiniMap layout={layout} />
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{layout.name}</h3>
        <p className={styles.area}>{totalArea} м²</p>
        <p className={styles.rooms}>{roomNames}</p>
      </div>
      <button
        className={styles.button}
        onClick={() => onSelect(layout)}
        aria-label={`Выбрать ${layout.name}`}
      >
        {isSelected ? 'Выбрано' : 'Выбрать'}
      </button>
    </div>
  );
}

/** Tiny SVG preview of the layout */
function MiniMap({ layout }: { layout: Layout }) {
  const { gridWidth, gridHeight } = layout;
  const scale = 4;

  return (
    <svg viewBox={`0 0 ${gridWidth * scale} ${gridHeight * scale}`} className={styles.minimap}>
      {layout.rooms.map((room) => (
        <rect
          key={room.id}
          x={room.x * scale}
          y={(gridHeight - room.y - room.height) * scale}
          width={room.width * scale}
          height={room.height * scale}
          className={styles[`room_${room.type}`] || styles.room_default}
          stroke="var(--wall-color)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
