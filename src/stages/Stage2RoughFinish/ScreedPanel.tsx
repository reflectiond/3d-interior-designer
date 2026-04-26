import { useProjectStore } from '../../store/projectStore';
import styles from './SidePanel.module.css';

export function ScreedPanel() {
  const { rooms, flooring, setFlooring } = useProjectStore();

  const relevantRooms = rooms.filter((r) => r.type !== 'corridor' && r.type !== 'wardrobe');

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Стяжка пола</h3>
      <ul className={styles.roomList}>
        {relevantRooms.map((room) => {
          const current = flooring[room.id] ?? 'screed';
          return (
            <li key={room.id} className={styles.roomItem}>
              <span className={styles.roomName}>
                {room.name} ({room.area.toFixed(1)} м²)
              </span>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name={`screed-${room.id}`}
                    checked={current === 'screed'}
                    onChange={() => setFlooring(room.id, 'screed')}
                  />
                  Обычная
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name={`screed-${room.id}`}
                    checked={current === 'screed_heated'}
                    onChange={() => setFlooring(room.id, 'screed_heated')}
                  />
                  Тёплый пол
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
