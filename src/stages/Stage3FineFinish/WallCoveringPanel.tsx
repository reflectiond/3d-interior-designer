import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import type { WallCovering } from '../../domain/geometry/types';
import styles from '../Stage2RoughFinish/SidePanel.module.css';

const OPTIONS: { value: WallCovering; label: string }[] = [
  { value: 'paint', label: 'Покраска' },
  { value: 'wallpaper', label: 'Обои' },
];

export function WallCoveringPanel() {
  const { rooms, wallCovering, setWallCovering } = useProjectStore();
  const relevantRooms = rooms.filter((r) => r.type !== 'corridor' && r.type !== 'wardrobe');

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Покрытие стен</h3>
      <p style={{ fontSize: '0.82rem', color: PALETTE.text.secondary, margin: '0 0 0.75rem' }}>
        Выбор покрытия для стен каждой комнаты.
      </p>
      <ul className={styles.roomList}>
        {relevantRooms.map((room) => {
          const current = wallCovering[room.id] ?? 'paint';
          return (
            <li key={room.id} className={styles.roomItem}>
              <span className={styles.roomName}>{room.name}</span>
              <div className={styles.radioGroup}>
                {OPTIONS.map((opt) => (
                  <label key={opt.value} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name={`wall-${room.id}`}
                      checked={current === opt.value}
                      onChange={() => setWallCovering(room.id, opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
