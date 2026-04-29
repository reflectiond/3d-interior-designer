import { useProjectStore } from '../../store/projectStore';
import styles from './SidePanel.module.css';

export function CeilingPanel() {
  // F2.4.4 / F12.1 (v1.9.0): corridor and wardrobe pick ceiling type alongside the rest.
  const { rooms, ceiling, setCeiling } = useProjectStore();
  const relevantRooms = rooms;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Потолок</h3>
      <ul className={styles.roomList}>
        {relevantRooms.map((room) => {
          const current = ceiling[room.id] ?? 'stretch';
          return (
            <li key={room.id} className={styles.roomItem}>
              <span className={styles.roomName}>
                {room.name} ({room.area.toFixed(1)} м²)
              </span>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name={`ceiling-${room.id}`}
                    checked={current === 'stretch'}
                    onChange={() => setCeiling(room.id, 'stretch')}
                  />
                  Натяжной
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name={`ceiling-${room.id}`}
                    checked={current === 'drywall'}
                    onChange={() => setCeiling(room.id, 'drywall')}
                  />
                  Гипсокартон
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
