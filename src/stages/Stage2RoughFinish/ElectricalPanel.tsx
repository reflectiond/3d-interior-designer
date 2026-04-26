import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import styles from './SidePanel.module.css';

interface ElectricalPanelProps {
  pointType: 'socket' | 'switch';
  onPointTypeChange: (type: 'socket' | 'switch') => void;
}

export function ElectricalPanel({ pointType, onPointTypeChange }: ElectricalPanelProps) {
  const { electricalPoints, removeElectricalPoint } = useProjectStore();

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Электрика</h3>

      <div className={styles.radioGroup} style={{ marginBottom: '0.75rem' }}>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="pointType"
            checked={pointType === 'socket'}
            onChange={() => onPointTypeChange('socket')}
          />
          Розетка
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="pointType"
            checked={pointType === 'switch'}
            onChange={() => onPointTypeChange('switch')}
          />
          Выключатель
        </label>
      </div>

      <p style={{ fontSize: '0.82rem', color: PALETTE.text.secondary, margin: '0 0 0.75rem' }}>
        Кликните по краю комнаты на схеме справа, чтобы добавить точку. Внешние стены заблокированы.
      </p>

      {electricalPoints.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: PALETTE.text.secondary, fontStyle: 'italic' }}>
          Нет электроточек
        </p>
      ) : (
        <ul className={styles.roomList}>
          {electricalPoints.map((point, i) => (
            <li
              key={point.id}
              className={styles.roomItem}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span className={styles.roomName}>
                {i + 1}. {point.type === 'socket' ? 'Розетка' : 'Выключатель'}
              </span>
              <button
                onClick={() => removeElectricalPoint(point.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: PALETTE.electrical.panel,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  textDecoration: 'underline',
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
