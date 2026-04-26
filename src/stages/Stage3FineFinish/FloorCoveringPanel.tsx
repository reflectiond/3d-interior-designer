import { useProjectStore } from '../../store/projectStore';
import type { FloorCovering } from '../../domain/geometry/types';
import styles from '../Stage2RoughFinish/SidePanel.module.css';

const OPTIONS: { value: FloorCovering; label: string }[] = [
  { value: 'linoleum', label: 'Линолеум' },
  { value: 'laminate', label: 'Ламинат' },
  { value: 'tile', label: 'Плитка' },
  { value: 'quartz_vinyl', label: 'Кварцвинил' },
];

export function FloorCoveringPanel() {
  const { rooms, floorCovering, setFloorCovering } = useProjectStore();
  const relevantRooms = rooms.filter((r) => r.type !== 'corridor' && r.type !== 'wardrobe');

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Покрытие пола</h3>
      <ul className={styles.roomList}>
        {relevantRooms.map((room) => {
          const current = floorCovering[room.id] ?? 'laminate';
          return (
            <li key={room.id} className={styles.roomItem}>
              <span className={styles.roomName}>
                {room.name} ({room.area.toFixed(1)} м²)
              </span>
              <select
                value={current}
                onChange={(e) => setFloorCovering(room.id, e.target.value as FloorCovering)}
                style={{ fontSize: '0.82rem', padding: '0.25rem 0.5rem', borderRadius: 4 }}
              >
                {OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
