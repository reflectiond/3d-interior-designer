import { useProjectStore } from '../../store/projectStore';
import type { FloorCovering } from '../../domain/geometry/types';
import styles from '../Stage2RoughFinish/SidePanel.module.css';

// «Без покрытия» first so it shows up as the first radio in the dropdown.
// F3.1.3 (v1.9.0): default is `none` until the user picks a material.
const OPTIONS: { value: FloorCovering; label: string }[] = [
  { value: 'none', label: 'Без покрытия' },
  { value: 'linoleum', label: 'Линолеум' },
  { value: 'laminate', label: 'Ламинат' },
  { value: 'tile', label: 'Плитка' },
  { value: 'quartz_vinyl', label: 'Кварцвинил' },
];

export function FloorCoveringPanel() {
  const { rooms, floorCovering, setFloorCovering } = useProjectStore();
  // TODO(v1.9.b — F12.1): drop this filter so corridor and wardrobe also pick a covering.
  const relevantRooms = rooms.filter((r) => r.type !== 'corridor' && r.type !== 'wardrobe');

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Покрытие пола</h3>
      <ul className={styles.roomList}>
        {relevantRooms.map((room) => {
          const current = floorCovering[room.id] ?? 'none';
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
