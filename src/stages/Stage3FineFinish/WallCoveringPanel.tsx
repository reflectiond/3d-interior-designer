import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import type { WallCovering } from '../../domain/geometry/types';
import styles from '../Stage2RoughFinish/SidePanel.module.css';

// F3.2.5 (v1.9.0): «Без покрытия» first; default value is `none` until the
// user picks paint or wallpaper.
const OPTIONS: { value: WallCovering; label: string }[] = [
  { value: 'none', label: 'Без покрытия' },
  { value: 'paint', label: 'Покраска' },
  { value: 'wallpaper', label: 'Обои' },
];

export function WallCoveringPanel() {
  const { rooms, wallCovering, setWallCovering } = useProjectStore();
  // TODO(v1.9.b — F12.1): drop this filter so corridor and wardrobe also pick a covering.
  const relevantRooms = rooms.filter((r) => r.type !== 'corridor' && r.type !== 'wardrobe');

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Покрытие стен</h3>
      <p style={{ fontSize: '0.82rem', color: PALETTE.text.secondary, margin: '0 0 0.75rem' }}>
        Выбор покрытия для стен каждой комнаты.
      </p>
      <ul className={styles.roomList}>
        {relevantRooms.map((room) => {
          const current = wallCovering[room.id] ?? 'none';
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
