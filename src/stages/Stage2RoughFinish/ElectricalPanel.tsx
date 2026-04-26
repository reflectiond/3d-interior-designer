import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import styles from './SidePanel.module.css';

export function ElectricalPanel() {
  const { electricalPoints, removeElectricalPoint } = useProjectStore();

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Электрика</h3>
      <p style={{ fontSize: '0.82rem', color: PALETTE.text.secondary, margin: '0 0 0.5rem' }}>
        Кликните по внутренней стене на схеме, чтобы добавить розетку или выключатель.
      </p>
      {electricalPoints.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: PALETTE.text.secondary }}>Нет точек</p>
      ) : (
        <ul className={styles.roomList}>
          {electricalPoints.map((point) => (
            <li key={point.id} className={styles.roomItem}>
              <span className={styles.roomName}>
                {point.type === 'socket' ? 'Розетка' : 'Выключатель'}
              </span>
              <button
                onClick={() => removeElectricalPoint(point.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: PALETTE.electrical.panel,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
